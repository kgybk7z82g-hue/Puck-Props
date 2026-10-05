# Puck Props update validation — October 2, 2026

## Changes

- Navy/black, electric-blue and silver hockey identity, including the SVG app icon, header, cards, forms, navigation and PWA colors. Original generated image attachments were not retrievable from the referenced conversation; the SVG implements its requested visual direction.
- Navigation: Scores, Daily Picks, Daily Parlays, Matchup History, Teams, Player Stats. Scores remains the initial view.
- Removed Saved Players navigation, section, save button, rendering and storage logic; the old shortlist storage key is deleted on startup where browser storage is available.
- Branded startup screen with readiness retries, progress indicator, reduced-motion support and an Open dashboard escape.
- Cached installed app shell can display immediately while Render wakes; API data is not cached by the service worker. Cache cleanup affects only Puck Props caches.
- Fixed blank standings when preloaded on Scores, guarded browser-storage cleanup, refreshed score/standings requests, restored button labels across concurrent refreshes and prevented older score-date responses from replacing the selected date.

## Verification

`node --check app.js`, `node --check server.js`, and `node --check sw.js` passed. `npm test` runs the included dependency-free Node server regression test.

Browser checks ran in headless Microsoft Edge with representative NHL-shaped fixtures:

- Exact navigation order, Scores default, and absence of Saved Players controls.
- Score cards, matchup details, goalie report rendering, player box scores, back navigation, and no-game slate.
- Daily Picks build and all three prop switches, with 10 qualifying entries per list.
- Daily Parlays generation, plus a separate diversified model-input check that produces all five return bands. A slate may produce fewer than five valid combinations.
- Player suggestions and statistics; matchup selection and all five history windows.
- 32-club directory, directory search, standings filter, roster, player profile, last-10 table, defense splits, special-stat leaders and back navigation.
- All six views at widths 1440, 768, 390 and 320; no document-level horizontal overflow. Tables and navigation scroll within their containers.
- Delayed health readiness, branded startup, unavailable browser storage, score-date response race and upstream analytics error handling.
- Service-worker installation, unrelated-cache preservation, API exclusion, and offline cached-shell loading with the dashboard escape.
- No uncaught browser exceptions during these checks. Startup and mobile page screenshots were visually inspected.

The server test exercises static assets, health, search, all allowed NHL proxy route families, goalies, team defense and special stats using simulated upstream responses. It also checks invalid routes, methods, unavailable upstreams, preserved upstream error status, security headers and the legacy odds endpoint's missing-key validation.

## External limits

Initial sandboxed live requests produced controlled HTTP 502 errors. After enabling network access, live checks passed: five scoreboards games, 32 standings records, player search, Toronto roster, Connor McDavid career statistics and an 82-game season log, team schedule, player box score and Daily Faceoff goalie report. Live browser checks also loaded Connor McDavid's Toronto matchup history (two meetings across the last two seasons), a roster player's last 10 games, current-season defensive splits, empty-net/goalie-pull leaders with shift-chart coverage, Daily Picks across 223 skaters and five Daily Parlays across 89 recent game boxes. No uncaught browser exceptions occurred.

The legacy odds endpoint's authenticated success path was not tested because the visible parlay feature uses NHL statistics and no paid odds credentials were provided. Daily Faceoff parsing depends on its embedded page data remaining compatible. Historical coverage, incomplete feeds and small samples may limit research output; future upstream availability is not guaranteed. No paid API account or credentials were used.

Daily Picks continues to use 50% last-10 form, 30% current-season history and 20% previous-season history, reweighting available components. Opponent history and defense splits are shown as context; they do not adjust the displayed hit-rate estimate. The app retrieves growing NHL histories on demand and uses memory caches; it does not maintain a durable season database. Daily Parlays currently evaluates recent team/player histories with current/previous-season context.

Render controls the waiting page shown before a sleeping free web service serves a first visit. The application cannot replace that platform page. Returning users with the new service worker installed receive the branded cached shell while the server wakes. First visits, cleared browser caches or unavailable service workers may still show Render's page. See https://render.com/docs/free#spinning-down-on-idle.

## Render update

The existing Node start command and health route are preserved. Deploy the new commit from `main` through the existing Render service. This work did not change Render settings or trigger deployment explicitly. Close and reopen existing app tabs after deployment so the updated service worker can activate. The first visit installs the refreshed app shell; subsequent visits can use the branded wake screen.


## October 5, 2026 — daily research and same-game parlays

- Regeneration fetches a fresh scoreboard and accepts only FUT/PRE games with a known future start time. Status and clock are checked again after research; changing the date cannot publish the old slate.
- Player estimates now blend smoothed last-10 form (40%), current season (30%), previous season (20%), and opponent history (up to 10%, reduced for fewer than five meetings). Missing components are reweighted. Both daily features use these inputs; team estimates also use both seasons and opponent results.
- Same-game cards evaluate every remaining fixture. They select two distinct players on the same team, each with at least 60% marginal model probability and ten historical games. At least ten shared games are required; joint hits are smoothed toward the marginal product with eight pseudo-games. The highest estimated joint probability in the 2–4 decimal-return range is chosen. No qualifying combination yields an explicit explanation rather than a forced pick.
- Full player game logs replace recent-team-box-derived histories. Parlay markets are shots and points; blocked shots are omitted because regular-season player logs do not reliably provide that field. Defense splits remain context rather than an uncalibrated ranking adjustment.
- Shell cache version advanced to v27.

Validation: application/service-worker syntax checks and all four Node tests passed (server regression plus eligibility, opponent-history weighting, and same-game joint-result checks). Live sportsbook pricing, live browser rendering and model calibration/backtesting were not verified. Returns remain estimated fair-value multiples, not executable sportsbook odds. This heuristic cannot establish that a parlay is safe or profitable.


## October 5, 2026 — external win-probability average

- Added `/api/win-projections/YYYY-MM-DD` with adapters for MoneyPuck date-specific preview rows, PuckCast public matchup cards, and PodiumOracle's public NHL page JSON. Only pregame model probabilities are used; bookmaker/market probabilities and MoneyPuck live or deserve-to-win meters are excluded.
- External sources have equal weight, one contribution per provider. Home/away probabilities must be finite, between zero and one, and sum to approximately one. NHL IDs and team orientation must match; PodiumOracle's different ID scheme is matched by both teams and start time within two hours. Missing, malformed, ambiguous and different-day fixtures are omitted, without inventing probabilities.
- Matchup details show the average, source count, linked individual home-win estimates, retrieval time and source disagreement. A single available provider is explicitly labeled. The local scoring estimate remains the fallback; it is not silently included as another external source. Parlay team-win legs use the same external average when available.
- Public pages are cached server-side for five minutes (one minute after provider failure), with bounded date cache entries. Provider errors do not fail the other feeds. No credentials or paid downloads are used. Page formats may change; failures fall back rather than block the dashboard.
- Shell version advanced to v28.

Validation: seven Node tests passed, including observed provider-format fixtures, probability orientation, aliases, averaging, duplicate rejection, different-date rejection, source failure and endpoint routing. Syntax checks passed. A live October 5 check matched all four NHL fixtures to MoneyPuck and PodiumOracle, giving two-source averages. PuckCast returned October 4 fixture IDs, which were excluded. The Philadelphia at Tampa Bay home-win average was 64.035% at retrieval. These are observational integration checks, not evidence of forecast calibration or profitability. Browser layout was not verified in this update.

Sources: https://moneypuck.com/about.htm, https://puckcast.ai/, https://podiumoracle.com/nhl. Provider fixtures contain only small relevant page fragments used for parser regression checks.


## October 5, 2026 — separate Same Game Parlays tab

Moved matchup parlay cards into a dedicated SGP (Same Game Parlays) tab immediately after Daily Parlays. The new panel has its own date selector, refresh button and status display. Dates and research requests are shared between both parlay panels; both refresh buttons show progress during a shared request. Existing matchup eligibility and estimates are preserved. Shell version advanced to v29.

Validation: application syntax, all seven regression tests, navigation order, separate output placement, required controls and unique HTML IDs passed. Browser visual inspection was not performed for this small layout change.


## October 5, 2026 — SGP target around 3.0

SGP candidates now qualify within 2.5–3.5 estimated decimal return and are selected by distance from 3.0, with higher estimated probability breaking exact ties. Existing individual probability and shared-history requirements remain. UI copy and shell version (v30) updated. Syntax checks and eight regression tests passed, including a check that a closer-to-three candidate wins over a higher-probability lower-return candidate. Returns remain model estimates rather than sportsbook prices.


## October 5, 2026 — broader SGP coverage

SGP now searches 1+, 2+, and 3+ shots plus 1+ point, across combinations of two to four distinct players. SGP receives the full candidate set rather than the daily-parlay top-12 cut. Within each team a bounded 32-candidate search prefers shared-history estimates (ten or more common games, then three or more). Selection targets 3.0; an outside-range estimate is displayed with a label rather than rejected. If no shared-history combination exists, a labeled approximation multiplies individual hit rates; it does not claim to measure same-game correlation. No player data or fewer than two supported players still prevents an estimate. Existing cross-game daily-parlay market thresholds are preserved.

Current-season player logs are refreshed on generation in both picks and parlays so newly completed results are included on later days. Historical inputs exclude the selected slate date, preventing results from that slate influencing earlier pregame estimates. Shell version v31.

Validation: ten regression tests and application syntax checks passed, covering outside-target output, limited samples, independent fallback, multi-leg targeting, duplicate-player avoidance and missing-data handling. Live verification of October 5 coverage could not be completed: the NHL scoreboard and roster endpoints returned HTTP 429. All-game output is therefore conditional on upstream histories being available; no invented history or guaranteed accuracy is claimed.


## October 5, 2026 — SGP target near 4.0

Changed the SGP target from 3.0 to 4.0 estimated decimal return, with a 3.5–4.5 target window. The closest supported outside-window option still appears with a label. Shared-history requirements and fallback behavior remain. Updated UI copy, target regression fixtures and shell version (v32). Application syntax and ten regression tests passed.


## October 5, 2026 — prominent player roles for prop projections

Daily Picks, Daily Parlays and SGPs now restrict player props to each team's six highest-average-ice-time forwards and three highest-average-ice-time defensemen. Ranking uses the latest five available regular-season game records, requires at least three valid positive MM:SS ice-time values, and excludes goalies/unknown positions. Roster injury-reserve flags are excluded when provided. The shortlist applies before prop ranking and every SGP fallback, so depth skaters cannot re-enter just to achieve target odds. Results show the estimated role and average recent minutes. This is an ice-time proxy for prominent roles, not verified line assignments or bet365 market availability. Missing role data may reduce coverage.

Validation: application syntax and twelve regression tests passed. New checks cover per-team forward/defense limits, depth-player exclusion despite strong shot totals, recent form versus old ice time, and missing/malformed ice time. Live bet365 availability and browser rendering were not verified. Shell version advanced to v33.
