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
const teamSpecialCache = new Map();

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

async function nhlStatsJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'PuckProps/1.0' },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`NHL shift charts returned HTTP ${response.status}`);
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

function clockSeconds(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function emptyIntervals(covered, periodLength) {
  const ranges = covered.map(x => [Math.max(0, x[0]), Math.min(periodLength, x[1])]).filter(x => x[1] > x[0]).sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push(range);
  }
  const gaps = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) gaps.push([cursor, start]);
    cursor = Math.max(cursor, end);
  }
  if (cursor < periodLength) gaps.push([cursor, periodLength]);
  return gaps;
}

async function getTeamSpecialStats(team, season) {
  const key = `${team}:${season}`, cached = teamSpecialCache.get(key);
  if (cached?.expires > Date.now()) return cached.value;
  if (cached?.promise) return cached.promise;
  const promise = (async () => {
    const schedule = await nhlJson(`/club-schedule-season/${team}/${season}`);
    const games = (schedule.games || []).filter(game => game.gameType === 2 && ['OFF', 'FINAL'].includes(game.gameState));
    const emptyNetGoals = new Map(), goaliePulledTime = new Map();
    let next = 0, gamesProcessed = 0, shiftGames = 0, failed = 0;
    const worker = async () => {
      while (next < games.length) {
        const game = games[next++];
        try {
          const [playByPlay, shifts, box] = await Promise.all([
            nhlJson(`/gamecenter/${game.id}/play-by-play`),
            nhlStatsJson(`https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp=gameId=${game.id}`),
            nhlJson(`/gamecenter/${game.id}/boxscore`),
          ]);
          const home = game.homeTeam?.abbrev, away = game.awayTeam?.abbrev;
          const homeId = Number(game.homeTeam?.id), awayId = Number(game.awayTeam?.id);
          const sideTeams = { homeTeam: box.homeTeam?.abbrev || home, awayTeam: box.awayTeam?.abbrev || away };
          const playerTeam = new Map(), playerNames = new Map(), goalieIds = new Map();
          for (const side of ['homeTeam', 'awayTeam']) {
            const sideTeam = sideTeams[side];
            goalieIds.set(sideTeam, new Set());
            const stats = box.playerByGameStats?.[side] || {};
            for (const group of ['forwards', 'defense', 'goalies']) {
              for (const player of stats[group] || []) {
                const id = String(player.playerId ?? player.id ?? '');
                if (!id) continue;
                playerTeam.set(id, sideTeam);
                playerNames.set(id, player.name?.default || player.name || '');
                if (group === 'goalies') goalieIds.get(sideTeam).add(id);
              }
            }
          }

          for (const play of playByPlay.plays || []) {
            const details = play.details || {};
            const isGoal = play.typeDescKey === 'goal' || play.typeCode === 505;
            if (!isGoal || !(details.emptyNet === true || details.emptyNet === 'true' || details.isEmptyNet === true)) continue;
            const scorer = String(details.scoringPlayerId || '');
            const scoringTeam = Number(details.eventOwnerTeamId) === homeId ? home : Number(details.eventOwnerTeamId) === awayId ? away : playerTeam.get(scorer);
            if (scoringTeam !== team || !scorer) continue;
            const existing = emptyNetGoals.get(scorer) || { playerId: scorer, name: '', goals: 0 };
            existing.goals++;
            existing.name ||= playerNames.get(scorer) || [details.scoringPlayerName].find(Boolean) || '';
            emptyNetGoals.set(scorer, existing);
          }
          gamesProcessed++;

          const shiftRows = shifts.data || [];
          if (shiftRows.length && [...goalieIds.values()].some(ids => ids.size)) {
            const shiftsByPeriodAndTeam = new Map();
            for (const row of shiftRows) {
              const id = String(row.playerId || ''), rowTeam = row.teamAbbrev, period = Number(row.period);
              const start = clockSeconds(row.startTime), end = clockSeconds(row.endTime);
              if (!id || !rowTeam || !Number.isInteger(period) || period < 1 || period > 4 || start === null || end === null || end <= start) continue;
              const bucket = `${rowTeam}:${period}`;
              if (!shiftsByPeriodAndTeam.has(bucket)) shiftsByPeriodAndTeam.set(bucket, []);
              shiftsByPeriodAndTeam.get(bucket).push({ ...row, id, rowTeam, period, start, end });
            }
            for (const row of shiftRows) {
              const playerId = String(row.playerId || ''), rowTeam = row.teamAbbrev, period = Number(row.period);
              const start = clockSeconds(row.startTime), end = clockSeconds(row.endTime);
              if (!playerId || rowTeam !== team || (playerTeam.has(playerId) && playerTeam.get(playerId) !== team) || goalieIds.get(team)?.has(playerId) || !Number.isInteger(period) || period < 1 || period > 4 || start === null || end === null || end <= start) continue;
              const opponentGoalieTeam = team === home ? away : home;
              const periodLength = period <= 3 ? 1200 : 300;
              const goalieCoverage = (shiftsByPeriodAndTeam.get(`${opponentGoalieTeam}:${period}`) || []).filter(shift => goalieIds.get(opponentGoalieTeam)?.has(shift.id)).map(shift => [shift.start, shift.end]);
              const absent = emptyIntervals(goalieCoverage, periodLength);
              const seconds = absent.reduce((total, [gapStart, gapEnd]) => total + Math.max(0, Math.min(end, gapEnd) - Math.max(start, gapStart)), 0);
              if (seconds < 1) continue;
              const current = goaliePulledTime.get(playerId) || { playerId, name: [row.firstName, row.lastName].filter(Boolean).join(' '), seconds: 0 };
              current.seconds += seconds;
              goaliePulledTime.set(playerId, current);
            }
            shiftGames++;
          }
        } catch { failed++; }
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, games.length) }, worker));
    const goals = [...emptyNetGoals.values()].sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));
    const time = [...goaliePulledTime.values()].sort((a, b) => b.seconds - a.seconds || a.name.localeCompare(b.name));
    const result = {
      team, season, gamesScheduled: games.length, gamesProcessed, shiftGames, failed,
      emptyNetLeaders: goals.slice(0, 5),
      goaliePulledLeaders: time.slice(0, 5).map(player => ({ ...player, minutes: player.seconds / 60 })),
    };
    teamSpecialCache.set(key, { value: result, expires: Date.now() + 30 * 60 * 1000 });
    return result;
  })();
  teamSpecialCache.set(key, { promise });
  try { return await promise; }
  catch (error) { teamSpecialCache.delete(key); throw error; }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method !== 'GET') return send(res, 405, 'GET only');

  if (url.pathname === '/api/health') {
    return send(res, 200, JSON.stringify({ ok: true, service: 'puck-props', version: 15 }), 'application/json; charset=utf-8');
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

  const specialMatch = url.pathname.match(/^\/api\/team-special-stats\/([A-Z]{3})\/(\d{8})$/);
  if (specialMatch) {
    try {
      const data = await getTeamSpecialStats(specialMatch[1], specialMatch[2]);
      return send(res, 200, JSON.stringify(data), 'application/json; charset=utf-8');
    } catch (error) {
      return send(res, 502, JSON.stringify({ error: error.message || 'Could not load team special-situations stats.' }), 'application/json; charset=utf-8');
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
