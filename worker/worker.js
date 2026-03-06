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
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    const url = new URL(request.url);

    // POST /register — wallet + username → token
    if (url.pathname === '/register' && request.method === 'POST') {
      try {
        const { wallet, username } = await request.json();
        if (!wallet || !username || username.length > 20 || wallet.length < 30) {
          return json({ error: 'Invalid wallet or username' }, 400);
        }

        // Check if wallet already registered
        const existing = await env.DB.prepare(
          'SELECT username, token FROM users WHERE wallet = ?'
        ).bind(wallet).first();

        if (existing) {
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
        ).bind(wallet, username.slice(0, 20), token, Date.now()).run();

        return json({ token, username, returning: false });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // POST /login — token → username
    if (url.pathname === '/login' && request.method === 'POST') {
      try {
        const { token } = await request.json();
        const user = await env.DB.prepare('SELECT username FROM users WHERE token = ?').bind(token).first();
        if (!user) return json({ error: 'Invalid token' }, 401);
        return json({ username: user.username });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // POST /submit — token + score → save
    if (url.pathname === '/submit' && request.method === 'POST') {
      try {
        const { token, score } = await request.json();
        if (!token || typeof score !== 'number' || score < 0) {
          return json({ error: 'Invalid token or score' }, 400);
        }

        const user = await env.DB.prepare(
          'SELECT wallet, username FROM users WHERE token = ?'
        ).bind(token).first();
        if (!user) return json({ error: 'Invalid token' }, 401);

        // Upsert: keep highest score per wallet
        const existing = await env.DB.prepare(
          'SELECT score FROM scores WHERE wallet = ?'
        ).bind(user.wallet).first();

        if (existing) {
          if (score > existing.score) {
            await env.DB.prepare(
              'UPDATE scores SET score = ?, time = ? WHERE wallet = ?'
            ).bind(score, Date.now(), user.wallet).run();
          }
        } else {
          await env.DB.prepare(
            'INSERT INTO scores (wallet, username, score, time) VALUES (?, ?, ?, ?)'
          ).bind(user.wallet, user.username, score, Date.now()).run();
        }

        return json({ success: true });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // GET /leaderboard
    if (url.pathname === '/leaderboard') {
      try {
        const { results } = await env.DB.prepare(
          'SELECT username, wallet, score, time FROM scores ORDER BY score DESC LIMIT 50'
        ).all();

        const safeResults = Array.isArray(results) ? results : [];
        const display = safeResults.map((r) => {
          const wallet = typeof r.wallet === 'string' ? r.wallet : '';
          const shortWallet = wallet.length >= 8
            ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
            : wallet || 'unknown';

          return {
            username: typeof r.username === 'string' ? r.username : 'unknown',
            wallet: shortWallet,
            score: Number.isFinite(r.score) ? r.score : 0,
            time: Number.isFinite(r.time) ? r.time : 0
          };
        });

        return json(display);
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    return new Response('Not found', { status: 404 });
  }
};
