// app/api/visa/mock/start/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";

function getSupabaseFromReq(req: Request) {
  const auth = req.headers.get("authorization");
  // If frontend sent a Bearer token, use it
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
  // else fall back to cookie auth
  return createRouteHandlerClient({ cookies });
}

const INTERVIEW_COST = 2; // 2 credits per mock
const DEFAULT_MAX_TURNS = 20; // 15–20 questions (~10 mins)

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseFromReq(req);

    // make sure user is logged in
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // call your RPC that creates/reuses a session and deducts credits
    const { data, error } = await supabase.rpc("start_visa_mock_session", {
      p_user_id: user.id,
      p_cost_credits: INTERVIEW_COST,
      p_max_turns: DEFAULT_MAX_TURNS, // 👈 tell RPC we want 20
    });

    if (error) {
      // normalize credit errors
      const msg = error.message ?? "";
      if (
        msg.includes("INSUFFICIENT_CREDITS") ||
        msg.toLowerCase().includes("not enough") ||
        msg.toLowerCase().includes("insufficient")
      ) {
        return NextResponse.json({ error: "INSUFFICIENT_CREDITS" }, { status: 402 });
      }
      console.error("start_visa_mock_session error:", error);
      return NextResponse.json({ error: msg || "Start failed" }, { status: 400 });
    }

    // our RPC returns an array like [{ session_id, remaining_credits }]
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return NextResponse.json({ error: "No data returned" }, { status: 500 });
    }

    const sessionId = row.session_id;
    const remainingCredits = row.remaining_credits;

    if (!sessionId) {
      return NextResponse.json({ error: "SESSION_ID_MISSING" }, { status: 500 });
    }

    // 👇 extra safety: ensure the session row actually has max_turns = 20
    // sometimes RPCs reuse an existing active session with old 10-turn value
    const { data: sessionRow, error: sessionErr } = await supabase
      .from("visa_mock_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id) // 👈 scope to current user for RLS sanity
      .maybeSingle();

    if (!sessionErr && sessionRow) {
      const needsUpdate =
        !sessionRow.max_turns ||
        typeof sessionRow.max_turns !== "number" ||
        sessionRow.max_turns < DEFAULT_MAX_TURNS;

      if (needsUpdate) {
        await supabase
          .from("visa_mock_sessions")
          .update({ max_turns: DEFAULT_MAX_TURNS })
          .eq("id", sessionId)
          .eq("user_id", user.id); // 👈 scope update too
      }
    }

    return NextResponse.json(
      {
        sessionId,
        remainingCredits,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("visa/mock/start error:", err);
    return NextResponse.json(
      { error: err.message ?? "Server error" },
      { status: 500 }
    );
  }
}
