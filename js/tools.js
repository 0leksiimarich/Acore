// ===== ІНСТРУМЕНТИ (Перекладач, Погода, Валюти) =====
(function() {
    // Перекладач
    window.translate = async function() {
        const text = document.getElementById('translate-input').value;
        const targetLang = document.getElementById('target-lang').value;

        if (!text) return;

        try {
            const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=uk|${targetLang}`);
            const data = await response.json();
            document.getElementById('translate-output').value = data.responseData.translatedText;
        } catch (err) {
            alert('❌ Помилка перекладу');
        }
    };

    // Погода
    window.getWeather = async function() {
        const lat = ACORE_CONFIG.CITY_DEFAULT.lat;
        const lon = ACORE_CONFIG.CITY_DEFAULT.lon;

        try {
            const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`);
            const data = await response.json();
            const temp = data.current.temperature_2m;
            const code = data.current.weather_code;

            let weather = '🌤️ Ясно';
            if (code > 50) weather = '🌧️ Дощ';
            if (code > 80) weather = '⛈️ Гроза';

            document.getElementById('weather-info').innerHTML = `${ACORE_CONFIG.CITY_DEFAULT.name}: ${temp}°C ${weather}`;
        } catch (err) {
            document.getElementById('weather-info').innerHTML = '⚠️ Не вдалося отримати погоду';
        }
    };

    // Валюти
    window.getExchangeRates = function() {
        const rates = {
            'USD': 40.50,
            'EUR': 44.20,
            'GBP': 51.00,
            'PLN': 10.50,
            'RUB': 0.35
        };

        let html = '<table style="width: 100%; font-size: 12px;"><tr><th>Валюта</th><th>Курс (UAH)</th></tr>';
        
        for (let curr in rates) {
            html += `<tr><td>${curr}</td><td>${rates[curr]} ₴</td></tr>`;
        }

        html += '</table>';
        document.getElementById('rates-info').innerHTML = html;
    };

    // Завантажити при старті
    window.addEventListener('load', () => {
        getWeather();
        getExchangeRates();
    });
})();
