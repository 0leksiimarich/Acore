/* Сервіси: погода (Open-Meteo), курс НБУ, конвертер, перекладач (MyMemory), налаштування. */
(function () {
    'use strict';
    const A = window.Acore;
    const { h, $ } = A;

    /* ---------- Спільне ---------- */
    async function getJSON(url, ms) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), ms || 12000);
        try {
            const res = await fetch(url, { signal: ctrl.signal });
            if (!res.ok) throw new Error('http ' + res.status);
            return await res.json();
        } finally { clearTimeout(timer); }
    }

    const hhmm = ts => new Date(ts).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    const fmt = (n, d) => Number(n).toLocaleString('uk-UA', { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d });

    /* ---------- Вгорі на «Новинах»: коротка зведена смужка ---------- */
    const glance = {};
    function paintGlance() {
        const box = $('#glance');
        if (!box) return;
        box.textContent = '';
        const chip = (cls, label, value) => h('button', {
            class: 'glance-chip ' + cls, type: 'button', 'aria-label': label + ': ' + value,
            onclick: () => A.go('tools')
        }, h('span', { class: 'g-label', text: label }), h('span', { class: 'g-value', text: value }));
        box.append(
            chip('g-weather', glance.city || 'Погода', glance.weather || '…'),
            chip('g-usd', 'USD', glance.usd || '…'),
            chip('g-eur', 'EUR', glance.eur || '…'));
    }

    /* ---------- Погода ---------- */
    const WMO = {
        0: ['Ясно', '☀️'], 1: ['Переважно ясно', '🌤️'], 2: ['Мінлива хмарність', '⛅'], 3: ['Хмарно', '☁️'],
        45: ['Туман', '🌫️'], 48: ['Паморозь і туман', '🌫️'],
        51: ['Легка мряка', '🌦️'], 53: ['Мряка', '🌦️'], 55: ['Сильна мряка', '🌧️'], 56: ['Крижана мряка', '🌧️'], 57: ['Крижана мряка', '🌧️'],
        61: ['Невеликий дощ', '🌦️'], 63: ['Дощ', '🌧️'], 65: ['Сильний дощ', '🌧️'], 66: ['Крижаний дощ', '🌧️'], 67: ['Крижаний дощ', '🌧️'],
        71: ['Невеликий сніг', '🌨️'], 73: ['Сніг', '🌨️'], 75: ['Сильний сніг', '❄️'], 77: ['Снігова крупа', '🌨️'],
        80: ['Короткі зливи', '🌦️'], 81: ['Зливи', '🌧️'], 82: ['Сильні зливи', '⛈️'], 85: ['Снігопад', '🌨️'], 86: ['Сильний снігопад', '❄️'],
        95: ['Гроза', '⛈️'], 96: ['Гроза з градом', '⛈️'], 99: ['Сильна гроза з градом', '⛈️']
    };
    const wmo = c => WMO[c] || ['Погода', '🌡️'];

    let city = null;

    function paintWeather(d, savedAt) {
        const [txt, ico] = wmo(d.current.weather_code);
        const now = $('#weather-now');
        now.textContent = '';
        now.append(
            h('div', { class: 'w-big' }, h('span', { class: 'w-ico', 'aria-hidden': 'true', text: ico }), h('span', { class: 'w-temp', text: Math.round(d.current.temperature_2m) + '°' })),
            h('div', { class: 'w-info' },
                h('strong', { text: city.name }),
                h('span', { text: txt }),
                h('span', { class: 'muted', text: 'Відчувається як ' + Math.round(d.current.apparent_temperature) + '°, вітер ' + Math.round(d.current.wind_speed_10m) + ' км/год' }),
                savedAt ? h('span', { class: 'muted', text: 'Збережено о ' + hhmm(savedAt) + ', оновити не вдалося' }) : null));
        const days = $('#weather-days');
        days.textContent = '';
        d.daily.time.forEach((t, i) => {
            const [dt, di] = wmo(d.daily.weather_code[i]);
            const name = i === 0 ? 'Сьогодні' : new Date(t + 'T12:00:00').toLocaleDateString('uk-UA', { weekday: 'short' });
            days.appendChild(h('div', { class: 'fc-day', title: dt },
                h('span', { class: 'fc-name', text: name }),
                h('span', { class: 'fc-ico', 'aria-hidden': 'true', text: di }),
                h('span', { class: 'fc-max', text: Math.round(d.daily.temperature_2m_max[i]) + '°' }),
                h('span', { class: 'fc-min', text: Math.round(d.daily.temperature_2m_min[i]) + '°' })));
        });
        glance.city = city.name;
        glance.weather = ico + ' ' + Math.round(d.current.temperature_2m) + '°';
        paintGlance();
    }

    async function loadWeather() {
        const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + city.lat + '&longitude=' + city.lon +
            '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m' +
            '&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5';
        try {
            const d = await getJSON(url);
            if (!d.current || !d.daily) throw new Error('bad data');
            A.store.set('weather', { t: Date.now(), city, d });
            paintWeather(d, 0);
        } catch (e) {
            const c = A.store.get('weather', null);
            if (c && c.city && c.city.name === city.name) { paintWeather(c.d, c.t); return; }
            $('#weather-now').textContent = 'Не вдалося завантажити погоду. Спробуйте пізніше.';
            $('#weather-days').textContent = '';
            glance.city = city.name; glance.weather = 'немає даних';
            paintGlance();
        }
    }

    function initWeather() {
        city = A.store.get('city', null) || A.cfg.CITY_DEFAULT;
        $('#city-form').addEventListener('submit', async e => {
            e.preventDefault();
            const q = $('#city-input').value.trim();
            const box = $('#city-results');
            if (q.length < 2) return;
            box.textContent = 'Шукаю…';
            try {
                const r = await getJSON('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(q) + '&count=5&language=uk&format=json');
                box.textContent = '';
                if (!r.results || !r.results.length) { box.textContent = 'Нічого не знайдено. Спробуйте іншу назву.'; return; }
                r.results.forEach(x => {
                    const label = [x.name, x.admin1, x.country].filter(Boolean).join(', ');
                    box.appendChild(h('button', {
                        class: 'chip', type: 'button', text: label,
                        onclick: () => {
                            city = { name: x.name, lat: x.latitude, lon: x.longitude };
                            A.store.set('city', city);
                            box.textContent = '';
                            $('#city-input').value = '';
                            loadWeather();
                        }
                    }));
                });
            } catch (err) { box.textContent = 'Пошук міст зараз недоступний.'; }
        });
        loadWeather();
    }

    /* ---------- Курс НБУ і конвертер ---------- */
    const WANT = ['USD', 'EUR', 'PLN', 'GBP'];
    let rates = {};
    let fromUah = false;

    function paintRates(list, date, savedAt) {
        rates = {};
        list.forEach(r => { rates[r.cc] = r; });
        const box = $('#rates-list');
        box.textContent = '';
        WANT.forEach(cc => {
            const r = rates[cc];
            if (!r) return;
            box.appendChild(h('div', { class: 'rate' },
                h('span', { class: 'rate-cc', text: cc }),
                h('span', { class: 'rate-name', text: r.txt }),
                h('span', { class: 'rate-val', text: fmt(r.rate) + ' грн' })));
        });
        box.appendChild(h('p', { class: 'note', text: savedAt ? 'Збережено о ' + hhmm(savedAt) + ', оновити не вдалося. Курс на ' + date + '.' : 'Офіційний курс на ' + date + '.' }));
        glance.usd = rates.USD ? fmt(rates.USD.rate) : '';
        glance.eur = rates.EUR ? fmt(rates.EUR.rate) : '';
        paintGlance();
        convert();
    }

    async function loadRates() {
        try {
            const data = await getJSON('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json');
            const list = data.filter(r => WANT.includes(r.cc));
            if (!list.length) throw new Error('empty');
            const date = list[0].exchangedate;
            A.store.set('rates', { t: Date.now(), list, date });
            paintRates(list, date, 0);
        } catch (e) {
            const c = A.store.get('rates', null);
            if (c) { paintRates(c.list, c.date, c.t); return; }
            $('#rates-list').textContent = 'Не вдалося завантажити курс. Спробуйте пізніше.';
            glance.usd = 'немає даних'; glance.eur = 'немає даних';
            paintGlance();
        }
    }

    function convert() {
        const out = $('#conv-result');
        const cc = $('#conv-cur').value;
        const amount = parseFloat($('#conv-amount').value);
        const r = rates[cc];
        if (!r || !(amount >= 0)) { out.textContent = ''; return; }
        out.textContent = fromUah
            ? fmt(amount) + ' грн = ' + fmt(amount / r.rate) + ' ' + cc
            : fmt(amount) + ' ' + cc + ' = ' + fmt(amount * r.rate) + ' грн';
    }

    function initRates() {
        const sel = $('#conv-cur');
        WANT.forEach(cc => sel.appendChild(h('option', { value: cc, text: cc })));
        sel.addEventListener('change', convert);
        $('#conv-amount').addEventListener('input', convert);
        $('#conv-swap').addEventListener('click', () => { fromUah = !fromUah; $('#conv-swap').setAttribute('aria-pressed', String(fromUah)); convert(); });
        loadRates();
    }

    /* ---------- Перекладач ---------- */
    const LANGS = [
        ['uk', 'Українська', 'uk-UA'], ['en', 'Англійська', 'en-US'], ['de', 'Німецька', 'de-DE'], ['pl', 'Польська', 'pl-PL'],
        ['fr', 'Французька', 'fr-FR'], ['es', 'Іспанська', 'es-ES'], ['it', 'Італійська', 'it-IT'], ['cs', 'Чеська', 'cs-CZ'], ['tr', 'Турецька', 'tr-TR']
    ];

    const decode = s => { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; };

    function initTranslator() {
        const from = $('#tr-from'), to = $('#tr-to'), text = $('#tr-text'), out = $('#tr-out'), tools = $('#tr-tools'), count = $('#tr-count');
        LANGS.forEach(([c, n]) => { from.appendChild(h('option', { value: c, text: n })); to.appendChild(h('option', { value: c, text: n })); });
        from.value = 'uk'; to.value = 'en';

        text.addEventListener('input', () => { count.textContent = text.value.length + ' / 500'; });
        $('#tr-swap').addEventListener('click', () => {
            const a = from.value; from.value = to.value; to.value = a;
            if (out.dataset.has === '1') { text.value = out.textContent; out.dataset.has = '0'; out.textContent = 'Натисніть «Перекласти».'; tools.hidden = true; count.textContent = text.value.length + ' / 500'; }
        });

        $('#tr-go').addEventListener('click', async () => {
            const q = text.value.trim();
            if (!q) { out.textContent = 'Спершу введіть текст.'; return; }
            if (from.value === to.value) { out.textContent = 'Оберіть різні мови.'; return; }
            out.textContent = 'Перекладаю…'; out.dataset.has = '0'; tools.hidden = true;
            try {
                const r = await getJSON('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(q) + '&langpair=' + from.value + '|' + to.value);
                const status = Number(r.responseStatus);
                if (status === 429) { out.textContent = 'Денний ліміт перекладу вичерпано. Спробуйте завтра.'; return; }
                const t = r.responseData && r.responseData.translatedText;
                if (status !== 200 || !t) { out.textContent = 'Не вдалося перекласти. Спробуйте змінити текст.'; return; }
                out.textContent = decode(t);
                out.dataset.has = '1';
                tools.hidden = false;
            } catch (e) { out.textContent = 'Сервіс перекладу недоступний. Перевірте інтернет.'; }
        });

        $('#tr-copy').addEventListener('click', () => {
            if (navigator.clipboard) navigator.clipboard.writeText(out.textContent).then(() => A.toast('Скопійовано'), () => A.toast('Не вдалося скопіювати'));
        });
        $('#tr-say').addEventListener('click', () => {
            const l = LANGS.find(x => x[0] === to.value);
            A.speak(out.textContent, l ? l[2] : 'en-US');
        });
    }

    /* ---------- Налаштування та підтримка ---------- */
    function initSettings() {
        const themeSel = $('#theme-select');
        themeSel.value = A.theme.get();
        themeSel.addEventListener('change', () => A.theme.set(themeSel.value));

        const key = $('#key-input');
        $('#key-save').addEventListener('click', () => {
            const v = key.value.trim();
            if (!/^gsk_[A-Za-z0-9]{20,}$/.test(v)) { A.toast('Ключ Groq має починатися з gsk_'); return; }
            A.store.set('groq_key', v);
            key.value = '';
            A.toast('Ключ збережено на цьому пристрої');
            if (A.ai && A.ai.refreshStatus) A.ai.refreshStatus();
        });
        $('#key-clear').addEventListener('click', () => {
            A.store.del('groq_key');
            key.value = '';
            A.toast('Ключ видалено');
            if (A.ai && A.ai.refreshStatus) A.ai.refreshStatus();
        });

        const url = A.cfg.DONATE_URL;
        ['#donate-link', '#donate-rail'].forEach(sel => {
            const a = $(sel);
            if (!a) return;
            if (url) a.setAttribute('href', url); else a.hidden = true;
        });
        if (!url) $('#donate-panel').hidden = true;
    }

    function init() {
        paintGlance();
        initSettings();
        initWeather();
        initRates();
        initTranslator();
    }

    A.tools = { init };
})();
