/* Новини: категорії, джерела, фото, налаштування. Дані беруться через Cloudflare Worker (/news). */
(function () {
    'use strict';
    const A = window.Acore;
    const { h } = A;

    // Джерела. Список має збігатися з NEWS_FEEDS у worker/worker.js
    const CATEGORIES = [
        { id: 'war', name: 'Війна', feeds: [
            { name: 'Українська правда', rss: 'https://www.pravda.com.ua/rss/' },
            { name: 'Європейська правда', rss: 'https://www.eurointegration.com.ua/rss/' },
            { name: 'Суспільне', rss: 'https://suspilne.media/rss/all.rss' },
            { name: 'Цензор.НЕТ', rss: 'https://censor.net/includes/news_uk.xml' },
            { name: 'Hromadske', rss: 'https://hromadske.ua/rss' },
            { name: 'BBC Europe', rss: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
            { name: 'DW', rss: 'https://rss.dw.com/rdf/rss-en-world' }
        ]},
        { id: 'world', name: 'Світ', feeds: [
            { name: 'BBC World', rss: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
            { name: 'The Guardian World', rss: 'https://www.theguardian.com/world/rss' },
            { name: 'NYT World', rss: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
            { name: 'Al Jazeera', rss: 'https://www.aljazeera.com/xml/rss/all.xml' },
            { name: 'France 24', rss: 'https://www.france24.com/en/rss' },
            { name: 'Euronews', rss: 'https://www.euronews.com/rss' }
        ]},
        { id: 'other', name: 'Інше', feeds: [
            { name: 'Економічна правда', rss: 'https://www.epravda.com.ua/rss/' },
            { name: 'LB.ua', rss: 'https://lb.ua/rss/' },
            { name: 'Бабель', rss: 'https://babel.ua/rss' },
            { name: 'BBC Technology', rss: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
            { name: 'BBC Sport', rss: 'https://feeds.bbci.co.uk/sport/rss.xml' },
            { name: 'The Verge', rss: 'https://www.theverge.com/rss/index.xml' }
        ]}
    ];
    const COUNT_OPTIONS = [10, 15, 20, 30];
    const DEFAULTS = { cat: 'war', count: 15, images: true, cats: {}, feeds: {} };
    const TIMEOUT = 15000;

    let cfg, listEl, noteEl, chipsEl, panelEl;
    let seq = 0;

    const worker = () => ((A.cfg && A.cfg.AI_PROXY_URL) || '').replace(/\/+$/, '');

    function loadCfg() {
        const saved = A.store.get('news_cfg', {}) || {};
        cfg = Object.assign({}, DEFAULTS, saved);
        cfg.cats = Object.assign({}, saved.cats);
        cfg.feeds = Object.assign({}, saved.feeds);
        if (!CATEGORIES.some(c => c.id === cfg.cat)) cfg.cat = CATEGORIES[0].id;
        if (!COUNT_OPTIONS.includes(cfg.count)) cfg.count = DEFAULTS.count;
    }
    const saveCfg = () => A.store.set('news_cfg', cfg);
    const catOn = c => cfg.cats[c.id] !== false;
    const feedOn = f => cfg.feeds[f.rss] !== false;

    function parseDate(s) {
        const t = Date.parse(s);
        return Number.isNaN(t) ? 0 : t;
    }
    function ago(ts) {
        if (!ts) return '';
        const m = Math.round((Date.now() - ts) / 60000);
        if (m < 1) return 'щойно';
        if (m < 60) return m + ' хв тому';
        const hrs = Math.round(m / 60);
        if (hrs < 24) return hrs + ' год тому';
        const d = Math.round(hrs / 24);
        return d === 1 ? 'вчора' : d + ' дн. тому';
    }
    const clock = ts => new Date(ts).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });

    async function fetchFeed(feed) {
        if (!worker()) throw new Error('worker_not_configured');
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
        try {
            const res = await fetch(worker() + '/news?feed=' + encodeURIComponent(feed.rss), { signal: ctrl.signal });
            if (!res.ok) throw new Error('http ' + res.status);
            const data = await res.json();
            return (data.items || []).map(it => ({
                title: it.title,
                link: it.link,
                at: parseDate(it.date),
                img: it.img || '',
                source: feed.name
            }));
        } finally {
            clearTimeout(timer);
        }
    }

    function mergeItems(lists, count) {
        const seen = new Set();
        const all = [].concat(...lists).sort((a, b) => (b.at || 0) - (a.at || 0));
        const out = [];
        for (const it of all) {
            const key = it.link || it.title;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(it);
            if (out.length >= count) break;
        }
        return out;
    }

    function picture(src) {
        const img = h('img', { class: 'news-img', src, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
        img.addEventListener('error', () => img.remove());
        return img;
    }

    function render(items) {
        listEl.textContent = '';
        if (!items.length) {
            listEl.appendChild(h('div', { class: 'news-empty', text: 'Немає новин у цій категорії.' }));
            return;
        }
        items.forEach((it, i) => {
            const text = h('div', { class: 'news-text' },
                h('a', { class: 'news-title', href: it.link, target: '_blank', rel: 'noopener noreferrer', text: it.title }),
                h('span', { class: 'news-meta', text: it.source + ' · ' + ago(it.at) }));
            const row = h('article', { class: i === 0 ? 'news-item lead' : 'news-item' },
                cfg.images && it.img ? picture(it.img) : null,
                text);
            listEl.appendChild(row);
        });
    }

    function skeleton() {
        listEl.textContent = '';
        for (let i = 0; i < 5; i++) listEl.appendChild(h('div', { class: 'skeleton' }));
    }

    async function load(catId) {
        const cat = CATEGORIES.find(c => c.id === catId) || CATEGORIES[0];
        cfg.cat = cat.id;
        saveCfg();
        paintChips();
        const mine = ++seq;
        noteEl.textContent = '';

        const feeds = cat.feeds.filter(feedOn);
        if (!feeds.length) {
            listEl.textContent = '';
            noteEl.textContent = 'Усі джерела цієї категорії вимкнено. Увімкніть їх у налаштуваннях.';
            return;
        }
        skeleton();

        const results = await Promise.allSettled(feeds.map(fetchFeed));
        if (mine !== seq) return;
        const lists = results.filter(r => r.status === 'fulfilled').map(r => r.value);
        const failed = results.length - lists.length;

        if (lists.length) {
            const items = mergeItems(lists, cfg.count);
            A.store.set('news_cache_' + cat.id, { t: Date.now(), items });
            render(items);
            noteEl.textContent = 'Оновлено о ' + clock(Date.now()) +
                (failed ? '. Недоступних джерел: ' + failed + '.' : '.');
            return;
        }
        const cached = A.store.get('news_cache_' + cat.id, null);
        if (cached && cached.items && cached.items.length) {
            render(cached.items.slice(0, cfg.count));
            noteEl.textContent = 'Не вдалося оновити. Показано новини, збережені о ' + clock(cached.t) + '.';
        } else {
            listEl.textContent = '';
            noteEl.textContent = worker()
                ? 'Новини не завантажилися. Спробуйте оновити пізніше.'
                : 'Новини ще не підключено. Власнику сайту: вкажіть AI_PROXY_URL у js/config.js.';
        }
    }

    function paintChips() {
        chipsEl.textContent = '';
        CATEGORIES.filter(catOn).forEach(c => chipsEl.appendChild(h('button', {
            class: 'chip' + (c.id === cfg.cat ? ' on' : ''),
            type: 'button',
            'aria-pressed': String(c.id === cfg.cat),
            text: c.name,
            onclick: () => { if (c.id !== cfg.cat) load(c.id); }
        })));
    }

    function paintSettings() {
        panelEl.textContent = '';
        const check = (labelText, checked, onChange) => h('label', { class: 'news-opt' },
            h('input', { type: 'checkbox', checked: checked ? true : null, onchange: e => onChange(e.target.checked) }),
            ' ' + labelText);

        panelEl.appendChild(h('div', { class: 'news-opt-title', text: 'Категорії' }));
        CATEGORIES.forEach(c => {
            panelEl.appendChild(check(c.name, catOn(c), v => {
                cfg.cats[c.id] = v;
                saveCfg();
                if (!v && cfg.cat === c.id) {
                    const first = CATEGORIES.find(catOn);
                    if (first) load(first.id);
                }
                paintChips();
                paintSettings();
            }));
            c.feeds.forEach(f => {
                panelEl.appendChild(h('div', { class: 'news-opt-sub' },
                    check(f.name, feedOn(f), v => {
                        cfg.feeds[f.rss] = v;
                        saveCfg();
                        if (cfg.cat === c.id) load(c.id);
                        paintSettings();
                    })));
            });
        });

        panelEl.appendChild(h('div', { class: 'news-opt-title', text: 'Показ' }));
        panelEl.appendChild(check('Показувати фото', cfg.images, v => {
            cfg.images = v;
            saveCfg();
            load(cfg.cat);
        }));
        const sel = h('select', {
            class: 'news-select',
            onchange: e => { cfg.count = Number(e.target.value); saveCfg(); load(cfg.cat); }
        });
        COUNT_OPTIONS.forEach(n => {
            const o = h('option', { value: String(n) }, n + ' новин');
            if (n === cfg.count) o.selected = true;
            sel.appendChild(o);
        });
        panelEl.appendChild(h('label', { class: 'news-opt' }, 'Кількість: ', sel));
    }

    function init() {
        listEl = A.$('#news-list');
        noteEl = A.$('#news-note');
        chipsEl = A.$('#news-chips');
        panelEl = A.$('#news-settings');
        if (!listEl) return;
        loadCfg();
        A.$('#news-refresh').addEventListener('click', () => load(cfg.cat));
        A.$('#news-settings-btn').addEventListener('click', () => {
            const open = panelEl.hidden;
            panelEl.hidden = !open;
            if (open) paintSettings();
        });
        panelEl.hidden = true;
        load(cfg.cat);
    }

    window.NewsModule = { init };
    A.news = { init, load, parseDate, ago };
})();
