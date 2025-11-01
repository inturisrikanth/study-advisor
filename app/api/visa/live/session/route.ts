// app/api/visa/live/session/route.ts
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
  // cookie-auth fallback
  return createRouteHandlerClient({ cookies });
}

export async function GET(req: Request) {
  try {
    const supabase = getSupabaseFromReq(req);
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    // 1) auth
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2) load session (use maybeSingle to avoid pattern errors)
    const { data: session, error: sesErr } = await supabase
      .from("visa_mock_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (sesErr) {
      // if Supabase throws a decode / pattern issue, it will land here
      console.error("live/session session load error:", sesErr);
      return NextResponse.json({ error: sesErr.message }, { status: 500 });
    }

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // 3) load turns
    const { data: turns, error: tErr } = await supabase
      .from("visa_mock_turns")
      .select("turn_no, user_text, ai_text, created_at")
      .eq("session_id", sessionId)
      .order("turn_no", { ascending: true });

    if (tErr) {
      console.error("live/session turns load error:", tErr);
      return NextResponse.json({ error: "Failed to load turns" }, { status: 500 });
    }

    // 4) normalize feedback
    const feedback =
      session.feedback_json && typeof session.feedback_json === "object"
        ? session.feedback_json
        : null;

    // 5) canResume logic (same as we used on client)
    const canResume =
      session.status === "active" &&
      (session.total_turns ?? 0) < (session.max_turns ?? 999);

    return NextResponse.json({
      mode: "live",
      session: {
        ...session,
        feedback_json: feedback,
      },
      turns: (turns ?? []).map((t) => ({
        turn_no: t.turn_no,
        user_text: t.user_text,
        ai_text: t.ai_text,
        created_at: t.created_at,
      })),
      canResume,
    });
  } catch (err: any) {
    console.error("visa/live/session unexpected error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
