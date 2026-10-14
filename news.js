/* Новини України через rss2json. Показує кеш, якщо мережа підвела. */
(function () {
    'use strict';
    const A = window.Acore;
    const { h } = A;

    const SOURCES = [
        { id: 'up', name: 'Українська правда', rss: 'https://www.pravda.com.ua/rss/', site: 'https://www.pravda.com.ua' },
        { id: 'epravda', name: 'Економічна правда', rss: 'https://www.epravda.com.ua/rss/', site: 'https://www.epravda.com.ua' },
        { id: 'eurointegration', name: 'Європейська правда', rss: 'https://www.eurointegration.com.ua/rss/', site: 'https://www.eurointegration.com.ua' }
    ];

    let current = 'up';
    let listEl, noteEl, chipsEl;
    let seq = 0; // щоб відповідь старого запиту не перезаписала новий вибір

    const safeUrl = u => (/^https?:\/\//i.test(String(u || '')) ? u : '#');

    function parseDate(s) {
        if (!s) return null;
        const t = Date.parse(String(s).replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? '' : 'Z'));
        return Number.isNaN(t) ? null : t;
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

    function clock(ts) {
        return new Date(ts).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    }

    function pickImage(it) {
        const enc = it.enclosure && /image/.test(it.enclosure.type || '') ? it.enclosure.link : '';
        return [it.thumbnail, enc].find(u => safeUrl(u) !== '#') || '';
    }

    function normalize(items) {
        return items.slice(0, 15).map(it => ({
            title: String(it.title || '').trim(),
            link: safeUrl(it.link),
            at: parseDate(it.pubDate),
            img: pickImage(it)
        })).filter(x => x.title && x.link !== '#');
    }

    function picture(src) {
        const img = h('img', { class: 'news-img', src, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
        img.addEventListener('error', () => img.remove());
        return img;
    }

    function render(items) {
        listEl.textContent = '';
        items.forEach((it, i) => {
            const meta = h('span', { class: 'news-meta', text: ago(it.at) });
            const a = h('a', { class: 'news-title', href: it.link, target: '_blank', rel: 'noopener noreferrer', text: it.title });
            const row = h('article', { class: i === 0 ? 'news-item lead' : 'news-item' },
                h('div', { class: 'news-text' }, a, meta),
                it.img ? picture(it.img) : null);
            listEl.appendChild(row);
        });
    }

    function fallback(src) {
        listEl.textContent = '';
        SOURCES.forEach(s => listEl.appendChild(h('article', { class: 'news-item' },
            h('div', { class: 'news-text' },
                h('a', { class: 'news-title', href: s.site, target: '_blank', rel: 'noopener noreferrer', text: s.name }),
                h('span', { class: 'news-meta', text: 'Відкрити сайт' })))));
    }

    function skeleton() {
        listEl.textContent = '';
        for (let i = 0; i < 5; i++) listEl.appendChild(h('div', { class: 'skeleton' }));
    }

    async function load(id) {
        const src = SOURCES.find(s => s.id === id) || SOURCES[0];
        current = src.id;
        A.store.set('news_src', current);
        paintChips();
        const mine = ++seq;
        skeleton();
        noteEl.textContent = '';

        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 12000);
        try {
            const res = await fetch('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(src.rss), { signal: ctrl.signal });
            if (!res.ok) throw new Error('http ' + res.status);
            const data = await res.json();
            if (data.status !== 'ok' || !Array.isArray(data.items)) throw new Error('bad feed');
            const items = normalize(data.items);
            if (!items.length) throw new Error('empty');
            A.store.set('news_' + src.id, { t: Date.now(), items });
            if (mine !== seq) return;
            render(items);
            noteEl.textContent = 'Оновлено о ' + clock(Date.now()) + '. Джерело: ' + src.name + '.';
        } catch (e) {
            if (mine !== seq) return;
            const cached = A.store.get('news_' + src.id, null);
            if (cached && cached.items && cached.items.length) {
                render(cached.items);
                noteEl.textContent = 'Не вдалося оновити. Показано новини, збережені о ' + clock(cached.t) + '.';
            } else {
                fallback(src);
                noteEl.textContent = 'Новини не завантажилися. Відкрийте сайти напряму або спробуйте оновити пізніше.';
            }
        } finally {
            clearTimeout(timer);
        }
    }

    function paintChips() {
        chipsEl.textContent = '';
        SOURCES.forEach(s => chipsEl.appendChild(h('button', {
            class: 'chip' + (s.id === current ? ' on' : ''),
            type: 'button',
            'aria-pressed': String(s.id === current),
            text: s.name,
            onclick: () => { if (s.id !== current) load(s.id); }
        })));
    }

    function init() {
        listEl = A.$('#news-list');
        noteEl = A.$('#news-note');
        chipsEl = A.$('#news-sources');
        if (!listEl) return;
        const saved = A.store.get('news_src', 'up');
        current = SOURCES.some(s => s.id === saved) ? saved : 'up';
        A.$('#news-refresh').addEventListener('click', () => load(current));
        load(current);
    }

    A.news = { init, load, parseDate, ago };
})();
