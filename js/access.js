/* Права доступу за поштою.
 * Пошта на домені ACORE_EMAIL_DOMAIN → повний доступ.
 * Інші пошти → обмеження з config.js.
 * Це перевірка на сайті. Справжнє обмеження має бути в базі (див. supabase_access.sql). */
(function () {
    'use strict';
    const C = window.ACORE_CONFIG || {};
    const DOMAIN = String(C.ACORE_EMAIL_DOMAIN || '').trim().toLowerCase().replace(/^@/, '');

    function isAcoreEmail(email) {
        const e = String(email || '').trim().toLowerCase();
        return !!DOMAIN && e.endsWith('@' + DOMAIN);
    }

    // Обмеження вмикаються, лише коли домен вказано в config.js
    const active = !!DOMAIN;

    function limits(email) {
        const full = !active || isAcoreEmail(email);
        return {
            full,
            quotaMb: full ? (C.FULL_QUOTA_MB || 5000) : (C.LIMITED_QUOTA_MB || 100),
            fileMb: full ? (C.FULL_FILE_MB || 100) : (C.LIMITED_FILE_MB || 10),
            docsSync: full
        };
    }

    window.AcoreAccess = { isAcoreEmail, limits, DOMAIN, active };
})();
