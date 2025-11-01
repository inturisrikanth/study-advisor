// app/api/visa/live/end/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// helper: make supabase from bearer or cookies
function getSupabaseFromReq(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth && auth.startsWith("Bearer ")) {
    const token = auth.slice(7);
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );
  }
  return createRouteHandlerClient({ cookies });
}

// small helper: normalize to array
function ensureArray(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map((v) => String(v));
  return [String(val)];
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseFromReq(req);
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    // 1) auth
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2) load session, but scoped to THIS user
    const { data: session, error: sesErr } = await supabase
      .from("visa_mock_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle(); // 👈 safer than .single()

    if (sesErr) {
      console.error("visa/live/end: session load error", sesErr);
      return NextResponse.json({ error: sesErr.message }, { status: 500 });
    }
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // if already completed & has feedback → just return it
    if (session.status === "completed" && session.feedback_json) {
      return NextResponse.json(
        {
          mode: "live",
          feedback: session.feedback_json,
        },
        { status: 200 }
      );
    }

    // 3) load all turns to build transcript
    const { data: turns, error: turnsErr } = await supabase
      .from("visa_mock_turns")
      .select("turn_no, user_text, ai_text, question_key, created_at")
      .eq("session_id", sessionId)
      .order("turn_no", { ascending: true });

    if (turnsErr) {
      console.error("visa/live/end: turnsErr", turnsErr);
      return NextResponse.json(
        { error: "Could not load turns to generate feedback" },
        { status: 500 }
      );
    }

    // 4a) no turns → finish with canned feedback
    if (!turns || turns.length === 0) {
      const endedAt = new Date().toISOString();
      const emptyFeedback = {
        overall: "Interview finished, but there were no turns to analyze.",
        strengths: [],
        improvements: [],
        example_rewrite: "",
        total_turns: 0,
        ended_at: endedAt,
      };

      // best-effort save
      await supabase
        .from("visa_mock_sessions")
        .update({
          status: "completed",
          ended_at: endedAt,
          total_turns: 0,
          feedback_json: emptyFeedback,
        })
        .eq("id", sessionId)
        .eq("user_id", user.id);

      return NextResponse.json(
        {
          mode: "live",
          feedback: emptyFeedback,
        },
        { status: 200 }
      );
    }

    // 4b) make compact transcript
    const transcript = turns
      .map((t) => {
        return `Officer: ${t.ai_text || ""}\nCandidate: ${t.user_text || ""}`;
      })
      .join("\n\n");

    // 5) call OpenAI to get structured feedback
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "You are an experienced U.S. F-1 visa officer and interview coach. You just conducted a mock interview. You must return a SHORT JSON with fields: overall (string), strengths (string[]), improvements (string[]), example_rewrite (string). Keep it concise and practical. DO NOT add backticks. DO NOT wrap in code fences.",
      },
      {
        role: "user",
        content: `Here is the full interview transcript (officer question + candidate answer). Please analyze:

${transcript}

Return JSON only.`,
      },
    ];

    let structured: any = null;
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.35,
        max_tokens: 500,
      });

      const raw = completion.choices[0]?.message?.content?.trim() || "";
      try {
        structured = JSON.parse(raw);
      } catch {
        structured = { raw };
      }
    } catch (llmErr: any) {
      console.error("visa/live/end: openai error", llmErr);
      structured = {
        raw: "Could not generate AI feedback at this time.",
      };
    }

    // 6) normalize
    const endedAt = new Date().toISOString();
    const safeFeedback = {
      overall:
        typeof structured?.overall === "string" && structured.overall.trim()
          ? structured.overall.trim()
          : "Here is your overall feedback on the interview.",
      strengths: ensureArray(structured?.strengths),
      improvements: ensureArray(structured?.improvements),
      example_rewrite:
        typeof structured?.example_rewrite === "string"
          ? structured.example_rewrite
          : typeof structured?.raw === "string"
          ? structured.raw
          : "",
      raw: typeof structured?.raw === "string" ? structured.raw : undefined,
      total_turns: turns.length,
      ended_at: endedAt,
    };

    // 7) save back to session (best effort)
    const { error: updErr } = await supabase
      .from("visa_mock_sessions")
      .update({
        status: "completed",
        ended_at: endedAt,
        total_turns: turns.length,
        feedback_json: safeFeedback,
      })
      .eq("id", sessionId)
      .eq("user_id", user.id);

    if (updErr) {
      console.error("visa/live/end: update error", updErr);
      // still return feedback to UI
      return NextResponse.json(
        {
          mode: "live",
          feedback: safeFeedback,
          warning: "Feedback generated but not saved to DB.",
        },
        { status: 200 }
      );
    }

    // 8) return to client
    return NextResponse.json(
      {
        mode: "live",
        feedback: safeFeedback,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("visa/live/end error:", err);
    return NextResponse.json(
      {
        error: err?.message || "Server error",
      },
      { status: 500 }
    );
  }
}
