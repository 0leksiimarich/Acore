/* Акорик: чат зі ШІ (Groq через ваш проксі) і генерація картинок (Pollinations). */
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

        // [текст](https://адреса)
        t = t.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, text, url) => {
            links.push('<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + text + '</a>');
            return '\u0000L' + (links.length - 1) + '\u0000';
        });
        // голі адреси
        t = t.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g, url => {
            links.push('<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + '</a>');
            return '\u0000L' + (links.length - 1) + '\u0000';
        });

        t = t.replace(/^#{1,4}\s+(.+)$/gm, '<strong>$1</strong>');
        t = t.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
        t = t.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');

        // Абзаци та списки
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

    /* ---------- Мережа ---------- */
    function endpoint() {
        const proxy = (A.cfg.AI_PROXY_URL || '').trim();
        if (proxy) return { url: proxy.replace(/\/+$/, '') + '/chat', key: null };
        const key = A.store.get('groq_key', '');
        if (key) return { url: 'https://api.groq.com/openai/v1/chat/completions', key };
        return null;
    }

    function explain(status) {
        if (status === 401 || status === 403) return 'Доступ не дозволено. Перевірте ключ або налаштування проксі.';
        if (status === 429) return 'Забагато запитів. Зачекайте хвилину і спробуйте знову.';
        if (status >= 500) return 'Сервіс ШІ тимчасово недоступний. Спробуйте трохи пізніше.';
        return 'Не вдалося отримати відповідь (код ' + status + ').';
    }

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
                    if (d && d.content) onDelta(d.content);
                } catch (e) { /* неповний шматок, чекаємо наступний */ }
            }
        }
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
        sendBtn.querySelector('use').setAttribute('href', on ? '#i-stop' : '#i-send');
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
        const el = h('div', { class: 'msg user' }, h('div', { class: 'bubble', text }));
        log.appendChild(el);
        toBottom();
    }

    function addAi(m) {
        const bubble = h('div', { class: 'bubble' });
        const el = h('div', { class: 'msg ai' }, A.icon('akorik', 'msg-av'), h('div', { class: 'msg-col' }, bubble));
        if (m && m.kind === 'image') {
            bubble.classList.add('has-img');
            bubble.append(imageFigure(m.url, m.prompt));
        } else if (m) {
            bubble.innerHTML = md(m.content);
            el.querySelector('.msg-col').appendChild(toolButtons(() => m.content));
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
            errorBubble('Я ще не підключений до ШІ. Власнику сайту: вкажіть AI_PROXY_URL у js/config.js (див. README) або вставте ключ Groq у Сервіси → Налаштування для тесту.', false);
            return;
        }
        setBusy(true);
        setStatus('Думає…');
        const typing = h('div', { class: 'msg ai' }, A.icon('akorik', 'msg-av'),
            h('div', { class: 'msg-col' }, h('div', { class: 'bubble' }, h('span', { class: 'typing' }, h('i'), h('i'), h('i')))));
        log.appendChild(typing);
        toBottom();

        controller = new AbortController();
        let text = '';
        let timer = 0;
        const bubble = typing.querySelector('.bubble');
        const paint = () => {
            timer = 0;
            const stick = nearBottom();
            bubble.innerHTML = md(text);
            if (stick) toBottom();
        };

        try {
            const headers = { 'Content-Type': 'application/json' };
            if (ep.key) headers.Authorization = 'Bearer ' + ep.key;
            const res = await fetch(ep.url, {
                method: 'POST',
                headers,
                signal: controller.signal,
                body: JSON.stringify({
                    model: A.cfg.AI_MODEL,
                    messages: [{ role: 'system', content: SYSTEM }].concat(textHistory()),
                    stream: true,
                    temperature: 0.7,
                    max_completion_tokens: 1200,
                    reasoning_effort: 'low'
                })
            });
            if (!res.ok) throw Object.assign(new Error('http'), { status: res.status });

            if (res.body && res.body.getReader) {
                await readStream(res, delta => { text += delta; if (!timer) timer = setTimeout(paint, 45); });
            } else {
                const j = await res.json();
                text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
            }
            clearTimeout(timer);
            if (!text.trim()) throw Object.assign(new Error('empty'), { status: 0, empty: true });
            typing.remove();
            history.push({ role: 'assistant', content: text.trim() });
            save();
            addAi(history[history.length - 1]);
            toBottom();
        } catch (e) {
            clearTimeout(timer);
            typing.remove();
            if (e.name === 'AbortError') {
                if (text.trim()) {
                    history.push({ role: 'assistant', content: text.trim() });
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

    function init() {
        log = A.$('#ai-log');
        form = A.$('#ai-form');
        input = A.$('#ai-input');
        sendBtn = A.$('#ai-send');
        statusEl = A.$('#ai-status');
        suggestEl = A.$('#ai-suggest');
        if (!log || !form) return;

        history = A.store.get('chat2', []);
        if (!Array.isArray(history)) history = [];

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

    A.ai = { init, ask, clear, md, imageRequest, focus: () => input && input.focus() };
})();
