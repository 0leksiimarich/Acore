/* Панель «Обговорення». Поки що повідомлення зберігаються лише на цьому пристрої. */
(function () {
    'use strict';
    const A = window.Acore;
    const { h, $ } = A;

    let drawer, toggle, log, input;
    let messages = [];

    const who = () => {
        const d = A.store.get('mail2', null);
        return (d && d.user) || 'Гість';
    };

    function paint() {
        log.textContent = '';
        if (!messages.length) {
            log.appendChild(h('p', { class: 'empty', text: 'Тут поки тихо. Напишіть перше повідомлення.' }));
            return;
        }
        messages.forEach(m => log.appendChild(h('div', { class: 'dmsg' },
            h('strong', { text: m.name }),
            h('span', { text: m.text }))));
        log.scrollTop = log.scrollHeight;
    }

    function open(on) {
        drawer.hidden = !on;
        toggle.setAttribute('aria-expanded', String(on));
        if (on) { paint(); input.focus(); }
    }

    function init() {
        drawer = $('#drawer');
        toggle = $('#drawer-toggle');
        log = $('#drawer-log');
        input = $('#drawer-input');
        if (!drawer) return;

        const saved = A.store.get('drawer', []);
        messages = Array.isArray(saved) ? saved.slice(-60) : [];

        toggle.addEventListener('click', () => open(drawer.hidden));
        $('#drawer-close').addEventListener('click', () => open(false));
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && !drawer.hidden) open(false); });

        $('#drawer-form').addEventListener('submit', e => {
            e.preventDefault();
            const text = input.value.trim();
            if (!text) return;
            messages.push({ name: who(), text: text.slice(0, 300), at: Date.now() });
            messages = messages.slice(-60);
            A.store.set('drawer', messages);
            input.value = '';
            paint();
        });
    }

    A.drawer = { init };
})();
