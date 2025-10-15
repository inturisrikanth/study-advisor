// app/api/generate-sop/route.js
import { NextResponse } from "next/server";

/**
 * POST /api/generate-sop
 * Body can use either:
 *  - { uni, prog, goal, background, projects?, reasons?, sampleKey? }
 *  - { university, program, careerGoal, academicBackground, projects?, reasons?, sampleKey? }
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

    const body = await req.json();

    // 🔧 Normalize field names from client
    const uni = body.uni ?? body.university ?? "";
    const prog = body.prog ?? body.program ?? "";
    const goal = body.goal ?? body.careerGoal ?? "";
    const background = body.background ?? body.academicBackground ?? "";
    const projects = body.projects ?? "";
    const reasons = body.reasons ?? "";
    const sampleKey = body.sampleKey || "ms-computer-science/sample-001.txt";

    if (!uni || !prog || !goal || !background) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Missing required fields: university, program, career goal, or background.",
          received: { uni, prog, goal, background },
        },
        { status: 400 }
      );
    }

    // ===== Fetch sample SOP text from Supabase (PRIVATE bucket) =====
    // Use non-public endpoint with Authorization
    const safePath = sampleKey
      .split("/")
      .map(encodeURIComponent) // keeps path segments, encodes spaces etc.
      .join("/");

    const sampleUrl = `${SUPABASE_URL}/storage/v1/object/${SAMPLE_SOPS_BUCKET}/${safePath}`;
    const sampleResp = await fetch(sampleUrl, {
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      cache: "no-store",
    });

    let sampleText = "";
    if (sampleResp.ok) {
      sampleText = await sampleResp.text();
    } else {
      // It’s okay if there’s no sample; just proceed without it
      // console.warn("Sample SOP fetch not OK:", sampleResp.status);
    }

    // ===== Compose prompt for OpenAI =====
    const userPrompt = `
Write a professional, authentic Statement of Purpose (500–700 words).

University: ${uni}
Program: ${prog}

Career Goal: ${goal}
Academic Background: ${background}
Projects/Internships: ${projects || "N/A"}
Why this university/program: ${reasons || "N/A"}

Use the following sample ONLY as *style inspiration*, do not copy its content:
${sampleText}

Keep tone formal but natural. Avoid fluff, focus on clarity and relevance.
`;

    // ===== Call OpenAI =====
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
        max_tokens: 1000,
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

    return NextResponse.json({ ok: true, sop }, { status: 200 });
  } catch (e) {
    console.error("SOP generation error:", e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

// Optional: handle non-POST methods explicitly (helps debugging)
export async function GET() {
  return NextResponse.json({ ok: false, error: "Method Not Allowed" }, { status: 405 });
}