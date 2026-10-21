// ===== GROQ CHAT CLIENT =====
const GroqChat = (() => {
    let conversationHistory = [];
    const MAX_HISTORY = 10;
    const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

    return {
        async ask(message, apiKey) {
            if (!apiKey) {
                return { error: 'Groq API ключ не знайдений' };
            }

            if (!message || message.trim() === '') {
                return { error: 'Повідомлення порусте' };
            }

            try {
                conversationHistory.push({ 
                    role: 'user', 
                    content: message 
                });

                const response = await fetch(GROQ_URL, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'mixtral-8x7b-32768',
                        messages: conversationHistory.slice(-MAX_HISTORY),
                        max_tokens: 1024,
                        temperature: 0.7
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    return { 
                        error: `Помилка ${response.status}: ${errorText}`
                    };
                }

                const data = await response.json();
                
                if (!data.choices || !data.choices[0]) {
                    return { error: 'Невірна відповідь від API' };
                }

                const reply = data.choices[0].message.content;

                conversationHistory.push({ 
                    role: 'assistant', 
                    content: reply 
                });

                return { 
                    reply, 
                    history: conversationHistory 
                };
            } catch (err) {
                return { error: err.message };
            }
        },

        clear() {
            conversationHistory = [];
        },

        getHistory() {
            return conversationHistory;
        },

        setHistory(history) {
            conversationHistory = history;
        }
    };
})();
