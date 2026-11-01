# Pregame Disruption Watch

Open **Travel & Fatigue** to scan the entire NHL or select one team. The report watch works independently of flight tracking. It refreshes every five minutes while the tab is visible; the server caches successful searches for five minutes and retries partial failures after one minute. It is an on-demand watch, not a background notification service.

Coverage includes Google News travel and arrival searches, eight groups covering all 32 team names, Bing search feeds, and a separate search for indexed public social posts. Search terms cover weather, mechanical issues, customs, stranded teams, cancellations, diversions, late arrivals and morning skates. Team-specific searches narrow this coverage. Direct searches for X, Bluesky, Reddit, Google News and indexed social posts are provided for manual follow-up.

RSS titles and available excerpts are screened for travel and disruption language. Reports retain source links, publisher metadata where supplied, publication time, categories and teams mentioned. Repeated normalized headlines are combined, retaining different source URLs. Search-provider coverage and failures are visible. Upcoming NHL games within 48 hours are shown for context. No source credentials or extra packages are required.

## Limits

- The 72-hour window refers to publication time, not the incident date. Recently published historical stories can appear.
- Every result is an **unverified search lead**. Searches cannot establish which team was delayed, the incident date, delay duration, hotel arrival or impact on player performance. Team mentions can refer to an opponent.
- Sources can omit publication dates; undated and out-of-window results are excluded. Search engines can omit posts, lag behind new reports, limit results or become unavailable. This is not exhaustive internet coverage.
- Social platforms are not directly ingested. Sign-in-only, private, deleted and unindexed posts and broadcast-only information may be missed. Use the direct social-search links to inspect reporters' posts.
- Different headlines can describe the same event. Weather forecasts are not evidence of a team delay. Headlines and excerpts can contain historical, speculative or negated statements: read the source before acting.
- Upcoming games are context, not confirmed incident-to-game matches. The watch does not change fatigue scores, probabilities or picks.

## Endpoint and checks

`GET /api/disruptions` scans the league. `GET /api/disruptions?team=COL` scans one team. Unknown team codes return HTTP 400. Individual source failures produce a partial-coverage response rather than silently implying normal travel. Upstream requests have 12-second timeouts; at most six feeds are fetched concurrently and concurrent requests for the same scope share work.

Run `node --test tests/*.test.cjs`, `node --check app.js`, `node --check server.js` and `node --check disruptions.js`. The new tests cover feed parsing, unsafe URLs, classification, date windows, duplicate sources, team filters, aliases, excerpts, caching, concurrent requests, upstream outages and escaped display content.
