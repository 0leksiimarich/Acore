// ===== НОВИНИ (RSS) =====
(function() {
    const RSS_URL = 'https://api.rss2json.com/v1/api.json?rss_url=https://feeds.bbci.co.uk/news/rss.xml';

    async function loadNews() {
        try {
            const response = await fetch(RSS_URL);
            const data = await response.json();

            let html = '';
            if (data.items && data.items.length > 0) {
                data.items.slice(0, 10).forEach((item, i) => {
                    const date = new Date(item.pubDate).toLocaleDateString('uk-UA');
                    const img = item.thumbnail ? `<img src="${item.thumbnail}" alt="" class="news-img">` : '';
                    
                    html += `
                        <div class="news-item ${i === 0 ? 'lead' : ''}">
                            ${img}
                            <div class="news-text">
                                <a href="${item.link}" target="_blank" class="news-title">${item.title}</a>
                                <span class="news-meta">${date}</span>
                            </div>
                        </div>
                    `;
                });
            }

            document.getElementById('news-list').innerHTML = html || '❌ Новини не завантажилися';
        } catch (err) {
            document.getElementById('news-list').innerHTML = '⚠️ Помилка завантаження новин';
            console.error('News error:', err);
        }
    }

    window.addEventListener('load', loadNews);
})();
