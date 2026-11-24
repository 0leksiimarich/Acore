/* Спільний модуль «✨ ШІ» для офісних програм Acore (A-Docx, A-Presentation, A-Table).
 * Використовує той самий ШІ-чат (AI_PROXY_URL), нових ключів не потрібно.
 *
 * Підключення на сторінці:
 *   <script src="js/office-ai.js"></script>
 * Використання:
 *   OfficeAI.mount(елемент, { mode: 'docx' | 'slides' | 'table', onInsert: текст => { ... } });
 *   OfficeAI.ask(mode, запит) → Promise<текст>
 */
(function () {
    'use strict';

    const CFG = window.ACORE_CONFIG || {};
    const W = (CFG.AI_PROXY_URL || '').replace(/\/+$/, '');
    const MAX_PROMPT = 500;

    const SYSTEM = {
        docx:
            'Ти пишеш документи українською мовою. Відповідай ТІЛЬКИ текстом документа, без пояснень і без вступних слів. ' +
            'Заголовки починай з "## ". Звичайний текст пиши абзацами. Списки починай з "- ". ' +
            'Не вигадуй імен, дат, цифр і фактів: якщо їх немає в запиті, став позначку [уточнити].',
        slides:
            'Ти складаєш план презентації українською мовою. Відповідай ТІЛЬКИ планом. ' +
            'Кожен слайд починається з рядка "## Заголовок слайда", далі 2–5 пунктів, кожен з "- ". ' +
            'Без пояснень. Не вигадуй фактів: якщо даних бракує, став [уточнити].',
        table:
            'Ти допомагаєш з таблицями. Відповідай ТІЛЬКИ однією формулою, яка починається зі знака =, без пояснень і без лапок. ' +
            'Використовуй адреси клітинок (A1, B2) і функції SUM, AVERAGE, MIN, MAX, COUNT, IF, ROUND, ABS. ' +
            'Якщо запит неможливо виконати цими функціями, відповідай: =NA()'
    };

    const UI = {
        docx:   { btn: '✨ ШІ: створити документ', ask: 'Опишіть документ', place: 'Наприклад: заява на відпустку на 2 тижні, з 1 по 14 грудня' },
        slides: { btn: '✨ ШІ: скласти слайди',    ask: 'Опишіть презентацію', place: 'Наприклад: 6 слайдів про переваги роботи з хмарою для шкільного проєкту' },
        table:  { btn: '✨ ШІ: формула',           ask: 'Опишіть, що порахувати', place: 'Наприклад: сума стовпця B, де C більше 10' }
    };

    /* ---------- Мережа ---------- */
    async function ask(mode, prompt) {
        if (!SYSTEM[mode]) throw new Error('Невідомий режим: ' + mode);
        if (!W) throw new Error('ШІ ще не підключено (AI_PROXY_URL у config.js).');
        const text = String(prompt || '').trim().slice(0, MAX_PROMPT);
        if (!text) throw new Error('Опишіть, що потрібно.');

        const res = await fetch(W + '/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: 'general',
                messages: [{ role: 'system', content: SYSTEM[mode] }, { role: 'user', content: text }],
                stream: true,
                temperature: 0.4
            })
        });
        if (!res.ok) throw new Error('Сервіс ШІ відповів помилкою (код ' + res.status + '). Спробуйте пізніше.');

        let out = '';
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
                if (data === '[DONE]') return cleanup(out, mode);
                try {
                    const j = JSON.parse(data);
                    const c = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
                    if (c) out += c;
                } catch (e) { /* неповний шматок */ }
            }
        }
        return cleanup(out, mode);
    }

    // Прибираємо зайве, яке модель іноді додає (огорожі коду, зайві пробіли)
    function cleanup(text, mode) {
        let t = String(text || '').replace(/^```[\w]*\n?/, '').replace(/\n?```\s*$/, '').trim();
        if (mode === 'table') {
            const m = t.match(/=[^\n]*/);
            t = m ? m[0].trim() : '=NA()';
        }
        return t;
    }

    /* ---------- Інтерфейс ---------- */
    let styled = false;
    function injectStyle() {
        if (styled) return;
        styled = true;
        const s = document.createElement('style');
        s.textContent = `
.oai-wrap { margin: 8px 0; }
.oai-btn { padding: 7px 12px; border: 1px solid var(--line, #d9dfea); border-radius: 6px; background: var(--surface, #fff); color: var(--ink, #1b2433); font-size: 13px; font-weight: 600; cursor: pointer; }
.oai-btn:hover { border-color: var(--brand, #1a4a84); color: var(--brand, #1a4a84); }
.oai-panel { margin-top: 8px; padding: 12px; border: 1px solid var(--line, #d9dfea); border-radius: 8px; background: var(--surface, #fff); display: none; }
.oai-panel.open { display: block; }
.oai-panel textarea { width: 100%; min-height: 64px; padding: 8px; border: 1px solid var(--line, #d9dfea); border-radius: 6px; font: inherit; font-size: 14px; resize: vertical; background: #fff; color: var(--ink, #1b2433); }
.oai-row { display: flex; gap: 8px; align-items: center; margin-top: 8px; flex-wrap: wrap; }
.oai-go { padding: 7px 14px; border: none; border-radius: 6px; background: var(--brand, #1a4a84); color: #fff; font-weight: 600; font-size: 13px; cursor: pointer; }
.oai-go:disabled { opacity: .5; cursor: default; }
.oai-ins { padding: 7px 14px; border: 1px solid var(--brand, #1a4a84); border-radius: 6px; background: #fff; color: var(--brand, #1a4a84); font-weight: 600; font-size: 13px; cursor: pointer; }
.oai-ins:disabled { opacity: .4; cursor: default; }
.oai-status { font-size: 12px; color: var(--ink-soft, #6b7587); }
.oai-out { margin-top: 8px; padding: 10px; border: 1px solid var(--line, #d9dfea); border-radius: 6px; background: var(--bg, #f4f6fb); font-size: 14px; line-height: 1.5; white-space: pre-wrap; color: var(--ink, #1b2433); max-height: 240px; overflow: auto; }
`;
        document.head.appendChild(s);
    }

    function mount(host, opts) {
        if (!host) throw new Error('Не знайдено елемент для кнопки ШІ.');
        const mode = (opts && opts.mode) || 'docx';
        const ui = UI[mode];
        if (!ui) throw new Error('Невідомий режим: ' + mode);
        injectStyle();

        const wrap = document.createElement('div');
        wrap.className = 'oai-wrap';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'oai-btn';
        btn.textContent = ui.btn;

        const panel = document.createElement('div');
        panel.className = 'oai-panel';

        const label = document.createElement('div');
        label.style.cssText = 'font-size:13px; font-weight:600; margin-bottom:6px;';
        label.textContent = ui.ask;

        const ta = document.createElement('textarea');
        ta.maxLength = MAX_PROMPT;
        ta.placeholder = ui.place;

        const row = document.createElement('div');
        row.className = 'oai-row';
        const go = document.createElement('button');
        go.type = 'button';
        go.className = 'oai-go';
        go.textContent = 'Створити';
        const ins = document.createElement('button');
        ins.type = 'button';
        ins.className = 'oai-ins';
        ins.textContent = 'Вставити';
        ins.disabled = true;
        const status = document.createElement('span');
        status.className = 'oai-status';
        row.append(go, ins, status);

        const out = document.createElement('div');
        out.className = 'oai-out';
        out.style.display = 'none';

        panel.append(label, ta, row, out);
        wrap.append(btn, panel);
        host.appendChild(wrap);

        let result = '';
        btn.addEventListener('click', () => {
            panel.classList.toggle('open');
            if (panel.classList.contains('open')) ta.focus();
        });

        go.addEventListener('click', async () => {
            go.disabled = true;
            ins.disabled = true;
            status.textContent = 'Пишу…';
            out.style.display = 'none';
            try {
                result = await ask(mode, ta.value);
                out.textContent = result;
                out.style.display = 'block';
                ins.disabled = !result;
                status.textContent = result ? 'Перевірте текст і натисніть «Вставити»' : 'Порожня відповідь. Спробуйте уточнити запит.';
            } catch (e) {
                result = '';
                status.textContent = e.message;
            } finally {
                go.disabled = false;
            }
        });

        ins.addEventListener('click', () => {
            if (!result) return;
            if (opts && typeof opts.onInsert === 'function') opts.onInsert(result);
            panel.classList.remove('open');
            ta.value = '';
            result = '';
            out.style.display = 'none';
            ins.disabled = true;
            status.textContent = 'Вставлено';
        });

        return { el: wrap, close: () => panel.classList.remove('open') };
    }

    window.OfficeAI = { mount, ask };
})();
