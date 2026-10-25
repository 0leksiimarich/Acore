/* Інструменти: перекладач, погода, курси НБУ. */
(function () {
    'use strict';
    const A = window.Acore;
    const $ = id => document.getElementById(id);

    async function getJSON(url) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 12000);
        try {
            const res = await fetch(url, { signal: ctrl.signal });
            if (!res.ok) throw new Error('http ' + res.status);
            return await res.json();
        } finally {
            clearTimeout(timer);
        }
    }

    window.translateText = async function () {
        const text = $('trans-text').value.trim();
        const out = $('trans-result');
        if (!text) { out.textContent = 'Введіть текст для перекладу.'; return; }
        out.textContent = 'Перекладаю…';
        try {
            const url = 'https://api.mymemory.translated.net/get?q=' +
                encodeURIComponent(text.slice(0, 500)) + '&langpair=' + encodeURIComponent($('lang-pair').value);
            const d = await getJSON(url);
            out.textContent = (d.responseData && d.responseData.translatedText) || 'Порожній результат.';
        } catch (e) {
            out.textContent = 'Не вдалося перекласти. Спробуйте пізніше.';
        }
    };

    async function loadWeather() {
        const box = $('weather');
        if (!box) return;
        const c = A.cfg.CITY_DEFAULT;
        try {
            const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + c.lat + '&longitude=' + c.lon +
                '&current=temperature_2m,wind_speed_10m&timezone=auto';
            const cur = (await getJSON(url)).current;
            box.textContent = c.name + ': ' + Math.round(cur.temperature_2m) + ' °C, вітер ' +
                Math.round(cur.wind_speed_10m) + ' км/год';
        } catch (e) {
            box.textContent = 'Погода тимчасово недоступна.';
        }
    }

    async function loadRates() {
        const box = $('rates');
        if (!box) return;
        try {
            const list = await getJSON('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json');
            const want = ['USD', 'EUR', 'GBP', 'PLN'];
            const rows = list.filter(x => want.includes(x.cc))
                .map(x => x.cc + ': ' + Number(x.rate).toFixed(2) + ' ₴');
            box.textContent = rows.length ? rows.join('  |  ') : 'Немає даних.';
        } catch (e) {
            box.textContent = 'Курси тимчасово недоступні.';
        }
    }

    window.ToolsModule = {
        init() { loadWeather(); loadRates(); }
    };
})();
