export const CONFIG = {
    sessionFile: './session.json',
    chatbotUrl: process.env.CHATBOT_URL || 'https://chatgpt.com/',
    headless: process.env.NODE_ENV === 'production',
    port: process.env.PORT || 3000,
    selectors: {
        input: process.env.INPUT_SELECTOR || 'textarea',
        submitButton: process.env.SUBMIT_SELECTOR || 'button[type="submit"]',
        response: process.env.RESPONSE_SELECTOR || '.response',
    },
    timeouts: {
        navigation: 30000,
        response: 60000,
        selector: 10000,
    }
};
