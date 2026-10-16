// DuckDuckGo API пошук - реальний API без ключів!
async function searchDuckDuckGo(query) {
    try {
        // DuckDuckGo Instant Answer API (вільний, без ключа!)
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1`;
        
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('API помилка');
        }

        const data = await response.json();
        
        // Обробити результати
        const results = [];

        // 1. Додати основний результат (Abstract/Instant Answer)
        if (data.AbstractText && data.AbstractURL) {
            results.push({
                title: data.Heading || 'Результат пошуку',
                url: data.AbstractURL,
                description: data.AbstractText.substring(0, 200)
            });
        }

        // 2. Додати Related Topics (до 5 результатів)
        if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
            data.RelatedTopics.slice(0, 5).forEach(topic => {
                if (topic.FirstURL && topic.Text) {
                    // Очистити текст від HTML
                    const cleanText = topic.Text
                        .replace(/<[^>]*>/g, '')
                        .replace(/&[^;]+;/g, '')
                        .substring(0, 150);
                    
                    results.push({
                        title: cleanText.substring(0, 60),
                        url: topic.FirstURL,
                        description: cleanText
                    });
                }
            });
        }

        // 3. Якщо нема результатів, повертаємо null
        return results.length > 0 ? results : null;

    } catch (error) {
        console.error('DuckDuckGo API помилка:', error);
        return null;
    }
}

async function search() {
    const query = document.getElementById('search-input').value.trim();
    const resultsDiv = document.getElementById('results');

    if (!query) {
        resultsDiv.innerHTML = '';
        return;
    }

    // Показати "завантаження..."
    resultsDiv.innerHTML = `
        <div class="results">
            <p style="text-align: center; color: #666; padding: 40px;">
                🔍 Шукаю результати для "<strong>${query}</strong>"...
            </p>
        </div>
    `;

    // Отримати результати з DuckDuckGo API
    const results = await searchDuckDuckGo(query);

    // Якщо API не працює або результатів не має
    if (!results || results.length === 0) {
        resultsDiv.innerHTML = `
            <div class="results">
                <div class="no-results">
                    <p>Результатів не знайдено для "<strong>${query}</strong>"</p>
                    <p style="margin-top: 12px; font-size: 13px; color: #999;">
                        Спробуй пошукати на:
                    </p>
                    <p style="margin-top: 8px; display: flex; gap: 8px; justify-content: center;">
                        <a href="https://duckduckgo.com/?q=${encodeURIComponent(query)}" 
                           target="_blank"
                           style="color: #1a4a84; text-decoration: none;">
                            DuckDuckGo
                        </a>
                        <span style="color: #ccc;">|</span>
                        <a href="https://www.google.com/search?q=${encodeURIComponent(query)}" 
                           target="_blank"
                           style="color: #1a4a84; text-decoration: none;">
                            Google
                        </a>
                    </p>
                </div>
            </div>
        `;
        return;
    }

    // Показати результати
    let html = '<div class="results">';
    html += `<p style="color: #999; margin-bottom: 20px; font-size: 13px;">Результатів: ${results.length} (з DuckDuckGo)</p>`;

    results.forEach((result, index) => {
        try {
            const domain = new URL(result.url).hostname;
            html += `
                <div class="result-item">
                    <div class="result-url">${domain}</div>
                    <div class="result-title" onclick="window.open('${result.url.replace(/'/g, "\\'")}', '_blank')" style="cursor: pointer;">
                        ${result.title || 'Результат пошуку'}
                    </div>
                    <div class="result-description">
                        ${result.description || 'Немає опису'}
                    </div>
                </div>
            `;
        } catch (e) {
            console.error('Помилка при обробці результату:', e);
        }
    });

    html += '</div>';
    resultsDiv.innerHTML = html;
}

async function luckySearch() {
    const query = document.getElementById('search-input').value.trim();
    if (!query) return;

    // Отримати перший результат і перейти на нього
    const results = await searchDuckDuckGo(query);
    if (results && results.length > 0) {
        window.open(results[0].url, '_blank');
    } else {
        alert('Результати не знайдені');
    }
}

// Дозволити пошук при натиску Enter
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('search-input');
    if (input) {
        input.focus();
    }
});
