// app/api/visa/live/start/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";

// interview config (keep same as mock for now)
const INTERVIEW_COST = 2;
const DEFAULT_MAX_TURNS = 20;

// choose supabase client based on Bearer vs cookies
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

    // 1) auth
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2) call the SAME RPC as mock
    const { data, error } = await supabase.rpc("start_visa_mock_session", {
      p_user_id: user.id,
      p_cost_credits: INTERVIEW_COST,
      p_max_turns: DEFAULT_MAX_TURNS,
    });

    if (error) {
      const msg = error.message ?? "";
      // this matches what we used to do in mock
      if (
        msg.includes("INSUFFICIENT_CREDITS") ||
        msg.toLowerCase().includes("insufficient") ||
        msg.toLowerCase().includes("not enough")
      ) {
        return NextResponse.json({ error: "INSUFFICIENT_CREDITS" }, { status: 402 });
      }
      console.error("start_visa_mock_session (live) error:", msg);
      return NextResponse.json({ error: msg || "Start failed" }, { status: 400 });
    }

    // RPC sometimes returns array, sometimes object → normalize
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return NextResponse.json({ error: "No data returned from RPC" }, { status: 500 });
    }

    const sessionId = row.session_id;
    const remainingCredits = row.remaining_credits;

    if (!sessionId) {
      return NextResponse.json({ error: "SESSION_ID_MISSING" }, { status: 500 });
    }

    // 3) (optional) make sure max_turns is set on the row
    await supabase
      .from("visa_mock_sessions")
      .update({ max_turns: DEFAULT_MAX_TURNS })
      .eq("id", sessionId)
      .eq("user_id", user.id);

    // 4) done
    return NextResponse.json(
      {
        ok: true,
        mode: "live",
        sessionId,
        remainingCredits,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("visa/live/start error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
