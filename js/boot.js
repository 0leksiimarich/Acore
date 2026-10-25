/* Запуск Acore: вкладки, модулі, Service Worker. Завантажується останнім. */
(function () {
    'use strict';
    const A = window.Acore;

    // Вкладки головного меню (викликаються з index.html)
    window.switchTopTab = function (tab, btn) {
        ['news', 'ai', 'mail', 'extra'].forEach(t => {
            const c = document.getElementById('content-' + t);
            if (c) c.classList.toggle('active', t === tab);
        });
        document.querySelectorAll('.top-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
    };

    // Пошук у шапці відкриває чат з ШІ з цим запитом
    window.askAI = function () {
        const input = document.getElementById('ai-search-query');
        const q = input ? input.value.trim() : '';
        if (!q) return;
        input.value = '';
        window.switchTopTab('ai', document.querySelectorAll('.top-tabs .tab-btn')[1]);
        if (A.ai) A.ai.ask(q);
    };

    // Кнопка «Озвучити» у чаті
    window.speakText = function (text) { A.speak(text); };

    function startModules() {
        ['NewsModule', 'AIModule', 'ToolsModule', 'MailModule', 'GameManager', 'ChatModule'].forEach(name => {
            const m = window[name];
            if (m && typeof m.init === 'function') {
                try { m.init(); } catch (e) { console.error(name, e); }
            }
        });
    }

    function hidePreloader() {
        const p = document.getElementById('app-preloader');
        if (!p) return;
        p.classList.add('hidden');
        setTimeout(() => { p.style.display = 'none'; }, 700);
    }

    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service Worker:', err));
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        startModules();
        registerServiceWorker();
        hidePreloader();
    });
})();
