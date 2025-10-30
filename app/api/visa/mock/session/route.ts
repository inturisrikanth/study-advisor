// app/api/visa/mock/session/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";

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

export async function GET(req: Request) {
  try {
    const supabase = getSupabaseFromReq(req);
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    // auth
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // load session – scoped to user
    const { data: session, error: sesErr } = await supabase
      .from("visa_mock_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (sesErr || !session) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // load turns
    const { data: turns, error: tErr } = await supabase
      .from("visa_mock_turns")
      .select("id, turn_no, user_text, ai_text, question_key, created_at")
      .eq("session_id", sessionId)
      .order("turn_no", { ascending: true });

    if (tErr) {
      return NextResponse.json({ error: "Failed to load turns" }, { status: 500 });
    }

    // normalize feedback for the UI
    const feedback =
      session.feedback_json && typeof session.feedback_json === "object"
        ? session.feedback_json
        : null;

    // can the user resume?
    const canResume = session.status === "active";

    return NextResponse.json({
      session: {
        ...session,
        feedback_json: feedback,
      },
      turns: turns ?? [],
      canResume,
    });
  } catch (err: any) {
    console.error("visa/mock/session error:", err);
    return NextResponse.json(
      { error: err.message ?? "Server error" },
      { status: 500 }
    );
  }
}
