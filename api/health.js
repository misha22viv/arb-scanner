module.exports = (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(200).json({
    ok: true,
    service: "arb-scanner",
    mode: "read-only",
    provider: "BetScoper",
    capabilities: ["bookmakers", "scheduled_matches", "match_odds"],
    bookmakerAccounts: false,
    betPlacement: false,
    checkedAt: new Date().toISOString()
  });
};
