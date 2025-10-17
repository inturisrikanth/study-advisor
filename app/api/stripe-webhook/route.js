// app/api/stripe-webhook/route.js
import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const {
      STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET,
      STRIPE_PRICE_ONE,
      STRIPE_PRICE_PACK,
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    } = process.env;

    if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json(
        { ok: false, error: "Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET" },
        { status: 500 }
      );
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { ok: false, error: "Missing Supabase credentials" },
        { status: 500 }
      );
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY);

    // Read raw body for Stripe signature verification
    const rawBody = await req.text();
    const sig = req.headers.get("stripe-signature");

    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: `Webhook signature verification failed: ${err.message}` },
        { status: 400 }
      );
    }

    // We only handle completed checkout sessions here
    if (event.type !== "checkout.session.completed") {
      return NextResponse.json({ ok: true, ignored: event.type });
    }

    // Get the full session with line items
    const session = event.data.object;
    // optional: ignore if not paid (belt & suspenders)
    if (session?.payment_status && session.payment_status !== "paid") {
      return NextResponse.json({ ok: true, ignored: "payment_status != paid" });
    }

    const full = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["line_items"],
    });

    // ---- Identify the user
    // Prefer explicit metadata user id from checkout
    let userId =
      full?.metadata?.user_id ||
      full?.metadata?.userId ||
      null;

    // Fallback by email
    const email =
      full?.customer_details?.email ||
      full?.customer_email ||
      full?.metadata?.email ||
      null;

    if (!userId && email) {
      // Map email -> profiles.user_id
      const resp1 = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?select=user_id&email=eq.${encodeURIComponent(email)}`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          cache: "no-store",
        }
      );
      const prof = await resp1.json().catch(() => null);
      userId = Array.isArray(prof) && prof[0]?.user_id ? prof[0].user_id : null;
    }

    if (!userId) {
      // No user — can’t credit
      return NextResponse.json(
        { ok: true, warn: "No user identified (missing metadata.user_id and no matching email)." },
        { status: 202 }
      );
    }

    // ---- Determine how many credits to add
    let addCredits = 0;

    // (1) Most explicit: metadata.credits (set by /api/checkout we updated)
    const metaCreditsRaw =
      full?.metadata?.credits ??
      session?.metadata?.credits ??
      "";
    const metaCredits = parseInt(String(metaCreditsRaw), 10);
    if (Number.isFinite(metaCredits) && metaCredits > 0) {
      addCredits = metaCredits;
    }

    // (2) If no explicit number, look at metadata.priceKind
    if (!addCredits) {
      const kind =
        full?.metadata?.priceKind ||
        session?.metadata?.priceKind ||
        null; // "single" | "bundle"
      if (kind === "single") addCredits = 1;
      if (kind === "bundle") addCredits = 4;
    }

    // (3) If still unclear, infer via price IDs on line items
    if (!addCredits && Array.isArray(full?.line_items?.data)) {
      for (const it of full.line_items.data) {
        const priceId = it?.price?.id;
        const qty = it?.quantity || 1;
        if (priceId && STRIPE_PRICE_ONE && priceId === STRIPE_PRICE_ONE) addCredits += 1 * qty;
        if (priceId && STRIPE_PRICE_PACK && priceId === STRIPE_PRICE_PACK) addCredits += 4 * qty;
      }
    }

    // (4) Last fallback: infer via amount_total ($10 => 1, $30 => 4)
    if (!addCredits) {
      const cents = Number(full?.amount_total || 0);
      if (cents >= 3000) addCredits = 4;
      else if (cents >= 1000) addCredits = 1;
    }

    if (addCredits <= 0) {
      return NextResponse.json(
        { ok: true, info: "No recognizable purchase for credit mapping." },
        { status: 200 }
      );
    }

    // ---- Update credits in Supabase
    const headers = {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    };

    // Fetch current balance (if any)
    const getRes = await fetch(
      `${SUPABASE_URL}/rest/v1/credits?user_id=eq.${encodeURIComponent(userId)}&select=balance`,
      { headers, cache: "no-store" }
    );
    if (!getRes.ok) {
      const t = await getRes.text();
      return NextResponse.json({ ok: false, error: `Credits fetch failed: ${t}` }, { status: 500 });
    }
    const rows = await getRes.json().catch(() => []);
    const current =
      Array.isArray(rows) && rows.length > 0 && rows[0] && Number.isFinite(Number(rows[0].balance))
        ? Number(rows[0].balance)
        : 0;

    const newBal = current + addCredits;

    if (!Array.isArray(rows) || rows.length === 0) {
      // Insert new row
      const ins = await fetch(`${SUPABASE_URL}/rest/v1/credits`, {
        method: "POST",
        headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({ user_id: userId, balance: newBal }),
      });
      if (!ins.ok) {
        const t = await ins.text();
        return NextResponse.json({ ok: false, error: `Credits insert failed: ${t}` }, { status: 500 });
      }
    } else {
      // Update existing row
      const upd = await fetch(
        `${SUPABASE_URL}/rest/v1/credits?user_id=eq.${encodeURIComponent(userId)}`,
        {
          method: "PATCH",
          headers: { ...headers, Prefer: "return=representation" },
          body: JSON.stringify({ balance: newBal }),
        }
      );
      if (!upd.ok) {
        const t = await upd.text();
        return NextResponse.json({ ok: false, error: `Credits update failed: ${t}` }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      user_id: userId,
      added: addCredits,
      balance: newBal,
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "Method Not Allowed" }, { status: 405 });
}