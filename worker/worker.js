const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function asCleanString(value, maxLen = 256) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLen);
}

function isValidWallet(wallet) {
  if (typeof wallet !== 'string') return false;
  const w = wallet.trim();
  // Solana-style base58-ish guardrail (prevents obvious junk / null / scripts)
  return /^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(w);
}

function isValidUsername(username) {
  if (typeof username !== 'string') return false;
  const u = username.trim();
  // 3-20 chars, common handle charset
  return /^[a-zA-Z0-9_\-.]{3,20}$/.test(u);
}

function parseScore(raw) {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  const score = Math.floor(raw);
  // Guardrails: prevent negative / absurd values
  if (score < 0 || score > 10_000_000) return null;
  return score;
}

async function safeJsonBody(request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return { error: 'Expected application/json' };
  }

  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { error: 'Invalid JSON body' };
    }
    return { body };
  } catch {
    return { error: 'Malformed JSON' };
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // POST /register — wallet + username → token
    if (url.pathname === '/register' && request.method === 'POST') {
      const parsed = await safeJsonBody(request);
      if (parsed.error) return json({ error: parsed.error }, 400);

      try {
        const wallet = asCleanString(parsed.body.wallet, 80);
        const username = asCleanString(parsed.body.username, 24);

        if (!isValidWallet(wallet) || !isValidUsername(username)) {
          return json({ error: 'Invalid wallet or username format' }, 400);
        }

        // Check if wallet already registered
        const existing = await env.DB.prepare(
          'SELECT username, token FROM users WHERE wallet = ?'
        ).bind(wallet).first();

        if (existing && typeof existing.token === 'string' && typeof existing.username === 'string') {
          return json({ token: existing.token, username: existing.username, returning: true });
        }

        // Check username taken
        const takenName = await env.DB.prepare(
          'SELECT wallet FROM users WHERE username = ?'
        ).bind(username).first();

        if (takenName) return json({ error: 'Username already taken' }, 409);

        const token = generateToken();
        await env.DB.prepare(
          'INSERT INTO users (wallet, username, token, created_at) VALUES (?, ?, ?, ?)'
        ).bind(wallet, username, token, Date.now()).run();

        return json({ token, username, returning: false });
      } catch (e) {
        return json({ error: e?.message || 'Internal error' }, 500);
      }
    }

    // POST /login — token → username
    if (url.pathname === '/login' && request.method === 'POST') {
      const parsed = await safeJsonBody(request);
      if (parsed.error) return json({ error: parsed.error }, 400);

      try {
        const token = asCleanString(parsed.body.token, 128);
        if (!/^[a-f0-9]{64}$/.test(token)) {
          return json({ error: 'Invalid token format' }, 400);
        }

        const user = await env.DB.prepare('SELECT username FROM users WHERE token = ?').bind(token).first();
        if (!user || typeof user.username !== 'string') return json({ error: 'Invalid token' }, 401);

        return json({ username: user.username });
      } catch (e) {
        return json({ error: e?.message || 'Internal error' }, 500);
      }
    }

    // POST /submit — token + score → save
    if (url.pathname === '/submit' && request.method === 'POST') {
      const parsed = await safeJsonBody(request);
      if (parsed.error) return json({ error: parsed.error }, 400);

      try {
        const token = asCleanString(parsed.body.token, 128);
        const score = parseScore(parsed.body.score);

        if (!/^[a-f0-9]{64}$/.test(token) || score === null) {
          return json({ error: 'Invalid token or score' }, 400);
        }

        const user = await env.DB.prepare(
          'SELECT wallet, username FROM users WHERE token = ?'
        ).bind(token).first();

        if (!user || typeof user.wallet !== 'string' || typeof user.username !== 'string') {
          return json({ error: 'Invalid token' }, 401);
        }

        const wallet = user.wallet.trim();
        const username = user.username.trim();

        if (!isValidWallet(wallet) || !isValidUsername(username)) {
          return json({ error: 'Corrupt account data' }, 500);
        }

        // Upsert: keep highest score per wallet
        const existing = await env.DB.prepare(
          'SELECT score FROM scores WHERE wallet = ?'
        ).bind(wallet).first();

        if (existing && Number.isFinite(existing.score)) {
          if (score > existing.score) {
            await env.DB.prepare(
              'UPDATE scores SET score = ?, time = ?, username = ? WHERE wallet = ?'
            ).bind(score, Date.now(), username, wallet).run();
          }
        } else if (!existing) {
          await env.DB.prepare(
            'INSERT INTO scores (wallet, username, score, time) VALUES (?, ?, ?, ?)'
          ).bind(wallet, username, score, Date.now()).run();
        } else {
          // Existing row is malformed; repair it.
          await env.DB.prepare(
            'UPDATE scores SET score = ?, time = ?, username = ? WHERE wallet = ?'
          ).bind(score, Date.now(), username, wallet).run();
        }

        return json({ success: true });
      } catch (e) {
        return json({ error: e?.message || 'Internal error' }, 500);
      }
    }

    // GET /leaderboard
    if (url.pathname === '/leaderboard' && request.method === 'GET') {
      try {
        const { results } = await env.DB.prepare(
          'SELECT username, wallet, score, time FROM scores ORDER BY score DESC LIMIT 50'
        ).all();

        const safeResults = Array.isArray(results) ? results : [];
        const display = safeResults.map((r) => {
          const username = asCleanString(r?.username, 20) || 'unknown';
          const wallet = asCleanString(r?.wallet, 80);
          const score = Number.isFinite(r?.score) ? Math.max(0, Math.floor(r.score)) : 0;
          const time = Number.isFinite(r?.time) ? r.time : 0;

          const shortWallet = wallet.length >= 8
            ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
            : wallet || 'unknown';

          return { username, wallet: shortWallet, score, time };
        });

        return json(display);
      } catch (e) {
        return json({ error: e?.message || 'Internal error' }, 500);
      }
    }

    return json({ error: 'Not found' }, 404);
  }
};
