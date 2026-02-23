const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};
const MAX_STORED_SCORES = 500;

function sanitize(entries) {
  if (!Array.isArray(entries)) return [];
  const normalized = entries
    .filter((entry) => entry && typeof entry.name === "string" && Number.isFinite(entry.score))
    .map((entry) => ({
      name: String(entry.name).trim().slice(0, 16) || "Player",
      score: Number(entry.score),
      avatar: typeof entry.avatar === "string" ? entry.avatar : "🐍",
      date: typeof entry.date === "string" ? entry.date : new Date(0).toISOString(),
    }));

  const unique = new Map();
  normalized.forEach((entry) => {
    const key = `${entry.name}|${entry.avatar}|${entry.score}|${entry.date}`;
    if (!unique.has(key)) unique.set(key, entry);
  });

  return Array.from(unique.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.date < b.date ? 1 : -1;
    })
    .slice(0, MAX_STORED_SCORES);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method === "GET") {
      const data = (await env.LEADERBOARD.get("scores", "json")) || [];
      return new Response(JSON.stringify({ leaderboard: sanitize(data) }), {
        status: 200,
        headers: CORS_HEADERS,
      });
    }

    if (request.method === "PUT") {
      let body = {};
      try {
        body = await request.json();
      } catch (_error) {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
          status: 400,
          headers: CORS_HEADERS,
        });
      }

      const nextLeaderboard = sanitize(body.leaderboard);
      await env.LEADERBOARD.put("scores", JSON.stringify(nextLeaderboard));
      return new Response(JSON.stringify({ ok: true, leaderboard: nextLeaderboard }), {
        status: 200,
        headers: CORS_HEADERS,
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: CORS_HEADERS,
    });
  },
};
