module.exports = (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    ok: true,
    service: "arb-scanner",
    mode: "read-only",
    provider: "BetScoper",
    bookmakerAccounts: false,
    betPlacement: false
  });
};
