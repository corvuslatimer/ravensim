export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST', 'Access-Control-Allow-Headers': 'Content-Type' } });
    }

    if (url.pathname === '/leaderboard') {
      const { results } = await env.DB.prepare('SELECT name, score, time FROM scores ORDER BY score DESC LIMIT 50').all();
      return new Response(JSON.stringify(results), { headers });
    }

    if (url.pathname === '/submit' && request.method === 'POST') {
      try {
        const { name, score } = await request.json();
        if (!name || typeof score !== 'number' || score < 0 || name.length > 20) {
          return new Response(JSON.stringify({ error: 'Invalid' }), { status: 400, headers });
        }
        await env.DB.prepare(
          'INSERT INTO scores (name, score, time) VALUES (?, ?, ?)'
        ).bind(name.slice(0, 20), score, Date.now()).run();
        return new Response(JSON.stringify({ success: true }), { headers });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
      }
    }

    return new Response('Not found', { status: 404 });
  }
};
