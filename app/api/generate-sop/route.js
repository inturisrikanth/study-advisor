// app/api/generate-sop/route.js
import { NextResponse } from "next/server";

/**
 * POST /api/generate-sop
 * Accepts either:
 *   { uni, prog, goal, background, projects?, reasons?, sampleKey?, locale? }
 *   { university, program, careerGoal, academicBackground, projects?, reasons?, sampleKey?, locale? }
 * Auto-selects a sample SOP file by program name if sampleKey not provided.
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

    // Normalize field names from client
    const uni        = body.uni ?? body.university ?? "";
    const prog       = body.prog ?? body.program ?? "";
    const goal       = body.goal ?? body.careerGoal ?? "";
    const background = body.background ?? body.academicBackground ?? "";
    const projects   = body.projects ?? "";
    const reasons    = body.reasons ?? "";
    const locale     = body.locale ?? "en";

    if (!uni || !prog || !goal || !background) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing required fields: university, program, career goal, or background.",
          received: { uni, prog, goal, background },
        },
        { status: 400 }
      );
    }

    // --- Program → sample file mapping (auto-pick if sampleKey not provided)
    const pickSampleKey = (programName = "") => {
      const p = programName.toLowerCase();

      if (p.includes("artificial intelligence"))      return "ms-artificial-intelligence/sample-001.txt";
      if (p.includes("computer networks") || p.includes("networks"))
                                                     return "ms-computer-networks/sample-001.txt";
      if (p.includes("cybersecurity") || p.includes("cyber security"))
                                                     return "ms-cybersecurity/sample-001.txt";
      if (p.includes("data science"))                 return "ms-data-science/sample-001.txt";
      if (p.includes("information systems"))          return "ms-information-systems/sample-001.txt";
      if (p.includes("information technology"))       return "ms-information-technology/sample-001.txt";
      if (p.includes("software engineering"))         return "ms-software-engineering/sample-001.txt";
      // default catch-all
      return "ms-computer-science/sample-001.txt";
    };

    const sampleKey = body.sampleKey || pickSampleKey(prog);

    // --- Fetch sample SOP text from PRIVATE Supabase bucket
    // Use non-public endpoint + Service Role auth; encode each path segment safely.
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

    // --- Compose prompt for OpenAI
    const userPrompt = `
Write a professional, authentic Statement of Purpose (500–700 words).
Locale: ${locale}

University: ${uni}
Program: ${prog}

Career Goal: ${goal}
Academic Background: ${background}
Projects/Internships: ${projects || "N/A"}
Why this university/program: ${reasons || "N/A"}

Use the following sample ONLY as style inspiration; do not copy content:
${sampleText || "(no sample available)"}

Requirements:
- Formal but natural tone
- Clear paragraphing (no headings like "Introduction/Conclusion")
- Avoid generic filler and repetition
`;

    // --- Call OpenAI
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
      return NextResponse.json({ ok: false, error: `OpenAI API error: ${errText}` }, { status: 502 });
    }

    const aiData = await aiResp.json();
    const sop = aiData?.choices?.[0]?.message?.content?.trim();
    if (!sop) {
      return NextResponse.json({ ok: false, error: "AI returned empty response." }, { status: 502 });
    }

    // Optionally return which sample was used (handy for debugging)
    return NextResponse.json({ ok: true, sop, usedSampleKey: sampleKey }, { status: 200 });
  } catch (e) {
    console.error("SOP generation error:", e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

// Explicit GET → 405 (helps debugging accidental GETs)
export async function GET() {
  return NextResponse.json({ ok: false, error: "Method Not Allowed" }, { status: 405 });
}