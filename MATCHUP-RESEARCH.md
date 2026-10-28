# Shared matchup research

Daily props and player legs in daily parlays and SGPs now use the same context loader and evaluator. Defense is loaded before ranking, with a cutoff before the selected slate date. Position splits measure totals allowed to a position group per team game, not an individual player's expected output.

Research order is historical probability plus 0.02 times contextual support:

- Position allowance relative to the available slate teams: clamp(4 × (allowance / average − 1), −1, 1). Requires five completed games and at least four qualifying teams for comparison. This is a slate comparison, not a league baseline.
- Relative back-to-back: +0.5 when only the opponent played yesterday; −0.5 when only the player's team did.
- Observed overnight arrival: +0.25 for the opponent, −0.25 for the player's team. Requires verified rest histories, a landed flight before the snapshot within 24 hours of puck drop, and an exact next-fixture match.

These are experimental ranking weights, not fitted probability adjustments. Daily picks rank by this research score; daily parlay player shortlists use it; SGPs average support across legs when comparing candidates within the return target. Outside the target, the closest historical estimated return remains the priority. Historical probabilities and joint-history calculations remain unchanged.

Recovery opportunity subtracts an assumed one-hour transfer and two-hour wind-down from landing-to-puck-drop time. It does not estimate actual sleep. Missing inputs stay unknown and contribute no support. Each card exposes supporting and conflicting evidence, missing data, and snapshot time.

Goalie identity/status and external win projections are evidence only; their effects have not been calibrated. Confirmed lines, power-play assignments, live sportsbook prices and team-win legs within SGPs remain future work. Current SGPs still contain player props. This change does not establish improved prediction accuracy or betting value.

Before fitting probability adjustments, store pregame snapshots, quoted prices and outcomes, then evaluate later games with chronological training/testing splits. Compare calibration and predictive loss against the historical-only baseline, including removal of each context feature in turn. Preserve unknown data and overlapping rest/arrival factors rather than counting them as independent evidence.
