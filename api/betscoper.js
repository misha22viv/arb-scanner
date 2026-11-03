// Read-only, allowlisted proxy for the public BetScoper API.
// No arbitrary upstream URLs, bookmaker credentials, account access or bet placement.
const BASE = "https://betscoper.ru/api/v1/";
const ALLOWED_SPORTS = new Set(["football","hockey","basketball","tennis","volleyball","esports"]);
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate=40");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  const resource = typeof req.query.resource === "string" ? req.query.resource : "";
  const params = new URLSearchParams();
  let path;
  if (resource === "bookmakers") {
    path = "bookmakers";
  } else if (resource === "matches") {
    path = "matches";
    const sport = typeof req.query.sport === "string" ? req.query.sport.toLowerCase() : "";
    if (sport && ALLOWED_SPORTS.has(sport)) params.set("sport", sport);
    const status = typeof req.query.status === "string" && ["scheduled","live","finished"].includes(req.query.status) ? req.query.status : "scheduled";
    params.set("status", status);
    const perPage = Math.min(50, Math.max(1, Number.parseInt(req.query.per_page, 10) || 20));
    const page = Math.min(100, Math.max(1, Number.parseInt(req.query.page, 10) || 1));
    params.set("per_page", String(perPage));
    params.set("page", String(page));
  } else if (resource === "odds") {
    const slug = req.query.slug;
    if (typeof slug !== "string" || !/^[a-zA-Z0-9_-]{1,160}$/.test(slug)) {
      return res.status(400).json({ error: "invalid_match_slug" });
    }
    path = "matches/" + slug + "/odds";
  } else {
    return res.status(400).json({ error: "invalid_resource", allowed: ["bookmakers","matches","odds"] });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const upstream = await fetch(BASE + path + (params.size ? "?" + params.toString() : ""), {
      method: "GET",
      headers: { Accept: "application/json", "User-Agent": "ARB-Scanner/1.0 (read-only)" },
      signal: controller.signal
    });
    const body = await upstream.text();
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    res.setHeader("X-Upstream-Status", String(upstream.status));
    res.setHeader("X-Data-Received-At", new Date().toISOString());
    return res.status(upstream.status).send(body);
  } catch (error) {
    const timedOut = error && error.name === "AbortError";
    return res.status(timedOut ? 504 : 502).json({
      error: timedOut ? "upstream_timeout" : "upstream_fetch_failed",
      message: timedOut ? "The data provider did not respond within 12 seconds." : String(error),
      upstream: "betscoper.ru"
    });
  } finally {
    clearTimeout(timeout);
  }
};
