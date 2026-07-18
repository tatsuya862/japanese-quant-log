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
  const { request } = context;
  const url = new URL(request.url);

  if (LEGACY_MEMBER_PATHS.has(url.pathname)) {
    return redirect("/index.html");
  }

  if (url.pathname === "/api/create-checkout-session" || url.pathname === "/api/create-portal-session") {
    return jsonResponse({ error: "Paid membership registration has ended." }, 410);
  }

  return context.next();
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
