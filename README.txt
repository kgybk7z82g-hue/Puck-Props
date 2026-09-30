PUCK PROPS — personal NHL dashboard

For the reliable local setup on Windows, install Node.js and double-click start.bat. It opens the app at http://127.0.0.1:4173 and keeps the NHL data connection running in a terminal window. Do not open index.html directly as a file: browser cross-origin rules can block data requests. For hosting on another device, deploy the app with its server.js data proxy on an HTTPS host. HTTPS also enables service-worker/offline support and iPhone home-screen installation.

Online/iPhone setup: this repo includes render.yaml for a one-service Node deployment on Render. Connect the repository in Render using its Blueprint flow, choose the free plan, and deploy. Render supplies an HTTPS onrender.com URL; open that URL in iPhone Safari, tap Share, then Add to Home Screen. Free Render web services sleep after 15 minutes idle and can take about a minute to wake. Upgrade the service if you need it continuously warm. The current app has no sign-in gate; anyone who has the URL can open it.

Features
- NHL scoreboard by date, including scores and game status.
- Click any scoreboard game to view both teams' player box scores, including goals, assists, points, shots, time on ice, and goalie results.
- Search for a player by name to view career totals and season-by-season regular-season statistics.
- Player game history against a selected NHL opponent, with recent-meeting and career samples.
- Browse each NHL team's roster, with hot-form markers for 10+ points in the last 10 games or five straight games with a shot on goal.
- Compare season-to-date opposing shots and points allowed by forward, defense, and goalie position.
- NHL team standings with a team/division filter.
- Build separate daily top-10 research lists for shots on goal, points, and goals with last-10, current-season, previous-season, head-to-head, and opponent position-defense context.
- A local saved-player list stored in this browser on this device.

The local server proxies only the NHL score, player, roster, standings, schedule, boxscore, team-defense, and player-search requests used by the app. This avoids dependence on unreliable public CORS relays. If start.bat reports an older server on port 4173, close its server window before starting the app again. Recent matchup searches stop once the requested number of games is found; career history requests seasons in small parallel batches. Data availability depends on the NHL services and internet connection. This is an unofficial personal project.
