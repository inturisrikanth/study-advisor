// app/api/visa/live/token/route.ts
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

/**
 * Temporary placeholder route.
 * Later this will create an OpenAI Realtime session and return its token.
 * For now it just checks auth + session and returns a dummy token object.
 */
export async function GET(req: Request) {
  try {
    const supabase = getSupabaseFromReq(req);
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    // 1) Authenticate user
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2) Verify session belongs to user and is active
    const { data: session, error: sesErr } = await supabase
      .from("visa_mock_sessions")
      .select("id, status")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (sesErr || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.status !== "active") {
      return NextResponse.json({ error: "Session not active" }, { status: 400 });
    }

    // 3) Return a placeholder "token" for frontend testing
    const fakeToken = {
      token: "dummy-live-token",
      expires_in: 3600, // 1 hour
      user_id: user.id,
      session_id: sessionId,
      mode: "live",
    };

    return NextResponse.json(fakeToken, { status: 200 });
  } catch (err: any) {
    console.error("visa/live/token error:", err);
    return NextResponse.json(
      { error: err.message ?? "Server error" },
      { status: 500 }
    );
  }
}
