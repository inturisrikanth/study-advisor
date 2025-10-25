// app/api/checkout/route.js
import { NextResponse } from "next/server";

/**
 * POST /api/checkout
 * Body: { which?: "single" | "bundle", userId?: string, email?: string }
 * Returns: { ok: true, url } on success
 */
export async function POST(req) {
  try {
    const {
      STRIPE_SECRET_KEY,
      STRIPE_PRICE_ONE,
      STRIPE_PRICE_PACK,
      NEXT_PUBLIC_CHECKOUT_RETURN_URL, // optional override
      NEXT_PUBLIC_CHECKOUT_CANCEL_URL, // optional override
      NEXT_PUBLIC_SITE_URL,            // optional (e.g. prod domain)
    } = process.env;

    if (!STRIPE_SECRET_KEY) {
      return NextResponse.json({ ok: false, error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
    }
    if (!STRIPE_PRICE_ONE || !STRIPE_PRICE_PACK) {
      return NextResponse.json({ ok: false, error: "Missing Stripe price IDs (STRIPE_PRICE_ONE / STRIPE_PRICE_PACK)" }, { status: 500 });
    }

    // Parse body safely
    let body = {};
    try { body = await req.json(); } catch { body = {}; }

    // Accept either `which` ("single" | "bundle") or legacy `plan` ("one" | "pack")
    const raw = (body.which || body.plan || "").toString().toLowerCase();
    const which = raw === "bundle" || raw === "pack" ? "bundle" : "single";

    const userId = typeof body.userId === "string" ? body.userId : "";
    const email  = typeof body.email === "string" ? body.email : "";

    // Price mapping
    const isBundle = which === "bundle";
    const priceId  = isBundle ? STRIPE_PRICE_PACK : STRIPE_PRICE_ONE;
    const quantity = 1;           // bundle is priced as 1 line item
    const credits  = isBundle ? 4 : 1;
    const priceKind = isBundle ? "bundle" : "single";

    // ===== Build return URLs =====
    // Prefer explicit site URL if provided; otherwise derive from the request.
    const reqUrl = new URL(req.url);
    const origin = (NEXT_PUBLIC_SITE_URL && NEXT_PUBLIC_SITE_URL.trim())
      ? NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
      : `${reqUrl.protocol}//${reqUrl.host}`;

    // If env overrides are present, use them; otherwise default to our Next routes.
    const successUrl = (NEXT_PUBLIC_CHECKOUT_RETURN_URL && NEXT_PUBLIC_CHECKOUT_RETURN_URL.trim())
      ? NEXT_PUBLIC_CHECKOUT_RETURN_URL
      : `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;

    const cancelUrl = (NEXT_PUBLIC_CHECKOUT_CANCEL_URL && NEXT_PUBLIC_CHECKOUT_CANCEL_URL.trim())
      ? NEXT_PUBLIC_CHECKOUT_CANCEL_URL
      : `${origin}/checkout/cancel`;

    // Create Checkout Session via Stripe API
    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("success_url", successUrl);
    form.set("cancel_url", cancelUrl);
    form.set("line_items[0][price]", priceId);
    form.set("line_items[0][quantity]", String(quantity));

    if (email) form.set("customer_email", email);

    // Metadata for webhook / reconciliation
    if (userId) form.set("metadata[user_id]", userId);
    if (email)  form.set("metadata[email]", email);
    form.set("metadata[priceKind]", priceKind);
    form.set("metadata[credits]", String(credits));

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
    try { data = JSON.parse(text); } catch {}

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

export async function GET() {
  return NextResponse.json({ ok: false, error: "Method Not Allowed" }, { status: 405 });
}
