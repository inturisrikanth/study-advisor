// === File: /api/generate-sop.js ===
// This runs on your Vercel backend and talks to both Supabase + OpenAI.

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }

    const {
      OPENAI_API_KEY,
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      SAMPLE_SOPS_BUCKET = "sample-sops",
    } = process.env;

    if (!OPENAI_API_KEY)
      throw new Error("Missing OPENAI_API_KEY in environment variables.");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
      throw new Error("Missing Supabase credentials.");

    const { uni, prog, goal, background, projects, reasons, sampleKey } = req.body;

    if (!uni || !prog || !goal || !background) {
      return res.status(400).json({
        ok: false,
        error:
          "Missing required fields: university, program, career goal, or background.",
      });
    }

    // --- Fetch sample SOP content from Supabase ---
    const fetchSample = await fetch(
      `${SUPABASE_URL}/storage/v1/object/public/${SAMPLE_SOPS_BUCKET}/${sampleKey}`,
      { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } }
    );

    let sampleText = "";
    if (fetchSample.ok) {
      sampleText = await fetchSample.text();
    }

    // --- Compose AI prompt ---
    const userPrompt = `
Write a professional, engaging Statement of Purpose for the program:
University: ${uni}
Program: ${prog}

Career Goal: ${goal}
Academic Background: ${background}
Projects/Internships: ${projects || "N/A"}
Reasons for selecting this program/university: ${reasons || "N/A"}

Use the following sample SOP as reference (style only, not content):
${sampleText}

The SOP should sound authentic, 500–700 words, formal yet natural tone.
`;

    // --- Call OpenAI API ---
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
      throw new Error(`OpenAI API error: ${errText}`);
    }

    const aiData = await aiResp.json();
    const sop = aiData.choices?.[0]?.message?.content?.trim();

    if (!sop) throw new Error("AI returned empty response.");

    return res.status(200).json({ ok: true, sop });
  } catch (e) {
    console.error("SOP generation error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}