// Ініціалізація карти
let map;
let markers = [];

// Популярні міста для демонстрації
const cities = {
    'київ': { lat: 50.4501, lng: 30.5234, name: 'Київ' },
    'львів': { lat: 49.8383, lng: 24.0232, name: 'Львів' },
    'харків': { lat: 50.0038, lng: 36.2304, name: 'Харків' },
    'одеса': { lat: 46.4843, lng: 30.7326, name: 'Одеса' },
    'дніпро': { lat: 48.4647, lng: 35.0461, name: 'Дніпро' },
    'запоріжжя': { lat: 47.8389, lng: 35.1456, name: 'Запоріжжя' },
    'полтава': { lat: 49.5883, lng: 34.5514, name: 'Полтава' },
    'кременчук': { lat: 49.0701, lng: 33.4187, name: 'Кременчук' },
    'черкаси': { lat: 49.4406, lng: 32.0616, name: 'Черкаси' },
    'чернівці': { lat: 48.2916, lng: 25.9351, name: 'Чернівці' }
};

function initMap() {
    // Центр України
    map = L.map('map').setView([48.5, 31.5], 6);

    // OpenStreetMap layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Додати міста на карту
    for (const [key, city] of Object.entries(cities)) {
        const marker = L.marker([city.lat, city.lng])
            .bindPopup(`<strong>${city.name}</strong>`)
            .addTo(map);
        markers.push({ marker, key, ...city });
    }
}

function searchLocation() {
    const query = document.getElementById('location-input').value.trim().toLowerCase();
    const resultPanel = document.getElementById('results-panel');

    if (!query) {
        resultPanel.classList.remove('active');
        return;
    }

    // Пошук міста
    const results = [];
    for (const [key, city] of Object.entries(cities)) {
        if (key.includes(query) || city.name.toLowerCase().includes(query)) {
            results.push(city);
        }
    }

    if (results.length === 0) {
        resultPanel.innerHTML = '<p style="color: #666;">Місто не знайдено</p>';
        resultPanel.classList.add('active');
        return;
    }

    // Показати результати
    let html = '<h3 style="margin-bottom: 12px; color: #1a4a84;">Знайдено:</h3>';
    results.forEach(city => {
        html += `
            <div class="result-item" onclick="goToLocation(${city.lat}, ${city.lng}, '${city.name}')">
                <strong>📍 ${city.name}</strong>
                <small style="display: block; color: #999;">lat: ${city.lat.toFixed(3)}, lng: ${city.lng.toFixed(3)}</small>
            </div>
        `;
    });

    resultPanel.innerHTML = html;
    resultPanel.classList.add('active');
}

function goToLocation(lat, lng, name) {
    map.setView([lat, lng], 10);
    document.getElementById('results-panel').classList.remove('active');
    
    // Показати popup
    L.popup()
        .setLatLng([lat, lng])
        .setContent(`<strong>${name}</strong>`)
        .openOn(map);
}

function useCurrentLocation() {
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(position => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            map.setView([lat, lng], 12);
            
            // Додати маркер поточної позиції
            L.circleMarker([lat, lng], {
                radius: 8,
                fillColor: '#1a4a84',
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(map).bindPopup('Ви тут').openPopup();
        }, error => {
            alert('Не вдалось отримати вашу позицію');
        });
    } else {
        alert('Геолокація не підтримується');
    }
}

// Ініціалізувати карту при завантаженні
document.addEventListener('DOMContentLoaded', initMap);

// Дозволити пошук на Enter
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('location-input');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchLocation();
        });
    }
});
