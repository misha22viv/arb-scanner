module.exports = (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(200).json({
    ok: true,
    service: "arb-scanner",
    mode: "read-only",
    primaryProvider: "Fonbet + Winline public sources",
    primaryProviderStatus: "not_connected_or_verified",
    fallbackProvider: "BetScoper",
    fallbackProviderStatus: "documentation_known_live_payload_unverified",
    capabilities: ["event_normalization", "conservative_arbitrage_engine", "manual_calculator", "fallback_bookmakers", "fallback_matches", "fallback_match_odds"],
    bookmakerAccounts: false,
    betPlacement: false,
    checkedAt: new Date().toISOString()
  });
};
