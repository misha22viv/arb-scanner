// Read-only, same-origin proxy for the public BetScoper API.
// Allowed resources only: bookmakers, matches, odds for a match slug.
// No bookmaker credentials, account access, bet placement, or arbitrary URLs.

const BASE = "https://betscoper.ru/api/v1/";

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const { resource } = req.query;
  const params = new URLSearchParams();

  let path;
  if (resource === "bookmakers") {
    path = "bookmakers";
  } else if (resource === "matches") {
    path = "matches";
    const allowed = ["sport", "status", "per_page", "page"];
    for (const key of allowed) {
      const value = req.query[key];
      if (typeof value === "string" && value.length <= 80) params.set(key, value);
    }
    if (!params.has("status")) params.set("status", "scheduled");
    if (!params.has("per_page")) params.set("per_page", "50");
  } else if (resource === "odds") {
    const slug = req.query.slug;
    if (typeof slug !== "string" || !/^[a-zA-Z0-9_-]{1,160}$/.test(slug)) {
      return res.status(400).json({ error: "invalid_match_slug" });
    }
    path = `matches/${slug}/odds`;
  } else {
    return res.status(400).json({
      error: "invalid_resource",
      allowed: ["bookmakers", "matches", "odds"]
    });
  }

  const url = BASE + path + (params.size ? "?" + params.toString() : "");

  try {
    const upstream = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", "User-Agent": "ARB-Scanner/1.0 (read-only)" }
    });
    const body = await upstream.text();
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    res.setHeader("X-Upstream-Status", String(upstream.status));
    return res.status(upstream.status).send(body);
  } catch (error) {
    return res.status(502).json({
      error: "upstream_fetch_failed",
      message: String(error),
      upstream: "betscoper.ru"
    });
  }
};
