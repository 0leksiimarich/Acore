/* Вкладка «Пошта Acore»: вхід в акаунт Acore (Supabase) і локальні надіслані листи.
 * Акаунт спільний для всіх сторінок Acore (облако, документи), бо вони на одному домені. */
(function () {
    'use strict';
    const A = window.Acore;
    const $ = id => document.getElementById(id);
    const SITES = { Gmail: 'https://mail.google.com/', Outlook: 'https://outlook.live.com/mail/' };
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    let provider = A.store.get('mail_provider', 'Acore');
    let sb = null;

    function loadSupabase() {
        return new Promise((resolve, reject) => {
            if (window.supabase) return resolve();
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    async function client() {
        if (sb) return sb;
        await loadSupabase();
        sb = window.supabase.createClient(A.cfg.SUPABASE_URL, A.cfg.SUPABASE_KEY);
        return sb;
    }

    function tr(m) {
        m = String(m || '');
        if (/Invalid login credentials/i.test(m)) return 'Невірна пошта або пароль.';
        if (/Email not confirmed/i.test(m)) return 'Спочатку підтвердіть пошту: перейдіть за посиланням у листі.';
        if (/rate limit|too many|security purposes/i.test(m)) return 'Забагато спроб. Зачекайте кілька хвилин.';
        return 'Помилка входу: ' + m;
    }

    function paintProviders() {
        document.querySelectorAll('.btn-provider').forEach(b => {
            b.classList.toggle('active', b.textContent.trim() === provider);
        });
    }

    function showAuth() {
        $('mail-auth-box').style.display = '';
        $('mail-inbox-section').style.display = 'none';
    }

    function showInbox(email) {
        $('mail-auth-box').style.display = 'none';
        $('mail-inbox-section').style.display = 'block';
        $('current-mail-provider').textContent = email;
        renderSent();
    }

    function renderSent() {
        const list = $('mail-list');
        const sent = A.store.get('mail_sent', []);
        list.textContent = '';
        if (!sent.length) {
            list.appendChild(A.h('p', { class: 'empty', text: 'Надісланих листів поки немає.' }));
            return;
        }
        sent.forEach(m => list.appendChild(A.h('div', { class: 'email-item' },
            A.h('div', { class: 'email-header' },
                A.h('span', { text: 'Кому: ' + m.to }),
                A.h('span', { text: new Date(m.at).toLocaleString('uk-UA') })),
            A.h('strong', { text: m.subject || '(без теми)' }),
            A.h('div', { text: m.body }))));
    }

    async function showAccount() {
        if (provider !== 'Acore') return showAuth();
        try {
            const c = await client();
            const { data } = await c.auth.getSession();
            if (data && data.session) showInbox(data.session.user.email || 'Акаунт Acore');
            else showAuth();
        } catch (e) {
            showAuth();
        }
    }

    window.setMailProvider = function (p) {
        provider = p;
        A.store.set('mail_provider', p);
        paintProviders();
        showAccount();
    };

    window.handleAuth = async function () {
        if (provider !== 'Acore') {
            window.open(SITES[provider], '_blank', 'noopener');
            return;
        }
        const email = $('email').value.trim().toLowerCase();
        const pass = $('password').value;
        if (!EMAIL_RE.test(email)) { A.toast('Введіть коректну електронну пошту'); return; }
        if (!pass) { A.toast('Введіть пароль'); return; }
        try {
            const c = await client();
            const { error } = await c.auth.signInWithPassword({ email, password: pass });
            if (error) { A.toast(tr(error.message), 4000); return; }
            $('password').value = '';
            A.toast('Ви увійшли в акаунт Acore');
            showAccount();
        } catch (e) {
            A.toast('Немає зв’язку з сервером. Спробуйте пізніше.', 4000);
        }
    };

    window.logoutMail = async function () {
        try {
            const c = await client();
            await c.auth.signOut();
        } catch (e) { /* нічого */ }
        showAuth();
    };

    window.sendUserMail = function () {
        if (provider !== 'Acore') {
            window.open(SITES[provider], '_blank', 'noopener');
            return;
        }
        const to = $('send-to').value.trim();
        const subject = $('send-subject').value.trim();
        const body = $('send-body').value.trim();
        if (!to || !body) { A.toast('Вкажіть адресата і текст листа'); return; }
        const sent = A.store.get('mail_sent', []);
        sent.unshift({ to, subject, body, at: Date.now() });
        A.store.set('mail_sent', sent.slice(0, 50));
        $('send-to').value = '';
        $('send-subject').value = '';
        $('send-body').value = '';
        A.toast('Лист збережено в надісланих. Відправка через сервер ще не підключена.', 4000);
        renderSent();
    };

    window.MailModule = {
        init() {
            paintProviders();
            showAccount();
        }
    };
})();
