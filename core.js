/* Acore: ядро. Допоміжні функції, вкладки, тема, звук, озвучення. */
(function () {
    'use strict';

    const A = (window.Acore = window.Acore || {});
    const DEFAULTS = {
        AI_PROXY_URL: '',
        AI_MODEL: 'openai/gpt-oss-20b',
        IMAGE_MODEL: 'flux',
        CITY_DEFAULT: { name: 'Черкаси', lat: 49.4444, lon: 32.0598 },
        DONATE_URL: ''
    };
    A.cfg = Object.assign({}, DEFAULTS, window.ACORE_CONFIG || {});

    /* ---------- Утиліти ---------- */
    A.$ = (sel, root) => (root || document).querySelector(sel);
    A.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
    A.clamp = (v, a, b) => Math.min(b, Math.max(a, v));

    const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    A.esc = s => String(s).replace(/[&<>"']/g, c => ESC[c]);

    /** Створює елемент: A.h('div', {class:'x', text:'..', onclick:fn}, child1, child2) */
    A.h = function (tag, props, ...kids) {
        const el = document.createElement(tag);
        for (const k in props || {}) {
            const v = props[k];
            if (v == null || v === false) continue;
            if (k === 'class') el.className = v;
            else if (k === 'text') el.textContent = v;
            else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
            else if (k === 'dataset') Object.assign(el.dataset, v);
            else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
            else el.setAttribute(k, v === true ? '' : v);
        }
        for (const kid of kids.flat()) {
            if (kid == null || kid === false) continue;
            el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
        }
        return el;
    };

    /** Іконка з набору (див. index.html) */
    A.icon = function (id, cls) {
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        if (cls) svg.setAttribute('class', cls);
        svg.setAttribute('aria-hidden', 'true');
        const use = document.createElementNS(ns, 'use');
        use.setAttribute('href', '#' + id);
        svg.appendChild(use);
        return svg;
    };

    /* ---------- Сховище (безпечне, навіть у приватному режимі) ---------- */
    A.store = {
        get(key, fallback) {
            try {
                const raw = localStorage.getItem('acore_' + key);
                return raw === null ? fallback : JSON.parse(raw);
            } catch (e) { return fallback; }
        },
        set(key, value) {
            try { localStorage.setItem('acore_' + key, JSON.stringify(value)); return true; }
            catch (e) { return false; }
        },
        del(key) { try { localStorage.removeItem('acore_' + key); } catch (e) { /* нічого */ } }
    };

    /* ---------- Прості події ---------- */
    const handlers = {};
    A.on = (name, fn) => { (handlers[name] = handlers[name] || []).push(fn); };
    A.emit = (name, data) => { (handlers[name] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } }); };

    /* ---------- Підказки (toast) ---------- */
    A.toast = function (text, ms) {
        const box = document.getElementById('toasts');
        if (!box) return;
        const t = A.h('div', { class: 'toast', text });
        box.appendChild(t);
        setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms || 2600);
    };

    /* ---------- Тема ---------- */
    const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    A.theme = {
        get() { return A.store.get('theme', 'auto'); },
        effective() {
            const t = this.get();
            return t === 'auto' ? (mq && mq.matches ? 'dark' : 'light') : t;
        },
        set(mode) {
            if (!['auto', 'light', 'dark'].includes(mode)) mode = 'auto';
            A.store.set('theme', mode);
            this.apply();
        },
        toggle() { this.set(this.effective() === 'dark' ? 'light' : 'dark'); },
        apply() {
            document.documentElement.dataset.theme = this.get();
            const dark = this.effective() === 'dark';
            const meta = document.querySelector('meta[name="theme-color"]');
            if (meta) meta.setAttribute('content', dark ? '#0E1024' : '#F3F4FC');
            A.$$('#theme-toggle-rail use, #theme-toggle-top use').forEach(u => u.setAttribute('href', dark ? '#i-sun' : '#i-moon'));
            const sel = document.getElementById('theme-select');
            if (sel) sel.value = this.get();
        }
    };
    if (mq && mq.addEventListener) mq.addEventListener('change', () => A.theme.apply());

    /* ---------- Звук (генерується в браузері, файлів не треба) ---------- */
    A.sound = {
        enabled: A.store.get('sound', true),
        ctx: null,
        _noise: null,
        _ensure() {
            if (!this.enabled) return null;
            if (!this.ctx) {
                const C = window.AudioContext || window.webkitAudioContext;
                if (!C) return null;
                try { this.ctx = new C(); } catch (e) { return null; }
            }
            if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
            return this.ctx;
        },
        beep(freq, dur, type, vol, slideTo) {
            const c = this._ensure();
            if (!c) return;
            freq = freq || 440; dur = dur || 0.08; vol = vol == null ? 0.05 : vol;
            const t = c.currentTime;
            const o = c.createOscillator();
            const g = c.createGain();
            o.type = type || 'square';
            o.frequency.setValueAtTime(freq, t);
            if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
            g.gain.setValueAtTime(vol, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            o.connect(g); g.connect(c.destination);
            o.start(t); o.stop(t + dur + 0.02);
        },
        noise(dur, vol) {
            const c = this._ensure();
            if (!c) return;
            dur = dur || 0.1; vol = vol == null ? 0.05 : vol;
            if (!this._noise) {
                const len = c.sampleRate;
                const buf = c.createBuffer(1, len, c.sampleRate);
                const d = buf.getChannelData(0);
                for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
                this._noise = buf;
            }
            const t = c.currentTime;
            const src = c.createBufferSource();
            const g = c.createGain();
            src.buffer = this._noise;
            g.gain.setValueAtTime(vol, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            src.connect(g); g.connect(c.destination);
            src.start(t); src.stop(t + dur + 0.02);
        },
        toggle() {
            this.enabled = !this.enabled;
            A.store.set('sound', this.enabled);
            this.syncButton();
            if (this.enabled) this.beep(660, 0.07, 'triangle', 0.06);
            return this.enabled;
        },
        syncButton() {
            const b = document.getElementById('sound-toggle');
            if (!b) return;
            b.setAttribute('aria-pressed', String(this.enabled));
            b.setAttribute('aria-label', this.enabled ? 'Звук увімкнено' : 'Звук вимкнено');
            const u = b.querySelector('use');
            if (u) u.setAttribute('href', this.enabled ? '#i-sound' : '#i-mute');
        }
    };

    /* ---------- Озвучення тексту ---------- */
    A.speak = function (text, lang) {
        if (!('speechSynthesis' in window)) { A.toast('Цей браузер не вміє озвучувати текст'); return false; }
        lang = lang || 'uk-UA';
        const synth = window.speechSynthesis;
        synth.cancel();
        const clean = String(text).replace(/[`*#_>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 2500);
        if (!clean) return false;
        const u = new SpeechSynthesisUtterance(clean);
        u.lang = lang;
        u.rate = 0.98;
        const prefix = lang.slice(0, 2).toLowerCase();
        const voice = synth.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith(prefix));
        if (voice) u.voice = voice;
        synth.speak(u);
        return true;
    };
    A.stopSpeak = function () { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); };

    /* ---------- Розділи (вкладки) ---------- */
    const TABS = ['news', 'ai', 'games', 'mail', 'tools'];
    let current = null;
    A.tabs = TABS;
    A.current = () => current;

    A.go = function (id) {
        if (!TABS.includes(id)) id = 'news';
        if (id === current) return;
        const prev = current;
        current = id;
        A.$$('.tab').forEach(s => { s.hidden = s.id !== 'tab-' + id; });
        A.$$('.nav-btn').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
        if (prev && window.scrollTo) window.scrollTo(0, 0);
        if (location.hash !== '#' + id) {
            try { history.replaceState(null, '', '#' + id); } catch (e) { /* file:// у деяких браузерах */ }
        }
        A.emit('tab', { id, prev });
    };

    A.initTabs = function () {
        A.$$('.nav-btn').forEach(b => b.addEventListener('click', () => A.go(b.dataset.tab)));
        A.$$('.brand').forEach(a => a.addEventListener('click', e => { e.preventDefault(); A.go('news'); }));
        window.addEventListener('hashchange', () => A.go(location.hash.slice(1)));
        A.go(location.hash.slice(1) || 'news');
    };
})();
