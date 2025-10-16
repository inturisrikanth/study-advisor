// app/api/checkout/route.js
import { NextResponse } from "next/server";

/**
 * POST /api/checkout
 * Body: { priceId: string, quantity?: number, userId?: string, email?: string }
 * Returns: { ok: true, url } on success
 */
export async function POST(req) {
  try {
    const {
      STRIPE_SECRET_KEY,
      STRIPE_PRICE_ONE,
      STRIPE_PRICE_PACK,
      NEXT_PUBLIC_CHECKOUT_RETURN_URL,
      NEXT_PUBLIC_CHECKOUT_CANCEL_URL,
    } = process.env;

    // --- Env sanity checks
    if (!STRIPE_SECRET_KEY) {
      return NextResponse.json({ ok: false, error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
    }
    if (!STRIPE_PRICE_ONE || !STRIPE_PRICE_PACK) {
      return NextResponse.json({ ok: false, error: "Missing Stripe price IDs" }, { status: 500 });
    }
    if (!NEXT_PUBLIC_CHECKOUT_RETURN_URL || !NEXT_PUBLIC_CHECKOUT_CANCEL_URL) {
      return NextResponse.json({ ok: false, error: "Missing checkout return/cancel URLs" }, { status: 500 });
    }

    // --- Parse/validate body
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const priceId  = String(body.priceId || "").trim();
    const quantity = Math.max(1, Number(body.quantity || 1));
    const userId   = typeof body.userId === "string" ? body.userId : "";
    const email    = typeof body.email === "string" ? body.email : "";

    // Only allow your two known prices for safety
    const allowed = new Set([STRIPE_PRICE_ONE, STRIPE_PRICE_PACK]);
    if (!allowed.has(priceId)) {
      return NextResponse.json({ ok: false, error: "Unknown or disallowed priceId" }, { status: 400 });
    }

    // --- Create Stripe Checkout Session via REST
    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("success_url", NEXT_PUBLIC_CHECKOUT_RETURN_URL);
    form.set("cancel_url", NEXT_PUBLIC_CHECKOUT_CANCEL_URL);
    form.set("line_items[0][price]", priceId);
    form.set("line_items[0][quantity]", String(quantity));

    // Nice-to-have: let Stripe send receipt + show email prefilled
    if (email) form.set("customer_email", email);

    // Metadata to help you reconcile in webhook
    if (userId) form.set("metadata[userId]", userId);
    if (email)  form.set("metadata[email]", email);

    // (Optional) statement descriptor suffix or other settings could go here

    const resp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
      cache: "no-store",
    });

    const text = await resp.text();
    let data = null;
    try { data = JSON.parse(text); } catch { /* keep raw text for error clarity */ }

    if (!resp.ok || !data?.url) {
      const err = data?.error?.message || text || `HTTP ${resp.status}`;
      return NextResponse.json({ ok: false, error: `Stripe error: ${err}` }, { status: 502 });
    }

    return NextResponse.json({ ok: true, url: data.url }, { status: 200 });
  } catch (e) {
    console.error("Stripe checkout error:", e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

// Explicit GET -> 405 (helps catch accidental GETs)
export async function GET() {
  return NextResponse.json({ ok: false, error: "Method Not Allowed" }, { status: 405 });
}