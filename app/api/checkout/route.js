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
      NEXT_PUBLIC_CHECKOUT_RETURN_URL,
      NEXT_PUBLIC_CHECKOUT_CANCEL_URL,
    } = process.env;

    if (!STRIPE_SECRET_KEY) {
      return NextResponse.json({ ok: false, error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
    }
    if (!STRIPE_PRICE_ONE || !STRIPE_PRICE_PACK) {
      return NextResponse.json({ ok: false, error: "Missing Stripe price IDs" }, { status: 500 });
    }
    if (!NEXT_PUBLIC_CHECKOUT_RETURN_URL || !NEXT_PUBLIC_CHECKOUT_CANCEL_URL) {
      return NextResponse.json({ ok: false, error: "Missing checkout return/cancel URLs" }, { status: 500 });
    }

    let body = {};
    try { body = await req.json(); } catch { body = {}; }

    // Accept either `which` ("single" | "bundle") or legacy `plan` ("one" | "pack")
    const raw = (body.which || body.plan || "").toString().toLowerCase();
    const which = raw === "bundle" || raw === "pack" ? "bundle" : "single";

    const userId = typeof body.userId === "string" ? body.userId : "";
    const email  = typeof body.email === "string" ? body.email : "";

    // Map to price, quantity, and explicit credits for the webhook
    const isBundle = which === "bundle";
    const priceId = isBundle ? STRIPE_PRICE_PACK : STRIPE_PRICE_ONE;
    // IMPORTANT: if STRIPE_PRICE_PACK is a “4 credits” bundle price, quantity stays 1
    const quantity = 1;
    const credits = isBundle ? 4 : 1;
    const priceKind = isBundle ? "bundle" : "single";

    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("success_url", NEXT_PUBLIC_CHECKOUT_RETURN_URL);
    form.set("cancel_url", NEXT_PUBLIC_CHECKOUT_CANCEL_URL);
    form.set("line_items[0][price]", priceId);
    form.set("line_items[0][quantity]", String(quantity));

    if (email) form.set("customer_email", email);

    // Metadata used by the webhook
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