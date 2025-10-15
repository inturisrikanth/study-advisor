// app/api/generate-sop/route.js
import { NextResponse } from "next/server";

/**
 * POST /api/generate-sop
 * Accepts either the old or new payload shapes.
 *
 * Required (new flow):
 *   - uni/university
 *   - prog/program
 *   - goal/careerGoal
 *   - undergradCollege (also accepts ugCollege / ug_college)
 *   - undergradMajor   (also accepts ugMajor / ug_major)
 *
 * Optional:
 *   - background/academicBackground
 *   - undergradGPA (ugGPA / ug_gpa)
 *   - testScore (test_score)
 *   - projects, reasons
 *   - firstName/lastName (first_name/last_name) — not inserted in text; client adds signature
 *   - sampleKey (overrides auto selection)
 *   - locale ("en" default)
 */
export async function POST(req) {
  try {
    const {
      OPENAI_API_KEY,
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      SAMPLE_SOPS_BUCKET = "sample-sops",
    } = process.env;

    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "Missing OPENAI_API_KEY in environment variables." },
        { status: 500 }
      );
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { ok: false, error: "Missing Supabase credentials (URL or SERVICE_ROLE)." },
        { status: 500 }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
    }

    // ---- Normalize field names (backward-compatible) ----
    const uni        = body.uni ?? body.university ?? "";
    const prog       = body.prog ?? body.program ?? "";
    const goal       = body.goal ?? body.careerGoal ?? "";

    // New required undergrad fields (accept several aliases)
    const undergradCollege =
      body.undergradCollege ?? body.ugCollege ?? body.ug_college ?? "";
    const undergradMajor =
      body.undergradMajor ?? body.ugMajor ?? body.ug_major ?? "";

    // Optional fields (accept several aliases)
    const background = body.background ?? body.academicBackground ?? "";
    const undergradGPA = body.undergradGPA ?? body.ugGPA ?? body.ug_gpa ?? "";
    const testScore = body.testScore ?? body.test_score ?? "";
    const projects  = body.projects ?? "";
    const reasons   = body.reasons ?? "";
    const locale    = body.locale ?? "en";

    // Optional identity (not inserted in prompt; client adds footer)
    const firstName = body.firstName ?? body.first_name ?? "";
    const lastName  = body.lastName ?? body.last_name ?? "";

    // ---- Required checks (new flow) ----
    if (!uni || !prog || !goal || !undergradCollege || !undergradMajor) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Missing required fields: university, program, career goal, undergrad college, or undergrad major.",
          received: { uni, prog, goal, undergradCollege, undergradMajor },
        },
        { status: 400 }
      );
    }

    // ---- Program → sample file mapping (auto-pick if sampleKey not provided) ----
    const pickSampleKey = (programName = "") => {
      const p = programName.toLowerCase();

      if (p.includes("artificial intelligence")) return "ms-artificial-intelligence/sample-001.txt";
      if (p.includes("computer networks") || p.includes("networks"))
        return "ms-computer-networks/sample-001.txt";
      if (p.includes("cybersecurity") || p.includes("cyber security"))
        return "ms-cybersecurity/sample-001.txt";
      if (p.includes("data science")) return "ms-data-science/sample-001.txt";
      if (p.includes("information systems")) return "ms-information-systems/sample-001.txt";
      if (p.includes("information technology")) return "ms-information-technology/sample-001.txt";
      if (p.includes("software engineering")) return "ms-software-engineering/sample-001.txt";
      // default catch-all
      return "ms-computer-science/sample-001.txt";
    };

    const sampleKey = body.sampleKey || pickSampleKey(prog);

    // ---- Fetch sample SOP text from PRIVATE Supabase bucket ----
    // Use non-public endpoint + Service Role auth; encode path segments safely.
    const safePath = sampleKey.split("/").map(encodeURIComponent).join("/");
    const sampleUrl = `${SUPABASE_URL}/storage/v1/object/${SAMPLE_SOPS_BUCKET}/${safePath}`;

    let sampleText = "";
    try {
      const sampleResp = await fetch(sampleUrl, {
        headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        cache: "no-store",
      });
      if (sampleResp.ok) sampleText = await sampleResp.text();
      // If missing, continue without sample
    } catch {
      // network issue – continue without sample
    }

    // ---- Compose a strict prompt for OpenAI ----
    const userPrompt = `
Write a professional, authentic Statement of Purpose (~500–700 words).
Locale: ${locale}

University: ${uni}
Program: ${prog}

Career Goal: ${goal}
Undergraduate College/University: ${undergradCollege}
Undergraduate Major/Branch: ${undergradMajor}
Undergraduate GPA (if provided): ${undergradGPA || "N/A"}
Standardized Test (if provided): ${testScore || "N/A"}

Academic Background (optional notes): ${background || "N/A"}
Key Projects / Internships (optional): ${projects || "N/A"}
Why this university/program (optional): ${reasons || "N/A"}

Style inspiration (do NOT copy content; only mirror tone/structure):
${sampleText || "(no sample available)"}

Writing constraints:
- Do NOT invent details; only use the information above.
- Do NOT include placeholders like "your undergrad university" or "[insert]".
- Do NOT use section headings like "Introduction" or "Conclusion".
- Use clear paragraphs (4–6), formal but human tone, specific and concise.
- If an optional field is not provided, omit it gracefully.
- Do NOT include salutations or a signature; the client will add it.
`;

    // ---- Call OpenAI ----
    const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an expert SOP writer for graduate programs." },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1100,
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      return NextResponse.json(
        { ok: false, error: `OpenAI API error: ${errText}` },
        { status: 502 }
      );
    }

    const aiData = await aiResp.json();
    const sop = aiData?.choices?.[0]?.message?.content?.trim();
    if (!sop) {
      return NextResponse.json(
        { ok: false, error: "AI returned empty response." },
        { status: 502 }
      );
    }

    // Helpful for debugging: echo which sample was used (safe)
    return NextResponse.json(
      {
        ok: true,
        sop,
        usedSampleKey: sampleKey,
        // returned but not used client-side:
        accepted: {
          uni,
          prog,
          goal,
          undergradCollege,
          undergradMajor,
          undergradGPA,
          testScore,
          locale,
        },
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("SOP generation error:", e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

// Explicit GET → 405 (helps debugging accidental GETs)
export async function GET() {
  return NextResponse.json({ ok: false, error: "Method Not Allowed" }, { status: 405 });
}