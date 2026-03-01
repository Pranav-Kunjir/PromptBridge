import fs from 'fs-extra';
import { state } from './state';
import { CONFIG } from './config';
import { SessionData } from './types';

export const saveSession = async (): Promise<void> => {
    if (!state.page) {
        throw new Error('Browser page not initialized');
    }

    const cookies = await state.page.cookies();

    const localStorageData = await state.page.evaluate((): Record<string, string> => {
        const data: Record<string, string> = {};
        for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key) {
                data[key] = window.localStorage.getItem(key) || '';
            }
        }
        return data;
    });

    const sessionData: SessionData = {
        cookies,
        localStorage: localStorageData
    };

    await fs.writeJSON(CONFIG.sessionFile, sessionData, { spaces: 2 });
    console.log('Session saved successfully');
};

export const loadSession = async (): Promise<boolean> => {
    try {
        if (!state.page) {
            throw new Error('Browser page not initialized');
        }

        const exists = await fs.pathExists(CONFIG.sessionFile);
        if (!exists) {
            console.log('No saved session found, navigating without session...');
            await state.page.goto(CONFIG.chatbotUrl, {
                waitUntil: 'networkidle2',
                timeout: CONFIG.timeouts.navigation
            });
            return false;
        }

        const sessionData = await fs.readJSON(CONFIG.sessionFile) as SessionData;

        // Navigate to the site before setting cookies
        await state.page.goto(CONFIG.chatbotUrl, {
            waitUntil: 'networkidle2',
            timeout: CONFIG.timeouts.navigation
        });

        await state.page.setCookie(...sessionData.cookies);

        await state.page.evaluate((storageData: Record<string, string>) => {
            for (const [key, value] of Object.entries(storageData)) {
                window.localStorage.setItem(key, value);
            }
        }, sessionData.localStorage);

        await state.page.reload({ waitUntil: 'networkidle2' });

        console.log('Session restored successfully');
        return true;
    } catch (error) {
        console.error('Failed to load session:', error);
        return false;
    }
};
