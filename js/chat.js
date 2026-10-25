/* Панель «Обговорення». Повідомлення зберігаються лише на цьому пристрої. */
(function () {
    'use strict';
    const A = window.Acore;
    const $ = id => document.getElementById(id);
    const KEY = 'drawer';

    function paint() {
        const log = $('chat-logs');
        if (!log) return;
        log.textContent = '';
        const list = A.store.get(KEY, []);
        if (!list.length) {
            log.appendChild(A.h('div', { text: 'Тут поки тихо. Напишіть перше повідомлення.' }));
            return;
        }
        list.forEach(m => log.appendChild(A.h('div', null,
            A.h('b', { text: m.name + ': ' }),
            A.h('span', { text: m.text }))));
        log.scrollTop = log.scrollHeight;
    }

    window.toggleChatDrawer = function () {
        const d = $('chatDrawer');
        if (!d) return;
        d.classList.toggle('open');
        if (d.classList.contains('open')) $('chat-input-field').focus();
    };

    window.postChatMessage = function () {
        const input = $('chat-input-field');
        const text = input.value.trim().slice(0, 300);
        if (!text) return;
        const list = A.store.get(KEY, []);
        list.push({ name: 'Гість', text, at: Date.now() });
        A.store.set(KEY, list.slice(-60));
        input.value = '';
        paint();
    };

    window.ChatModule = { init: paint };
})();
