/*
 * Пошта Acore: демо-скринька, що працює лише на вашому пристрої.
 * Паролі НЕ збираються. Для Gmail і Outlook ми лише відкриваємо їхні справжні сайти.
 * Справжня пошта потребує сервера (див. README, розділ «Що далі»).
 */
(function () {
    'use strict';
    const A = window.Acore;
    const { h, $ } = A;

    const PROVIDERS = [
        { id: 'acore', name: 'Acore' },
        { id: 'gmail', name: 'Gmail', url: 'https://mail.google.com/' },
        { id: 'outlook', name: 'Outlook', url: 'https://outlook.live.com/mail/' }
    ];

    let data = { user: '', inbox: [], sent: [] };
    let provider = 'acore';
    let folder = 'inbox';
    let openId = null;
    let body, segEl;

    const load = () => {
        const d = A.store.get('mail2', null);
        if (d && typeof d === 'object') data = Object.assign({ user: '', inbox: [], sent: [] }, d);
    };
    const save = () => A.store.set('mail2', data);
    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const when = iso => new Date(iso).toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const validEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

    function welcome() {
        return {
            id: uid(), from: 'Команда Acore', subject: 'Ласкаво просимо до Acore',
            body: 'Це демонстраційна скринька. Листи тут зберігаються лише на вашому пристрої й нікуди не надсилаються.\n\nЩоб надіслати справжній лист, натисніть «Відкрити в поштовій програмі» на вкладці «Написати».',
            at: new Date().toISOString(), read: false
        };
    }

    function paintSeg() {
        segEl.textContent = '';
        PROVIDERS.forEach(p => segEl.appendChild(h('button', {
            class: 'seg-btn' + (p.id === provider ? ' on' : ''), type: 'button', role: 'tab',
            'aria-selected': String(p.id === provider), text: p.name,
            onclick: () => { provider = p.id; openId = null; folder = 'inbox'; render(); }
        })));
    }

    /* ----- Вхід (без пароля) ----- */
    function renderSignIn() {
        const input = h('input', { class: 'field', type: 'text', maxlength: '24', placeholder: 'Ваше ім’я або нік', 'aria-label': 'Ваше ім’я', autocomplete: 'off' });
        const go = () => {
            const name = input.value.trim();
            if (name.length < 2) { A.toast('Введіть хоча б 2 символи'); return; }
            data = { user: name, inbox: [welcome()], sent: [] };
            save();
            render();
        };
        input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
        body.append(h('div', { class: 'panel' },
            h('h3', { text: 'Скринька Acore' }),
            h('p', { text: 'Створіть локальну скриньку, щоб пробувати листи. Пароль не потрібен: ми його не просимо й не зберігаємо.' }),
            input,
            h('button', { class: 'btn primary', type: 'button', onclick: go }, 'Створити скриньку'),
            h('p', { class: 'note', text: 'Це демо: листи живуть тільки в цьому браузері.' })));
    }

    /* ----- Список, перегляд, написання ----- */
    function folderBar() {
        const unread = data.inbox.filter(m => !m.read).length;
        const tab = (id, label) => h('button', {
            class: 'seg-btn' + (folder === id && !openId ? ' on' : ''), type: 'button', text: label,
            onclick: () => { folder = id; openId = null; render(); }
        });
        return h('div', { class: 'mail-bar' },
            h('div', { class: 'seg small' }, tab('inbox', 'Вхідні' + (unread ? ' (' + unread + ')' : '')), tab('sent', 'Надіслані'), tab('compose', 'Написати')),
            h('button', {
                class: 'btn small ghost', type: 'button', text: 'Вийти',
                onclick: () => { if (confirm('Видалити скриньку «' + data.user + '» разом з усіма листами?')) { data = { user: '', inbox: [], sent: [] }; A.store.del('mail2'); render(); } }
            }));
    }

    function renderList(items, isSent) {
        if (!items.length) {
            body.append(h('p', { class: 'empty', text: isSent ? 'Тут з’являться листи, які ви надішлете.' : 'Вхідних листів немає.' }));
            return;
        }
        const list = h('div', { class: 'mail-list' });
        items.forEach(m => list.appendChild(h('button', {
            class: 'mail-row' + (!isSent && !m.read ? ' unread' : ''), type: 'button',
            onclick: () => { openId = m.id; if (!isSent) { m.read = true; save(); } render(); }
        },
            h('span', { class: 'mail-from', text: isSent ? 'Кому: ' + m.to : m.from }),
            h('span', { class: 'mail-subj', text: m.subject }),
            h('span', { class: 'mail-time', text: when(m.at) }))));
        body.append(list);
    }

    function renderMessage() {
        const pool = folder === 'sent' ? data.sent : data.inbox;
        const m = pool.find(x => x.id === openId);
        if (!m) { openId = null; render(); return; }
        body.append(h('article', { class: 'panel mail-view' },
            h('h3', { text: m.subject }),
            h('p', { class: 'muted', text: (folder === 'sent' ? 'Кому: ' + m.to : 'Від: ' + m.from) + ', ' + when(m.at) }),
            h('p', { class: 'mail-text', text: m.body }),
            h('div', { class: 'row' },
                h('button', { class: 'btn ghost', type: 'button', onclick: () => { openId = null; render(); } }, 'Назад'),
                h('button', {
                    class: 'btn ghost danger', type: 'button',
                    onclick: () => { const key = folder === 'sent' ? 'sent' : 'inbox'; data[key] = data[key].filter(x => x.id !== m.id); save(); openId = null; render(); }
                }, 'Видалити'))));
    }

    function renderCompose() {
        const to = h('input', { class: 'field', type: 'email', placeholder: 'Кому (email)', 'aria-label': 'Кому', autocomplete: 'off' });
        const subj = h('input', { class: 'field', type: 'text', maxlength: '120', placeholder: 'Тема', 'aria-label': 'Тема' });
        const text = h('textarea', { class: 'field', rows: '6', maxlength: '5000', placeholder: 'Текст листа…', 'aria-label': 'Текст листа' });
        const check = () => {
            if (!validEmail(to.value.trim())) { A.toast('Перевірте адресу отримувача'); return null; }
            if (!subj.value.trim() && !text.value.trim()) { A.toast('Напишіть тему або текст'); return null; }
            return { to: to.value.trim(), subject: subj.value.trim() || '(без теми)', body: text.value.trim() };
        };
        body.append(h('div', { class: 'panel' }, h('h3', { text: 'Новий лист' }), to, subj, text,
            h('div', { class: 'row wrap' },
                h('button', {
                    class: 'btn', type: 'button',
                    onclick: () => {
                        const m = check(); if (!m) return;
                        data.sent.unshift(Object.assign({ id: uid(), at: new Date().toISOString() }, m));
                        save(); folder = 'sent'; openId = null; A.toast('Збережено у «Надіслані»'); render();
                    }
                }, 'Зберегти в «Надіслані»'),
                h('button', {
                    class: 'btn primary', type: 'button',
                    onclick: () => {
                        const m = check(); if (!m) return;
                        window.location.href = 'mailto:' + encodeURIComponent(m.to) + '?subject=' + encodeURIComponent(m.subject) + '&body=' + encodeURIComponent(m.body);
                    }
                }, 'Відкрити в поштовій програмі')),
            h('p', { class: 'note', text: 'Перша кнопка лише зберігає копію тут. Справжній лист відправляє ваша поштова програма після другої кнопки.' })));
    }

    function renderAcore() {
        if (!data.user) { renderSignIn(); return; }
        body.append(h('p', { class: 'muted who', text: 'Скринька: ' + data.user }), folderBar());
        if (openId) renderMessage();
        else if (folder === 'compose') renderCompose();
        else if (folder === 'sent') renderList(data.sent, true);
        else renderList(data.inbox, false);
    }

    function renderExternal(p) {
        body.append(h('div', { class: 'panel' },
            h('h3', { text: p.name }),
            h('p', { text: 'Acore не має доступу до вашої пошти ' + p.name + ' і ніколи не просить від неї пароль. Це безпечніше: ввійти можна лише на офіційному сайті.' }),
            h('a', { class: 'btn primary', href: p.url, target: '_blank', rel: 'noopener noreferrer' }, 'Відкрити ' + p.name)));
    }

    function render() {
        paintSeg();
        body.textContent = '';
        const p = PROVIDERS.find(x => x.id === provider);
        if (p.id === 'acore') renderAcore(); else renderExternal(p);
    }

    function init() {
        body = $('#mail-body');
        segEl = $('#mail-providers');
        if (!body) return;
        load();
        render();
    }

    A.mail = { init };
})();
