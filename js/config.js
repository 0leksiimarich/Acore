/*
 * Налаштування Acore. Це єдиний файл, який вам треба редагувати.
 * ВАЖЛИВО: сюди НІКОЛИ не вставляйте секретні ключі (gsk_..., sk-ant-... тощо).
 * Усе, що лежить у цьому файлі, бачить кожен відвідувач сайту.
 */
window.ACORE_CONFIG = {
    // Адреса вашого Cloudflare Worker. Ключі Groq і OpenRouter зберігаються в Worker, сюди не потрапляють.
    AI_PROXY_URL: "https://rough-recipe-2992.oleksijmaric20.workers.dev",

    // Модель чату на Groq
    AI_MODEL: "openai/gpt-oss-20b",

    // Ключ Groq ВПИСУЄТЬСЯ ТУТ ВРУЧНУ. Він буде видимий усім відвідувачам сайту.
    // Не публікуйте цей файл з ключем у відкритому доступі. Ставте ліміти в консолі Groq.
    GROQ_KEY: "",

    // Модель для картинок на Pollinations (якщо не спрацює, сайт сам спробує без моделі)
    IMAGE_MODEL: "flux",

    // Місто для погоди за замовчуванням
    CITY_DEFAULT: { name: "Черкаси", lat: 49.4444, lon: 32.0598 },

    // Посилання на банку Monobank
    DONATE_URL: "https://send.monobank.ua/jar/2WY5hToE3a",

    // Supabase (облако і документи). Публічний ключ (publishable) можна зберігати тут,
    // захист забезпечують політики RLS у базі. Секретні ключі сюди НЕ вставляти.
    SUPABASE_URL: "https://kzbivoiekoxvmmffqrtv.supabase.co",
    SUPABASE_KEY: "sb_publishable_YABqsMh6TPAkhIv0H-JaYw_2I_DU78z",
    SUPABASE_BUCKET: "acore-files",

    // Доступ за поштою. Повний доступ — лише для пошти цього домену.
    // Інші пошти мають обмеження (квота, розмір файлу, без синхронізації документів).
    // Поки домену немає, залиште порожнім: обмежень не буде, повний доступ у всіх.
    // Коли домен буде, вкажіть його тут, наприклад "acore.pp.ua".
    ACORE_EMAIL_DOMAIN: "",
    FULL_QUOTA_MB: 100,
    FULL_FILE_MB: 50,
    LIMITED_QUOTA_MB: 50,
    LIMITED_FILE_MB: 10
};
