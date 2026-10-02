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
