# ARB Scanner: data contract and current implementation

## Current state

- The independent Fonbet and Winline adapters are isolated normalization modules, not connected collectors.
- No requests are sent to bookmaker websites by these adapters. A permitted public feed or written authorization must be configured before collection is enabled.
- BetScoper remains a separately labelled fallback provider.
- The current browser history is local to one browser/device (localStorage); it is not a central database or durable server-side archive.
- Browser notifications are available only while the browser can run the page and the user grants permission.
- The current odds parser intentionally supports only explicit full-time 1X2 and two-way moneyline rows. Totals, handicaps, periods, and unknown market formats are rejected rather than guessed.

## Canonical event

ArbCore.normalizeEvent(source, provider) returns:

- schema: schema version
- provider: source identifier
- sourceEventId: source event ID / slug
- sport, league: normalized labels
- home, away: normalized team labels
- startTime: epoch milliseconds or null
- status: source status
- raw: original object for diagnostics

Cross-provider matching requires both teams, sport, league and start time. It checks same-orientation and reversed-orientation team names, requires league similarity, and rejects events more than 90 minutes apart by default. A reversed match is reported as swapped: true; outcomes must be remapped with ArbCore.remapOutcome before comparing selections.

## Canonical odds row

ArbCore.normalizeOddsRows(rows, provider) returns rows with:

- provider, book
- market: market + period + line + settlement identity
- outcome: home, draw, or away
- odd: decimal odds greater than 1
- active: false for suspended/closed/unavailable source rows
- updatedAt: source timestamp when present
- raw: original row

## Arbitrage rules

- 1X2 requires all three outcomes.
- Two-way moneyline requires both opposing outcomes.
- A market is accepted only when its period, line and settlement identity match.
- Suspended rows are excluded.
- At least two different bookmakers must contribute the best available outcomes.
- Stake allocation is proportional to inverse odds. ROI is (1 / sum(1/odds) - 1) * 100.
- A calculated arbitrage is an arithmetic result, not a guarantee: limits, void rules, delays, taxes and odds movement can invalidate it.

## History and alerts

ArbHistory stores snapshots in browser-local storage, compares each event with its prior snapshot, and can notify the user when an existing quote changes. Clearing browser data or changing devices removes access to that local history.

## Tests

Run the dependency-free test file with:

    node test/arb-core.test.js

The GitHub Actions workflow .github/workflows/arb-core-tests.yml runs the same command on pushes to the feature branch.
