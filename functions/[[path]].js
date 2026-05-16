const STRIPE_API_BASE = "https://api.stripe.com/v1";

const API_PATHS = new Set([
  "/api/create-checkout-session",
  "/api/create-portal-session"
]);

const LEGACY_MEMBER_PATHS = new Set([
  ["r", "e", "g", "i", "s", "t", "e", "r"],
  ["l", "o", "g", "i", "n"],
  ["l", "o", "g", "o", "u", "t"],
  ["a", "c", "c", "o", "u", "n", "t"],
  ["f", "o", "r", "g", "o", "t", "-", "p", "a", "s", "s", "w", "o", "r", "d"],
  ["r", "e", "s", "e", "t", "-", "p", "a", "s", "s", "w", "o", "r", "d"],
  ["v", "e", "r", "i", "f", "y", "-", "e", "m", "a", "i", "l"],
  ["r", "e", "s", "e", "n", "d", "-", "v", "e", "r", "i", "f", "i", "c", "a", "t", "i", "o", "n"]
].map((parts) => `/${parts.join("")}`));

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (LEGACY_MEMBER_PATHS.has(url.pathname)) {
    return redirect("/index.html#pricing");
  }

  if (!API_PATHS.has(url.pathname)) {
    return context.next();
  }

  if (url.pathname === "/api/create-checkout-session") {
    return createCheckoutSession(request, env, url);
  }

  return createPortalSession(request, env);
}

async function createCheckoutSession(request, env, url) {
  if (request.method.toUpperCase() !== "POST") {
    return jsonResponse({ error: "POST method required." }, 405);
  }

  const secretKey = env.STRIPE_SECRET_KEY;
  const priceId = env.STRIPE_PRICE_ID_MONTHLY;
  if (!secretKey || !priceId) {
    return jsonResponse({
      error: "Stripe is not configured. Required env vars: STRIPE_SECRET_KEY, STRIPE_PRICE_ID_MONTHLY, STRIPE_SUCCESS_URL, STRIPE_CANCEL_URL."
    }, 503);
  }

  const successUrl = env.STRIPE_SUCCESS_URL || `${url.origin}/success.html?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = env.STRIPE_CANCEL_URL || `${url.origin}/cancel.html`;
  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("line_items[0][price]", priceId);
  params.set("line_items[0][quantity]", "1");
  params.set("success_url", successUrl);
  params.set("cancel_url", cancelUrl);
  params.set("allow_promotion_codes", "true");
  params.set("billing_address_collection", "auto");
  params.set("metadata[service]", "quant-log-paid-membership");

  try {
    const response = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
      method: "POST",
      headers: {
        "authorization": `Bearer ${secretKey}`,
        "content-type": "application/x-www-form-urlencoded"
      },
      body: params
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.url) {
      console.error("stripe_checkout_error", data && data.error ? data.error.type : response.status);
      return jsonResponse({ error: "Could not prepare the payment page." }, 502);
    }
    return jsonResponse({ url: data.url });
  } catch (error) {
    console.error("stripe_checkout_fetch_error", error && error.name ? error.name : "Error");
    return jsonResponse({ error: "Could not prepare the payment page." }, 502);
  }
}

async function createPortalSession(request, env) {
  if (request.method.toUpperCase() !== "POST") {
    return jsonResponse({ error: "POST method required." }, 405);
  }

  const secretKey = env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return jsonResponse({ error: "Stripe Customer Portal is not configured." }, 503);
  }

  let payload = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const customerId = typeof payload.customerId === "string" ? payload.customerId.trim() : "";
  if (!customerId) {
    return jsonResponse({
      error: "Customer ID is required until Stripe customer mapping is connected."
    }, 400);
  }

  const returnUrl = env.STRIPE_PORTAL_RETURN_URL || env.STRIPE_SUCCESS_URL || new URL("/index.html#faq", request.url).toString();
  const params = new URLSearchParams();
  params.set("customer", customerId);
  params.set("return_url", returnUrl);

  try {
    const response = await fetch(`${STRIPE_API_BASE}/billing_portal/sessions`, {
      method: "POST",
      headers: {
        "authorization": `Bearer ${secretKey}`,
        "content-type": "application/x-www-form-urlencoded"
      },
      body: params
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.url) {
      console.error("stripe_portal_error", data && data.error ? data.error.type : response.status);
      return jsonResponse({ error: "Could not prepare the billing management page." }, 502);
    }
    return jsonResponse({ url: data.url });
  } catch (error) {
    console.error("stripe_portal_fetch_error", error && error.name ? error.name : "Error");
    return jsonResponse({ error: "Could not prepare the billing management page." }, 502);
  }
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function redirect(path) {
  return new Response(null, {
    status: 302,
    headers: {
      "location": path,
      "cache-control": "no-store"
    }
  });
}
