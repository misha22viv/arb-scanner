/**
 * ARB Scanner — read-only API proxy
 * Deploy this file as the Cloudflare Worker entry point.
 *
 * Routes:
 *   GET /health
 *   GET /api/v1/<BetScoper endpoint>?<query>
 *
 * No bookmaker login, credentials, bet placement, or paid services.
 */
const UPSTREAM = "https://betscoper.ru";
const ALLOWED_PREFIX = "/api/v1/";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "*";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== "GET") {
      return new Response(JSON.stringify({ error: "method_not_allowed" }), {
        status: 405,
        headers: { ...cors, "Content-Type": "application/json; charset=utf-8" }
      });
    }

    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "arb-scanner-proxy",
        upstream: "betscoper.ru",
        readOnly: true
      }, { headers: cors });
    }

    if (!url.pathname.startsWith(ALLOWED_PREFIX)) {
      return Response.json({
        error: "not_found",
        hint: "Use /api/v1/<endpoint> or /health"
      }, { status: 404, headers: cors });
    }

    // Restrict paths to the documented API namespace; never accept arbitrary URLs.
    const upstreamUrl = new URL(url.pathname + url.search, UPSTREAM);

    try {
      const upstream = await fetch(upstreamUrl.toString(), {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "User-Agent": "ARB-Scanner/1.0 (read-only)"
        },
        cf: { cacheTtl: 30, cacheEverything: true }
      });

      const body = await upstream.text();
      const headers = new Headers(cors);
      headers.set("Content-Type", upstream.headers.get("Content-Type") || "application/json; charset=utf-8");
      headers.set("Cache-Control", "public, max-age=15");
      headers.set("X-Proxy-Upstream-Status", String(upstream.status));

      return new Response(body, { status: upstream.status, headers });
    } catch (error) {
      return Response.json({
        error: "upstream_fetch_failed",
        message: String(error),
        upstream: upstreamUrl.host
      }, { status: 502, headers: cors });
    }
  }
};
