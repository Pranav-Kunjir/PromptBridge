import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { state } from './state';
import { CONFIG } from './config';
import { loadSession, saveSession } from './session';

puppeteer.use(StealthPlugin());

export const initializeBrowser = async (): Promise<void> => {
    try {
        console.log('Initializing browser...');

        state.browser = await puppeteer.launch({
            headless: CONFIG.headless,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--window-size=1920,1080'
            ],
            defaultViewport: {
                width: 1920,
                height: 1080
            }
        });

        const pages = await state.browser.pages();
        state.page = pages.length > 0 ? pages[0] : await state.browser.newPage();

        // Set a realistic user agent
        await state.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Load session
        const sessionLoaded = await loadSession();

        state.isInitialized = true;
        console.log(`Browser initialized successfully. Session loaded: ${sessionLoaded}`);

        // Handle browser disconnection
        state.browser.on('disconnected', () => {
            console.error('Browser disconnected!');
            state.isInitialized = false;
            reinitializeBrowser();
        });

    } catch (error) {
        console.error('Failed to initialize browser:', error);
        throw error;
    }
};

export const reinitializeBrowser = async (): Promise<void> => {
    console.log('Attempting to reinitialize browser...');
    setTimeout(async () => {
        try {
            await initializeBrowser();
        } catch (error) {
            console.error('Failed to reinitialize browser:', error);
        }
    }, 5000);
};

export const shutdownBrowser = async (): Promise<void> => {
    console.log('Shutting down gracefully...');

    // Wait for queue to empty
    while (state.requestQueue.length > 0) {
        console.log(`Waiting for ${state.requestQueue.length} requests to complete...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Save session before closing
    try {
        await saveSession();
    } catch (error) {
        console.error('Failed to save session on shutdown:', error);
    }

    // Close browser
    if (state.browser) {
        await state.browser.close();
    }

    process.exit(0);
};
