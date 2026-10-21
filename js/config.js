/*
 * Налаштування Acore
 * ВАЖЛИВО: сюди НІКОЛИ не вставляйте секретні ключи!
 */
window.ACORE_CONFIG = {
    // Groq AI Model
    AI_MODEL: "openai/gpt-oss-20b",

    // Модель для картинок
    IMAGE_MODEL: "flux",

    // Місто для погоди
    CITY_DEFAULT: { name: "Черкаси", lat: 49.4444, lon: 32.0598 },

    // Donate
    DONATE_URL: "https://send.monobank.ua/jar/2WY5hToE3a",

    // ===== SUPABASE =====
    SUPABASE_URL: "https://kzbivoiekoxvmmffqrtv.supabase.co",
    SUPABASE_KEY: "sb_publishable_YABqsMh6TPAkhIv0H-JaYw_2I_DU78z",
    SUPABASE_BUCKET: "acore-files"
};
