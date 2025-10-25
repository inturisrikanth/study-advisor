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
      NEXT_PUBLIC_SITE_URL,            // optional (explicit domain)
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
    const isBundle = raw === "bundle" || raw === "pack";
    const priceId  = isBundle ? STRIPE_PRICE_PACK : STRIPE_PRICE_ONE;
    const credits  = isBundle ? 4 : 1;
    const priceKind = isBundle ? "bundle" : "single";

    const userId = typeof body.userId === "string" ? body.userId : "";
    const email  = typeof body.email === "string" ? body.email : "";

    // ===== Build return URLs (never fall back to /docs/app.html) =====
    // Prefer explicit site URL; otherwise derive from this request.
    const reqUrl = new URL(req.url);
    const derivedOrigin = `${reqUrl.protocol}//${reqUrl.host}`;
    const origin = (NEXT_PUBLIC_SITE_URL && NEXT_PUBLIC_SITE_URL.trim())
      ? NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
      : derivedOrigin;

    // Only trust env overrides if they point to our new routes
    const envSuccessValid = (NEXT_PUBLIC_CHECKOUT_RETURN_URL || "").includes("/checkout/success");
    const envCancelValid  = (NEXT_PUBLIC_CHECKOUT_CANCEL_URL || "").includes("/checkout/cancel");

    const successUrl = envSuccessValid
      ? NEXT_PUBLIC_CHECKOUT_RETURN_URL
      : `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;

    const cancelUrl = envCancelValid
      ? NEXT_PUBLIC_CHECKOUT_CANCEL_URL
      : `${origin}/checkout/cancel`;

    // Create Checkout Session via Stripe API
    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("success_url", successUrl);
    form.set("cancel_url", cancelUrl);
    form.set("line_items[0][price]", priceId);
    form.set("line_items[0][quantity]", "1");
    if (email) form.set("customer_email", email);

    // Metadata for webhook / reconciliation
    if (userId) form.set("metadata[user_id]", userId);
    if (email)  form.set("metadata[email]", email);
    form.set("metadata[priceKind]", priceKind);
    form.set("metadata[credits]", String(credits));

    // Helpful logs (check Vercel logs if needed)
    console.log("[checkout] origin:", origin);
    console.log("[checkout] success_url:", successUrl);
    console.log("[checkout] cancel_url:", cancelUrl);

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
