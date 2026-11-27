/* Застосування теми Acore: чорна (за замовчуванням) або світла.
 * Перемикання — тільки в налаштуваннях (settings.html).
 * Підключення у <head> після css/theme.css:
 * <script src="js/theme.js"></script>
 */
(function () {
    var KEY = 'acore-theme';
    var t = localStorage.getItem(KEY) || 'dark';
    document.documentElement.setAttribute('data-theme', t);
    if (t === 'light') {
        var l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = 'css/theme-light.css';
        document.head.appendChild(l);
    }
})();
