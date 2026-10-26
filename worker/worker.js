// Acore Worker: ШІ-чат (/chat) і пошук (/search).
// Ключі зберігаються в Cloudflare як секрети: GROQ_API_KEY, OPENROUTER_API_KEY, BRAVE_API_KEY, TAVILY_API_KEY.
// Сюди ключі НЕ вписувати.

const MODELS = {
    general: {
        url: 'https://api.groq.com/openai/v1/chat/completions',
        model: 'openai/gpt-oss-120b',
        keyName: 'GROQ_API_KEY',
        extra: { max_completion_tokens: 1200, reasoning_effort: 'low' }
    },
    code: {
        url: 'https://openrouter.ai/api/v1/chat/completions',
        model: 'google/gemma-4-26b-a4b-it:free',
        keyName: 'OPENROUTER_API_KEY',
        extra: { max_tokens: 1200 }
    }
};

// Ліміт запитів на день для одного IP (працює, коли є KV-прив'язка LIMITS)
const DAILY_LIMIT = { general: 20, code: 5, search: 30 };

const MAX_MESSAGES = 30;
const MAX_CHARS = 4000;

function corsHeaders(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
    let allowOrigin = '*';
    if (allowed.length) allowOrigin = allowed.includes(origin) ? origin : allowed[0];
    return {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
    };
}

function json(data, status, cors) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' }
    });
}

function cleanMessages(list) {
    if (!Array.isArray(list) || !list.length) return null;
    const out = [];
    for (const m of list.slice(-MAX_MESSAGES)) {
        if (!m || typeof m.content !== 'string') continue;
        const role = ['system', 'user', 'assistant'].includes(m.role) ? m.role : 'user';
        out.push({ role, content: m.content.slice(0, MAX_CHARS) });
    }
    return out.length ? out : null;
}

// Перевірка і збільшення денного ліміту. Потребує KV-прив'язку LIMITS.
async function checkLimit(env, mode, ip) {
    if (!env.LIMITS) return true;
    const day = new Date().toISOString().slice(0, 10);
    const key = `${mode}:${ip}:${day}`;
    const count = parseInt((await env.LIMITS.get(key)) || '0', 10);
    if (count >= DAILY_LIMIT[mode]) return false;
    await env.LIMITS.put(key, String(count + 1), { expirationTtl: 90000 });
    return true;
}

/* ---------- Пошук: Brave, а якщо не вийшло — Tavily ---------- */

async function searchBrave(q, env) {
    if (!env.BRAVE_API_KEY) throw new Error('no_brave_key');
    const url = 'https://api.search.brave.com/res/v1/web/search?q=' + encodeURIComponent(q) + '&count=10&country=ua';
    const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'X-Subscription-Token': env.BRAVE_API_KEY }
    });
    if (!res.ok) throw new Error('brave_' + res.status);
    const d = await res.json();
    const items = (d.web && d.web.results) || [];
    if (!items.length) throw new Error('brave_empty');
    return items.map(r => ({ title: r.title, url: r.url, snippet: r.description || '' }));
}

async function searchTavily(q, env) {
    if (!env.TAVILY_API_KEY) throw new Error('no_tavily_key');
    const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.TAVILY_API_KEY },
        body: JSON.stringify({ query: q, max_results: 10, search_depth: 'basic' })
    });
    if (!res.ok) throw new Error('tavily_' + res.status);
    const d = await res.json();
    const items = d.results || [];
    if (!items.length) throw new Error('tavily_empty');
    return items.map(r => ({ title: r.title, url: r.url, snippet: r.content || '' }));
}

async function handleSearch(request, env, cors) {
    const body = await request.json();
    const q = String(body.q || '').trim().slice(0, 200);
    if (!q) return json({ error: 'bad_request' }, 400, cors);

    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    if (!(await checkLimit(env, 'search', ip))) return json({ error: 'limit' }, 429, cors);

    try {
        const results = await searchBrave(q, env);
        return json({ provider: 'brave', results }, 200, cors);
    } catch (e1) {
        try {
            const results = await searchTavily(q, env);
            return json({ provider: 'tavily', results }, 200, cors);
        } catch (e2) {
            return json({ error: 'search_unavailable' }, 503, cors);
        }
    }
}

/* ---------- Чат ---------- */

async function handleChat(request, env, cors) {
    const body = await request.json();
    const mode = body.mode === 'code' ? 'code' : 'general';
    const messages = cleanMessages(body.messages);
    if (!messages) return json({ error: 'bad_request' }, 400, cors);

    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    if (!(await checkLimit(env, mode, ip))) return json({ error: 'limit' }, 429, cors);

    const cfg = MODELS[mode];
    const apiKey = env[cfg.keyName];
    if (!apiKey) return json({ error: 'server_not_configured' }, 500, cors);

    const headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey };
    if (mode === 'code') {
        headers['HTTP-Referer'] = 'https://0leksiimarich.github.io/Acore/';
        headers['X-Title'] = 'Acore';
    }

    const upstream = await fetch(cfg.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: cfg.model, messages, stream: true, temperature: 0.7, ...cfg.extra })
    });

    if (!upstream.ok) return json({ error: 'upstream' }, upstream.status, cors);

    return new Response(upstream.body, {
        status: 200,
        headers: { ...cors, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' }
    });
}

export default {
    async fetch(request, env) {
        const cors = corsHeaders(request, env);
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

        const url = new URL(request.url);
        if (request.method !== 'POST') return json({ error: 'not_found' }, 404, cors);

        try {
            if (url.pathname === '/chat') return await handleChat(request, env, cors);
            if (url.pathname === '/search') return await handleSearch(request, env, cors);
            return json({ error: 'not_found' }, 404, cors);
        } catch (e) {
            return json({ error: 'server_error' }, 500, cors);
        }
    }
};
