/* Перемикач теми Acore: чорна (за замовчуванням) або біла.
 * Вибір запам'ятовується в браузері. Підключення у <head> після css/theme.css:
 * <script src="js/theme.js"></script>
 */
(function () {
    var KEY = 'acore-theme';
    var t = localStorage.getItem(KEY) || 'dark';
    if (t === 'light') {
        var l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = 'css/theme-light.css';
        document.head.appendChild(l);
    }
    window.acoreToggleTheme = function () {
        localStorage.setItem(KEY, t === 'light' ? 'dark' : 'light');
        location.reload();
    };
    document.addEventListener('DOMContentLoaded', function () {
        var b = document.createElement('button');
        b.type = 'button';
        b.id = 'acore-theme-btn';
        b.textContent = t === 'light' ? '🌙 Чорна' : '☀️ Біла';
        b.setAttribute('aria-label', 'Змінити тему');
        b.onclick = window.acoreToggleTheme;
        b.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:9999;padding:7px 12px;border-radius:16px;' +
            'border:1px solid #3F0066;background:#0c0d12;color:#ececf2;font-size:12px;cursor:pointer;opacity:.85;';
        document.body.appendChild(b);
    });
})();
