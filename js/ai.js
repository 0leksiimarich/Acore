/* Акорик: чат зі ШІ (через Cloudflare Worker), пошук у мережі, режим «Думай»,
   вкладка коду і генерація картинок (Pollinations). */
(function () {
    'use strict';
    const A = window.Acore;
    const { h, esc } = A;

    const SYSTEM =
        'Ти Акорик, дружній робот-маскот платформи Acore. ' +
        'Відповідай українською, якщо користувач не просить іншою мовою. ' +
        'Пиши коротко, просто і по-доброму: співрозмовником може бути школяр. ' +
        'Не вигадуй фактів: якщо не знаєш, чесно скажи про це. ' +
        'Не проси і не збирай особисті дані (адреси, паролі, номери карток). ' +
        'Відмовляйся від небезпечних порад і відповідай ввічливо.';

    const SUGGESTIONS = [
        'Розкажи цікавий факт про космос',
        'Поясни просто, що таке штучний інтелект',
        'Допоможи скласти план вивчення англійської',
        'Намалюй кота-космонавта'
    ];

    const CSS = `
.ai-models{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 4px}
.ai-models .sep{width:1px;background:#d6dde6;margin:0 2px}
.plug{padding:5px 12px;border:1px solid #1a4a84;background:#fff;color:#1a4a84;border-radius:16px;font-size:13px;cursor:pointer}
.plug.on{background:#1a4a84;color:#fff}
.plug:disabled{opacity:.45;cursor:default}
.think{margin:0 0 8px;font-size:13px;color:#555}
.think summary{cursor:pointer}
.think pre{white-space:pre-wrap;background:#f6f7f9;padding:8px;border-radius:6px;max-height:220px;overflow:auto;margin:6px 0 0}
.src{margin-top:8px;font-size:13px;color:#444}
.src a{color:#1a4a84;word-break:break-all}
.code-open{margin-top:4px}
#akCode{position:fixed;top:0;right:0;bottom:0;width:min(440px,100vw);background:#1e1e1e;color:#eee;z-index:9999;display:flex;flex-direction:column;box-shadow:-4px 0 16px rgba(0,0,0,.3);transform:translateX(100%);transition:transform .25s}
#akCode.open{transform:none}
#akCode .hd{display:flex;gap:8px;align-items:center;padding:10px;border-bottom:1px solid #333}
#akCode .hd button{background:#333;color:#eee;border:0;border-radius:6px;padding:6px 10px;cursor:pointer}
#akCode pre{flex:1;overflow:auto;margin:0;padding:12px;font-size:13px;white-space:pre}
`;

    function injectCss() {
        if (document.getElementById('ai-plus-style')) return;
        const s = document.createElement('style');
        s.id = 'ai-plus-style';
        s.textContent = CSS;
        document.head.appendChild(s);
    }

    /* ---------- Безпечний markdown: спершу екранування, потім розмітка ---------- */
    function md(src) {
        let t = String(src).replace(/\u0000/g, '');
        const blocks = [];
        const inline = [];
        const links = [];

        t = t.replace(/```[\w-]*\n?([\s\S]*?)```/g, (m, code) => {
            blocks.push(code.replace(/\n$/, ''));
            return '\u0000B' + (blocks.length - 1) + '\u0000';
        });
        t = t.replace(/`([^`\n]+)`/g, (m, code) => {
            inline.push(code);
            return '\u0000I' + (inline.length - 1) + '\u0000';
        });

        t = esc(t);

        t = t.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, text, url) => {
            links.push('<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + text + '</a>');
            return '\u0000L' + (links.length - 1) + '\u0000';
        });
        t = t.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g, url => {
            links.push('<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + '</a>');
            return '\u0000L' + (links.length - 1) + '\u0000';
        });

        t = t.replace(/^#{1,4}\s+(.+)$/gm, '<strong>$1</strong>');
        t = t.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
        t = t.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');

        const out = [];
        let para = [];
        let list = null;
        const flushPara = () => { if (para.length) { out.push('<p>' + para.join('<br>') + '</p>'); para = []; } };
        const flushList = () => {
            if (list) {
                const tag = list.ordered ? 'ol' : 'ul';
                out.push('<' + tag + '>' + list.items.map(i => '<li>' + i + '</li>').join('') + '</' + tag + '>');
                list = null;
            }
        };
        t.split('\n').forEach(line => {
            const li = line.match(/^\s*(?:[-*•]|(\d+)[.)])\s+(.*)$/);
            if (li) {
                flushPara();
                const ordered = !!li[1];
                if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] }; }
                list.items.push(li[2]);
            } else if (/^\u0000B\d+\u0000$/.test(line.trim())) {
                flushPara(); flushList(); out.push(line.trim());
            } else if (line.trim() === '') {
                flushPara(); flushList();
            } else {
                flushList(); para.push(line);
            }
        });
        flushPara(); flushList();

        return out.join('')
            .replace(/\u0000B(\d+)\u0000/g, (m, i) => '<pre><code>' + esc(blocks[+i]) + '</code></pre>')
            .replace(/\u0000I(\d+)\u0000/g, (m, i) => '<code>' + esc(inline[+i]) + '</code>')
            .replace(/\u0000L(\d+)\u0000/g, (m, i) => links[+i]);
    }

    /* ---------- Запит про картинку ---------- */
    const IMG_RE = new RegExp(
        '^\\s*(?:' +
        '\\/(?:image|img)(?=\\s|$)|' +
        '(?:намалюй|нарисуй)(?=\\s|$)|' +
        '(?:зроби|створи|згенеруй)\\s+(?:мені\\s+)?(?:фото|картинку|малюнок|зображення|арт)(?=\\s|$)|' +
        'draw(?=\\s)|generate\\s+(?:an?\\s+)?image(?=\\s)' +
        ')', 'i');

    function imageRequest(text) {
        const m = String(text).match(IMG_RE);
        if (!m) return null;
        return text.slice(m[0].length).replace(/^[\s:,.\-–—]+/, '').trim();
    }

    function imageUrl(prompt, withModel) {
        const seed = Math.floor(Math.random() * 1e6);
        let u = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt.slice(0, 300)) +
            '?width=768&height=768&nologo=true&safe=true&seed=' + seed;
        if (withModel && A.cfg.IMAGE_MODEL) u += '&model=' + encodeURIComponent(A.cfg.IMAGE_MODEL);
        return u;
    }

    function loadImage(url, ms) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const timer = setTimeout(() => { img.onload = img.onerror = null; reject(new Error('timeout')); }, ms || 70000);
            img.onload = () => { clearTimeout(timer); resolve(url); };
            img.onerror = () => { clearTimeout(timer); reject(new Error('load')); };
            img.referrerPolicy = 'no-referrer';
            img.src = url;
        });
    }

    /* ---------- Налаштування і мережа ---------- */
    const MODE_NAMES = { general: 'Загальний', code: 'Код', orca: 'DeepSeek' };
    const getMode = () => {
        const m = A.store.get('ai_mode', 'general');
        return MODE_NAMES[m] ? m : 'general';
    };
    const searchOn = () => !!A.store.get('ai_search', false) && !!(A.cfg.AI_PROXY_URL || '').trim();
    const thinkOn = () => !!A.store.get('ai_think', false);

    function endpoint() {
        const proxy = (A.cfg.AI_PROXY_URL || '').trim();
        if (proxy) return { url: proxy.replace(/\/+$/, '') + '/chat', key: null };
        const key = A.store.get('groq_key', '') || (A.cfg.GROQ_KEY || '');
        if (key) return { url: 'https://api.groq.com/openai/v1/chat/completions', key };
        return null;
    }

    async function webSearch(q) {
        const base = (A.cfg.AI_PROXY_URL || '').trim().replace(/\/+$/, '');
        if (!base) return null;
        const res = await fetch(base + '/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: q.slice(0, 200) })
        });
        if (!res.ok) return null;
        const j = await res.json();
        const results = (j.results || []).slice(0, 6);
        return results.length ? results : null;
    }

    function explain(status) {
        if (status === 401 || status === 403) return 'Доступ не дозволено. Перевірте ключ або налаштування проксі.';
        if (status === 429) return 'Забагато запитів. Зачекайте хвилину і спробуйте знову.';
        if (status >= 500) return 'Сервіс ШІ тимчасово недоступний. Спробуйте трохи пізніше.';
        return 'Не вдалося отримати відповідь (код ' + status + ').';
    }

    // onDelta(kind, chunk): kind — 'content' (відповідь) або 'reasoning' (міркування)
    async function readStream(res, onDelta) {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let nl;
            while ((nl = buf.indexOf('\n')) >= 0) {
                const line = buf.slice(0, nl).trim();
                buf = buf.slice(nl + 1);
                if (!line.startsWith('data:')) continue;
                const data = line.slice(5).trim();
                if (data === '[DONE]') return;
                try {
                    const j = JSON.parse(data);
                    const d = j.choices && j.choices[0] && j.choices[0].delta;
                    if (!d) continue;
                    if (d.content) onDelta('content', d.content);
                    const r = d.reasoning || d.reasoning_content;
                    if (r) onDelta('reasoning', r);
                } catch (e) { /* неповний шматок, чекаємо наступний */ }
            }
        }
    }

    /* ---------- Вкладка коду ---------- */
    let codeEl = null;

    function ensureCodePanel() {
        if (codeEl) return codeEl;
        codeEl = h('aside', { id: 'akCode', 'aria-label': 'Код' },
            h('div', { class: 'hd' },
                h('strong', { text: 'Код' }),
                h('button', { type: 'button', style: 'margin-left:auto', onclick: copyCode }, 'Копіювати'),
                h('button', { type: 'button', onclick: () => codeEl.classList.remove('open') }, '×')),
            h('pre', null, h('code', null)));
        document.body.appendChild(codeEl);
        return codeEl;
    }

    function openCode(text) {
        const el = ensureCodePanel();
        el.querySelector('code').textContent = text;
        el.classList.add('open');
    }

    function copyCode() {
        const t = codeEl.querySelector('code').textContent;
        if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => A.toast('Скопійовано'), () => A.toast('Не вдалося скопіювати'));
    }

    /* ---------- Інтерфейс ---------- */
    let log, form, input, sendBtn, statusEl, suggestEl;
    let history = [];
    let busy = false;
    let controller = null;

    const save = () => A.store.set('chat2', history.slice(-30));
    const textHistory = () => history.filter(m => m.kind !== 'image').slice(-12).map(m => ({ role: m.role, content: m.content }));

    function setStatus(text) { if (statusEl) statusEl.textContent = text; }

    function setBusy(on) {
        busy = on;
        const icon = sendBtn.querySelector('use');
        if (icon) icon.setAttribute('href', on ? '#i-stop' : '#i-send');
        sendBtn.setAttribute('aria-label', on ? 'Зупинити' : 'Надіслати');
        sendBtn.classList.toggle('stop', on);
        if (!on) setStatus(endpoint() ? 'Готовий допомогти' : 'Не підключено');
    }

    function nearBottom() { return log.scrollHeight - log.scrollTop - log.clientHeight < 90; }
    function toBottom() { log.scrollTop = log.scrollHeight; }

    function toolButtons(getText) {
        return h('div', { class: 'msg-tools' },
            h('button', { class: 'tool-btn', type: 'button', onclick: () => A.speak(getText()) }, 'Озвучити'),
            h('button', {
                class: 'tool-btn', type: 'button',
                onclick: () => {
                    if (navigator.clipboard) navigator.clipboard.writeText(getText()).then(() => A.toast('Скопійовано'), () => A.toast('Не вдалося скопіювати'));
                    else A.toast('Копіювання недоступне в цьому браузері');
                }
            }, 'Копіювати'));
    }

    function addUser(text) {
        log.appendChild(h('div', { class: 'msg user' }, h('div', { class: 'bubble', text })));
        toBottom();
    }

    function addAi(m) {
        const bubble = h('div', { class: 'bubble' });
        const col = h('div', { class: 'msg-col' }, bubble);
        const el = h('div', { class: 'msg ai' }, A.icon('akorik', 'msg-av'), col);
        if (m && m.kind === 'image') {
            bubble.classList.add('has-img');
            bubble.append(imageFigure(m.url, m.prompt));
        } else if (m) {
            if (m.think) {
                bubble.append(h('details', { class: 'think' },
                    h('summary', { text: 'Міркування' }),
                    h('pre', { text: m.think })));
            }
            const ans = h('div', { class: 'ans' });
            ans.innerHTML = md(m.content);
            bubble.append(ans);
            ans.querySelectorAll('pre').forEach(p => {
                const code = p.textContent;
                p.after(h('button', { class: 'tool-btn code-open', type: 'button', onclick: () => openCode(code) }, 'Відкрити код'));
            });
            if (m.sources && m.sources.length) {
                col.append(h('div', { class: 'src' },
                    h('div', { text: 'Джерела:' }),
                    ...m.sources.map((s, i) => h('div', null,
                        h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, '[' + (i + 1) + '] ' + (s.title || s.url))))));
            }
            col.append(toolButtons(() => m.content));
        }
        log.appendChild(el);
        return { el, bubble };
    }

    function imageFigure(url, prompt) {
        return h('figure', { class: 'gen-img' },
            h('img', { src: url, alt: prompt, loading: 'lazy', referrerpolicy: 'no-referrer' }),
            h('figcaption', null, prompt, ' ', h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, 'Відкрити')));
    }

    function errorBubble(text, canRetry) {
        const retry = canRetry ? h('button', { class: 'tool-btn', type: 'button', onclick: () => { el.remove(); respond(); } }, 'Спробувати ще') : null;
        const el = h('div', { class: 'msg ai err' }, A.icon('akorik', 'msg-av'),
            h('div', { class: 'msg-col' }, h('div', { class: 'bubble', text }), retry ? h('div', { class: 'msg-tools' }, retry) : null));
        log.appendChild(el);
        toBottom();
        return el;
    }

    function renderAll() {
        log.textContent = '';
        if (!history.length) {
            addAi({ role: 'assistant', content: 'Привіт! Я **Акорик**. Можу відповісти на питання, допомогти з уроками, вигадати історію або намалювати картинку: просто напишіть «намалюй …».' });
        }
        history.forEach(m => (m.role === 'user' ? addUser(m.content) : addAi(m)));
        suggestEl.hidden = history.length > 0;
        toBottom();
    }

    async function respond() {
        const ep = endpoint();
        if (!ep) {
            errorBubble('Я ще не підключений до ШІ. Власнику сайту: вкажіть AI_PROXY_URL у js/config.js або вставте ключ Groq у Сервіси → Налаштування для тесту.', false);
            return;
        }
        setBusy(true);

        // Пошук у мережі: результати додаються в контекст, а джерела показуються під відповіддю
        let sources = null;
        const lastUser = [...history].reverse().find(m => m.role === 'user');
        if (searchOn() && lastUser) {
            setStatus('Шукає в інтернеті…');
            try { sources = await webSearch(lastUser.content); }
            catch (e) { sources = null; }
            if (!sources) A.toast('Пошук зараз недоступний, відповідаю без нього');
        }

        setStatus('Думає…');
        const thinkBox = h('details', { class: 'think', hidden: true },
            h('summary', { text: 'Міркування…' }),
            h('pre', { class: 'think-pre' }));
        const ans = h('div', { class: 'ans' },
            h('span', { class: 'typing' }, h('i'), h('i'), h('i')));
        const typing = h('div', { class: 'msg ai' }, A.icon('akorik', 'msg-av'),
            h('div', { class: 'msg-col' }, h('div', { class: 'bubble' }, thinkBox, ans)));
        log.appendChild(typing);
        toBottom();

        controller = new AbortController();
        let text = '';
        let think = '';
        let timer = 0;
        const paint = () => {
            timer = 0;
            const stick = nearBottom();
            if (think) {
                thinkBox.hidden = false;
                thinkBox.querySelector('.think-pre').textContent = think;
            }
            ans.innerHTML = md(text);
            if (stick) toBottom();
        };
        const schedule = () => { if (!timer) timer = setTimeout(paint, 45); };

        const sysText = SYSTEM + (sources
            ? '\n\nРезультати пошуку (посилайся на них як [1], [2] тощо; якщо нічого релевантного немає, скажи про це):\n' +
              sources.map((s, i) => '[' + (i + 1) + '] ' + s.title + ' — ' + s.url + '\n' + (s.snippet || '')).join('\n\n')
            : '');

        try {
            const headers = { 'Content-Type': 'application/json' };
            if (ep.key) headers.Authorization = 'Bearer ' + ep.key;
            const res = await fetch(ep.url, {
                method: 'POST',
                headers,
                signal: controller.signal,
                body: JSON.stringify({
                    mode: getMode(),
                    model: A.cfg.AI_MODEL,
                    messages: [{ role: 'system', content: sysText }].concat(textHistory()),
                    stream: true,
                    temperature: 0.7,
                    think: thinkOn(),
                    max_completion_tokens: 1200,
                    reasoning_effort: thinkOn() ? 'high' : 'low'
                })
            });
            if (!res.ok) throw Object.assign(new Error('http'), { status: res.status });

            if (res.body && res.body.getReader) {
                await readStream(res, (kind, chunk) => {
                    if (kind === 'content') text += chunk; else think += chunk;
                    schedule();
                });
            } else {
                const j = await res.json();
                text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
            }
            clearTimeout(timer);
            if (!text.trim()) throw Object.assign(new Error('empty'), { status: 0, empty: true });
            typing.remove();
            history.push({ role: 'assistant', content: text.trim(), think: think.trim() || undefined, sources: sources || undefined });
            save();
            addAi(history[history.length - 1]);
            toBottom();
        } catch (e) {
            clearTimeout(timer);
            typing.remove();
            if (e.name === 'AbortError') {
                if (text.trim()) {
                    history.push({ role: 'assistant', content: text.trim(), think: think.trim() || undefined, sources: sources || undefined });
                    save();
                    addAi(history[history.length - 1]);
                }
            } else if (e.empty) {
                errorBubble('Відповідь вийшла порожньою. Спробуйте переформулювати питання.', true);
            } else if (e.status) {
                errorBubble(explain(e.status), e.status !== 401 && e.status !== 403);
            } else {
                errorBubble('Немає зв’язку з сервером. Перевірте інтернет і спробуйте ще раз.', true);
            }
        } finally {
            controller = null;
            setBusy(false);
            toBottom();
        }
    }

    async function draw(prompt, rawText) {
        history.push({ role: 'user', content: rawText });
        save();
        addUser(rawText);
        suggestEl.hidden = true;
        if (!prompt) {
            const m = { role: 'assistant', content: 'Опишіть, що саме намалювати. Наприклад: намалюй дракона на даху хмарочоса.' };
            history.push(m); save(); addAi(m); toBottom();
            return;
        }
        setBusy(true);
        setStatus('Малює…');
        const holder = addAi(null);
        holder.bubble.classList.add('has-img');
        holder.bubble.append(h('div', { class: 'img-wait' }, h('span', { class: 'typing' }, h('i'), h('i'), h('i')), h('span', { text: 'Малюю, це може зайняти до хвилини…' })));
        toBottom();
        try {
            let url = imageUrl(prompt, true);
            try { await loadImage(url); }
            catch (e1) { url = imageUrl(prompt, false); await loadImage(url); }
            holder.bubble.textContent = '';
            holder.bubble.append(imageFigure(url, prompt));
            history.push({ role: 'assistant', kind: 'image', content: 'Картинка: ' + prompt, url, prompt });
            save();
        } catch (e) {
            holder.el.remove();
            errorBubble('Не вдалося намалювати картинку. Сервіс малювання може бути перевантажений. Спробуйте ще раз трохи пізніше.', false);
        } finally {
            setBusy(false);
            toBottom();
        }
    }

    function ask(text) {
        text = String(text || '').trim();
        if (!text) return false;
        if (busy) { A.toast('Акорик ще відповідає. Дочекайтеся або натисніть «Зупинити».'); return false; }
        const img = imageRequest(text);
        if (img !== null) { draw(img, text); return true; }
        history.push({ role: 'user', content: text });
        save();
        addUser(text);
        suggestEl.hidden = true;
        respond();
        return true;
    }

    function clear() {
        if (controller) controller.abort();
        A.stopSpeak();
        history = [];
        A.store.del('chat2');
        renderAll();
    }

    function autosize() {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 130) + 'px';
    }

    function plugBtn(label, key, disabledWhen) {
        const on = !!A.store.get(key, false);
        const b = h('button', {
            class: 'plug' + (on ? ' on' : ''),
            type: 'button',
            'aria-pressed': String(on),
            disabled: !!disabledWhen,
            title: disabledWhen ? 'Потрібен AI_PROXY_URL у js/config.js' : '',
            onclick: () => {
                const v = !A.store.get(key, false);
                A.store.set(key, v);
                b.classList.toggle('on', v);
                b.setAttribute('aria-pressed', String(v));
            }
        }, label);
        return b;
    }

    function modeChip(key) {
        return h('button', {
            class: 'plug' + (getMode() === key ? ' on' : ''),
            type: 'button',
            'data-mode': key,
            'aria-pressed': String(getMode() === key),
            onclick: () => {
                A.store.set('ai_mode', key);
                refreshChips();
                setStatus('Модель: ' + MODE_NAMES[key]);
            }
        }, MODE_NAMES[key]);
    }

    function refreshChips() {
        const box = A.$('#ai-models');
        if (!box) return;
        box.querySelectorAll('[data-mode]').forEach(b => {
            const on = b.dataset.mode === getMode();
            b.classList.toggle('on', on);
            b.setAttribute('aria-pressed', String(on));
        });
    }

    function init() {
        log = A.$('#ai-log');
        form = A.$('#ai-form');
        input = A.$('#ai-input');
        sendBtn = A.$('#ai-send');
        statusEl = A.$('#ai-status');
        suggestEl = A.$('#ai-suggest');
        if (!log || !form) return;

        injectCss();

        history = A.store.get('chat2', []);
        if (!Array.isArray(history)) history = [];

        let box = A.$('#ai-models');
        if (!box) {
            box = h('div', { id: 'ai-models', class: 'ai-models' });
            form.parentNode.insertBefore(box, form);
        }
        box.textContent = '';
        Object.keys(MODE_NAMES).forEach(k => box.appendChild(modeChip(k)));
        box.appendChild(h('span', { class: 'sep' }));
        box.appendChild(plugBtn('🔍 Пошук', 'ai_search', !A.cfg.AI_PROXY_URL));
        box.appendChild(plugBtn('🧠 Думай', 'ai_think', false));

        SUGGESTIONS.forEach(s => suggestEl.appendChild(h('button', { class: 'chip', type: 'button', onclick: () => ask(s) }, s)));

        form.addEventListener('submit', e => {
            e.preventDefault();
            if (busy) { if (controller) controller.abort(); return; }
            const v = input.value;
            if (ask(v)) { input.value = ''; autosize(); }
        });
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true })); }
        });
        input.addEventListener('input', autosize);
        A.$('#ai-clear').addEventListener('click', () => { if (!history.length || confirm('Очистити розмову з Акориком?')) clear(); });

        renderAll();
        setBusy(false);
    }

    window.AIModule = { init: init };
    A.ai = { init, ask, clear, md, imageRequest, focus: () => input && input.focus() };
})();
