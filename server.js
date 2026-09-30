'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
const STATIC = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/manifest.json', ['manifest.json', 'application/manifest+json']],
  ['/icon.svg', ['icon.svg', 'image/svg+xml']],
  ['/sw.js', ['sw.js', 'text/javascript; charset=utf-8']],
]);
const teamDefenseCache = new Map();

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}

function apiTarget(url) {
  if (url.pathname === '/api/player-search') {
    const query = (url.searchParams.get('q') || '').trim().slice(0, 80);
    if (query.length < 3) return null;
    const target = new URL('https://search.d3.nhle.com/api/v1/search/player');
    target.searchParams.set('culture', 'en-us');
    target.searchParams.set('limit', '12');
    target.searchParams.set('q', query);
    return target;
  }

  const prefix = '/api/nhl/v1';
  if (!url.pathname.startsWith(prefix + '/')) return undefined;
  const endpoint = url.pathname.slice(prefix.length);
  const allowed = /^\/(?:score\/\d{4}-\d{2}-\d{2}|standings\/now|player\/\d+\/landing|player\/\d+\/game-log\/\d{8}\/[23]|roster\/[A-Z]{3}\/current|club-schedule-season\/[A-Z]{3}\/(?:now|\d{8})|gamecenter\/\d+\/boxscore)$/;
  if (!allowed.test(endpoint)) return null;
  return new URL('https://api-web.nhle.com/v1' + endpoint);
}

async function nhlJson(endpoint) {
  const response = await fetch(`https://api-web.nhle.com/v1${endpoint}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'PuckProps/1.0' },
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`NHL returned HTTP ${response.status}`);
  return response.json();
}

async function getTeamDefense(team, season) {
  const key = `${team}:${season}`,cached = teamDefenseCache.get(key);
  if (cached?.expires > Date.now()) return cached.value;
  if (cached?.promise) return cached.promise;
  const promise = (async () => {
    const schedule = await nhlJson(`/club-schedule-season/${team}/${season}`);
    const games = (schedule.games || []).filter(game => game.gameType === 2 && ['OFF', 'FINAL'].includes(game.gameState));
    const allowed = {
      Forwards: { shots: 0, points: 0, goals: 0 },
      Defensemen: { shots: 0, points: 0, goals: 0 },
      Goalies: { shots: 0, points: 0, goals: 0 },
    };
    let next = 0, gamesProcessed = 0, failed = 0;
    const worker = async () => {
      while (next < games.length) {
        const game = games[next++];
        try {
          const box = await nhlJson(`/gamecenter/${game.id}/boxscore`);
          const defendingSide = box.homeTeam?.abbrev === team ? 'homeTeam' : box.awayTeam?.abbrev === team ? 'awayTeam' : null;
          if (!defendingSide) continue;
          const opposingSide = defendingSide === 'homeTeam' ? 'awayTeam' : 'homeTeam';
          const opponentStats = box.playerByGameStats?.[opposingSide] || {};
          for (const [group, bucket] of [['Forwards', 'forwards'], ['Defensemen', 'defense'], ['Goalies', 'goalies']]) {
            for (const player of opponentStats[bucket] || []) {
              allowed[group].shots += Number(player.sog) || 0;
              allowed[group].points += Number(player.points) || 0;
              allowed[group].goals += Number(player.goals) || 0;
            }
          }
          gamesProcessed++;
        } catch { failed++; }
      }
    };
    await Promise.all(Array.from({ length: Math.min(10, games.length) }, worker));
    const result = { team, season, gamesScheduled: games.length, gamesProcessed, failed, allowed };
    teamDefenseCache.set(key, { value: result, expires: Date.now() + 15 * 60 * 1000 });
    return result;
  })();
  teamDefenseCache.set(key, { promise });
  try { return await promise; }
  catch (error) { teamDefenseCache.delete(key); throw error; }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method !== 'GET') return send(res, 405, 'GET only');

  if (url.pathname === '/api/health') {
    return send(res, 200, JSON.stringify({ ok: true, service: 'puck-props', version: 13 }), 'application/json; charset=utf-8');
  }

  const defenseMatch = url.pathname.match(/^\/api\/team-defense\/([A-Z]{3})\/(\d{8})$/);
  if (defenseMatch) {
    try {
      const data = await getTeamDefense(defenseMatch[1], defenseMatch[2]);
      return send(res, 200, JSON.stringify(data), 'application/json; charset=utf-8');
    } catch (error) {
      return send(res, 502, JSON.stringify({ error: error.message || 'Could not load team defense stats.' }), 'application/json; charset=utf-8');
    }
  }

  const target = apiTarget(url);
  if (target === null) return send(res, 400, 'Invalid NHL request');
  if (target) {
    try {
      const upstream = await fetch(target, {
        headers: { Accept: 'application/json', 'User-Agent': 'PuckProps/1.0' },
        signal: AbortSignal.timeout(9000),
      });
      const body = await upstream.text();
      res.writeHead(upstream.status, {
        'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      return res.end(body);
    } catch (error) {
      const message = error.name === 'TimeoutError' ? 'The NHL service timed out.' : 'Could not connect to the NHL service.';
      return send(res, 502, JSON.stringify({ error: message }), 'application/json; charset=utf-8');
    }
  }

  const file = STATIC.get(url.pathname);
  if (!file) return send(res, 404, 'Not found');
  try {
    const body = fs.readFileSync(path.join(ROOT, file[0]));
    res.writeHead(200, {
      'Content-Type': file[1],
      'Cache-Control': ['index.html', 'app.js', 'sw.js'].includes(file[0]) ? 'no-cache' : 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(body);
  } catch {
    send(res, 500, 'Could not read application file');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Puck Props is ready at http://127.0.0.1:${PORT}/`);
  console.log('Keep this window open while using the app. Press Ctrl+C to stop it.');
});
