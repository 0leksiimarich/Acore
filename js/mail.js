// ===== ПОШТА =====
(function() {
    let emails = JSON.parse(localStorage.getItem('acore_emails') || '[]');

    function renderEmails() {
        const container = document.getElementById('mail-list');
        
        if (emails.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #999; padding: 30px;">📭 Пошта порусто</div>';
            return;
        }

        let html = '';
        emails.forEach((email, i) => {
            html += `
                <div style="background: ${email.read ? '#fff' : '#f0f8ff'}; padding: 12px; border-left: 3px solid ${email.read ? '#ccc' : '#1a4a84'}; margin-bottom: 8px; border-radius: 4px; cursor: pointer;" onclick="readEmail(${i})">
                    <div style="display: flex; justify-content: space-between;">
                        <div>
                            <strong>${email.from}</strong>
                            <p style="margin: 4px 0; font-size: 12px; color: #666;">${email.subject}</p>
                        </div>
                        <span style="font-size: 11px; color: #999;">${email.date}</span>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    window.readEmail = function(i) {
        const email = emails[i];
        alert(`📧 From: ${email.from}\n\nSubject: ${email.subject}\n\n${email.body}`);
        email.read = true;
        localStorage.setItem('acore_emails', JSON.stringify(emails));
        renderEmails();
    };

    window.sendEmail = function() {
        const to = document.getElementById('email-to').value.trim();
        const subject = document.getElementById('email-subject').value.trim();
        const body = document.getElementById('email-body').value.trim();

        if (!to || !subject || !body) {
            alert('⚠️ Заповніть всі поля');
            return;
        }

        const newEmail = {
            from: to,
            subject: subject,
            body: body,
            date: new Date().toLocaleDateString('uk-UA'),
            read: false
        };

        emails.push(newEmail);
        localStorage.setItem('acore_emails', JSON.stringify(emails));

        document.getElementById('email-to').value = '';
        document.getElementById('email-subject').value = '';
        document.getElementById('email-body').value = '';

        alert('✅ Відправлено!');
        renderEmails();
    };

    window.addEventListener('load', renderEmails);
})();
