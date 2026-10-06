PUCK PROPS — personal NHL dashboard

For the reliable local setup on Windows, install Node.js and double-click start.bat. It opens the app at http://127.0.0.1:4173 and runs the NHL data connection in the background. Do not open index.html directly as a file: browser cross-origin rules can block data requests. For hosting on another device, deploy the app with its server.js data proxy on an HTTPS host. HTTPS also enables service-worker/offline support and iPhone home-screen installation.

Online/iPhone setup: this repo includes render.yaml for a one-service Node deployment on Render. Connect the repository in Render using its Blueprint flow, choose the free plan, and deploy. Render supplies an HTTPS onrender.com URL; open that URL in iPhone Safari, tap Share, then Add to Home Screen. Free Render web services sleep after 15 minutes idle and can take about a minute to wake. Upgrade the service if you need it continuously warm. The current app has no sign-in gate; anyone who has the URL can open it.

Features
- NHL scoreboard by date, including scores and game status.
- Click any scoreboard game to view both teams' player box scores, including goals, assists, points, shots, time on ice, and goalie results.
- Scoreboard matchups include each club's last 10 completed-game record.
- Search for a player by name to view career totals and season-by-season regular-season statistics.
- Open a roster player's profile to view their last 10 regular-season game stats.
- Player game history against a selected NHL opponent, with recent-meeting and career samples.
- Browse each NHL team's roster, with hot-form markers for 10+ points in the last 10 games or five straight games with a shot on goal.
- Compare season-to-date opposing shots and points allowed by forward, defense, and goalie position.
- NHL team standings with a team/division filter.
- Build separate daily top-10 research lists for shots on goal, points, and goals with last-10, current-season, previous-season, head-to-head, and opponent position-defense context.
- View the last 10 completed games for every team on the scoreboard and for players opened from a roster.
- Open a matchup on its own detail screen with a back button, probable starting goalie reports, and player box scores.
- Mark players explicitly listed on injured reserve in a team roster.
- Generate five daily NHL parlays from team and player game history, covering team wins, shots on goal, blocked shots, and points. The displayed return ranges are statistical estimates, not live sportsbook odds.

The local server proxies only the NHL score, player, roster, standings, schedule, boxscore, team-defense, and player-search requests used by the app. This avoids dependence on unreliable public CORS relays. If start.bat reports an older server on port 4173, stop that older server before starting the app again. Recent matchup searches stop once the requested number of games is found; career history requests seasons in small parallel batches. Data availability depends on the NHL services and internet connection. This is an unofficial personal project.



Starter reports use Daily Faceoff with GoaliePost as a secondary source. GoaliePost embedded public reports are matched to the requested NHL date (Eastern time), fill missing teams and can confirm the same goalie. Different names show conflicting reports. Individual source failures do not discard the other source. Public page formats may change.

On touch devices, swipe right from the left edge across an open area of matchup details, team rosters or player profiles to use the visible back action. Vertical scrolling, tables and interactive controls are excluded. Back buttons remain available.
