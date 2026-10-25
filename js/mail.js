/* Пошта. Acore: локальний ящик на цьому пристрої (без сервера, пароль не перевіряється).
 * Gmail і Outlook: відкривають їхні сайти. */
(function () {
    'use strict';
    const A = window.Acore;
    const $ = id => document.getElementById(id);
    const SITES = { Gmail: 'https://mail.google.com/', Outlook: 'https://outlook.live.com/mail/' };
    let provider = A.store.get('mail_provider', 'Acore');

    function paintProviders() {
        document.querySelectorAll('.btn-provider').forEach(b => {
            b.classList.toggle('active', b.textContent.trim() === provider);
        });
        $('current-mail-provider').textContent = provider;
    }

    function showInbox() {
        $('mail-auth-box').style.display = 'none';
        $('mail-inbox-section').style.display = 'block';
        renderSent();
    }

    function showAuth() {
        $('mail-auth-box').style.display = '';
        $('mail-inbox-section').style.display = 'none';
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

    window.setMailProvider = function (p) {
        provider = p;
        A.store.set('mail_provider', p);
        paintProviders();
    };

    window.handleAuth = function () {
        if (provider !== 'Acore') {
            window.open(SITES[provider], '_blank', 'noopener');
            return;
        }
        const email = $('email').value.trim();
        const pass = $('password').value;
        if (!email || !pass) { A.toast('Введіть пошту і пароль'); return; }
        A.store.set('mail_account', { email });
        showInbox();
    };

    window.logoutMail = function () {
        A.store.del('mail_account');
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
            if (A.store.get('mail_account', null)) showInbox();
        }
    };
})();
