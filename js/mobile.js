/* Мобільна адаптація Acore — один файл для всіх сторінок.
 * Підключення: <script src="js/mobile.js"></script> перед </body>.
 * Що робить тільки на телефоні (ширина до 760 px):
 *  - базові правила: поля 16 px (без збільшення на iPhone), таблиці прокручуються,
 *    модальні вікна на всю ширину, немає горизонтального зсуву сторінки;
 *  - кнопка «Головна» знизу зліва (на сторінках, де її ще немає і нема нижньої навігації).
 */
(function () {
    'use strict';

    // 1. viewport — якщо його раптом немає
    if (!document.querySelector('meta[name="viewport"]')) {
        const m = document.createElement('meta');
        m.name = 'viewport';
        m.content = 'width=device-width, initial-scale=1.0, viewport-fit=cover';
        document.head.appendChild(m);
    }

    // 2. Загальні правила
    const css = `
    /* На телефоні верхню «Головна» прибрано: є кругла кнопка знизу */
    @media (max-width: 760px) {
        header a.back, header a[href="index.html"], header a[href="../index.html"] { display: none !important; }
    }

    @media (max-width: 760px) {
        html, body { max-width: 100vw; overflow-x: hidden; }
        input, select, textarea { font-size: 16px !important; }
        button, .btn, .tab, .tab-btn { min-height: 40px; }
        img, video, canvas, iframe, svg { max-width: 100%; height: auto; }
        table { display: block; overflow-x: auto; max-width: 100%; }
        .modal, .pbox, .mbox, .modal-box { width: 100% !important; max-width: 100% !important; max-height: 92vh; overflow-y: auto; }
        .card, .panel { padding: 12px !important; }
        h1 { font-size: 20px; }
        h2 { font-size: 18px; }
    }
    .acore-home { display: none; }
    @media (max-width: 760px) {
        .acore-home { display: flex; position: fixed; left: 10px; bottom: 10px; width: 44px; height: 44px; border-radius: 50%; background: #1a4a84; color: #fff; align-items: center; justify-content: center; text-decoration: none; font-size: 22px; z-index: 500; box-shadow: 0 2px 8px rgba(0,0,0,.3); }
    }`;
    const st = document.createElement('style');
    st.id = 'acore-mobile-css';
    st.textContent = css;
    document.head.appendChild(st);

    // 3. Кнопка «Головна» знизу — не на головній, не там, де вже є нижня панель або плеєр
    const path = location.pathname.replace(/\/+$/, '');
    const isHome = path === '' || path === '/Acore' || /\/index\.html$/.test(path);
    const hasOwnNav = document.querySelector('.side, #player, .player, .mhome, .bar.side');
    if (!isHome && !hasOwnNav) {
        const a = document.createElement('a');
        a.className = 'acore-home';
        a.href = 'index.html';
        a.setAttribute('aria-label', 'Головна');
        a.textContent = '⌂';
        document.body.appendChild(a);
    }
})();
