// app/api/visa/live/turn/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const SESSIONS_TABLE = "visa_mock_sessions";
const TURNS_TABLE = "visa_mock_turns";

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

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseFromReq(req);
    const { sessionId, userText, clientTurnToken } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }
    if (!userText || !userText.trim()) {
      return NextResponse.json({ error: "Missing userText" }, { status: 400 });
    }

    // 1) auth (same as other live routes)
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2) load session, scoped to this user
    const { data: session, error: sesErr } = await supabase
      .from(SESSIONS_TABLE)
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (sesErr) {
      console.error("live/turn session error:", sesErr);
      return NextResponse.json({ error: "SESSION_LOAD_FAILED" }, { status: 500 });
    }
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (session.status === "completed") {
      return NextResponse.json({ error: "SESSION_COMPLETED" }, { status: 400 });
    }

    const maxTurns =
      typeof session.max_turns === "number" && session.max_turns > 0
        ? session.max_turns
        : 20;
    const currentTurns =
      typeof session.total_turns === "number" && session.total_turns >= 0
        ? session.total_turns
        : 0;

    if (currentTurns >= maxTurns) {
      return NextResponse.json({ error: "MAX_TURNS_REACHED" }, { status: 400 });
    }

    // 3) idempotency (since your table HAS client_turn_token we can reuse it)
    if (clientTurnToken) {
      const { data: existing, error: exErr } = await supabase
        .from(TURNS_TABLE)
        .select("turn_no, user_text, ai_text")
        .eq("session_id", sessionId)
        .eq("client_turn_token", clientTurnToken)
        .maybeSingle();

      if (!exErr && existing) {
        const done = existing.turn_no >= maxTurns;
        return NextResponse.json(
          {
            aiText: existing.ai_text ?? "",
            turnNo: existing.turn_no,
            done,
          },
          { status: 200 }
        );
      }
    }

    // 4) call OpenAI for officer reply
    const prompt = `You are acting as a U.S. F-1 visa officer in a mock interview. The candidate just said:

"${userText}"

Reply with the next question or follow-up in 1–3 sentences. If the interview can be closed, say: "This concludes your interview. Have a good day."`;

    let aiReply = "Thank you. Can you tell me more about your university and program?";
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a U.S. visa officer conducting an F-1 interview." },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 200,
      });
      aiReply = completion.choices[0]?.message?.content?.trim() || aiReply;
    } catch (llmErr: any) {
      console.error("live/turn openai error:", llmErr);
    }

    const nextTurnNo = currentTurns + 1;

    // 5) INSERT — match EXACTLY your columns (NO user_id)
    const { error: insErr } = await supabase.from(TURNS_TABLE).insert({
      session_id: sessionId,
      turn_no: nextTurnNo,
      user_text: userText,
      ai_text: aiReply,
      client_turn_token: clientTurnToken ?? null,
      // created_at has default now()
      // question_key is optional, we skip
    });

    if (insErr) {
      console.error("live/turn insert error:", insErr);
      return NextResponse.json({ error: "TURN_INSERT_FAILED" }, { status: 500 });
    }

    // 6) update the session
    const aiSaidBye = /concludes your interview|have a good day|we are done/i.test(aiReply);
    const newStatus = aiSaidBye ? "completed" : "active";

    const { error: updErr } = await supabase
      .from(SESSIONS_TABLE)
      .update({
        total_turns: nextTurnNo,
        status: newStatus,
      })
      .eq("id", sessionId)
      .eq("user_id", user.id);

    if (updErr) {
      console.error("live/turn session update error:", updErr);
      // we still return success, since turn is saved
    }

    return NextResponse.json(
      {
        aiText: aiReply,
        turnNo: nextTurnNo,
        done: newStatus === "completed" || nextTurnNo >= maxTurns,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("visa/live/turn error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
