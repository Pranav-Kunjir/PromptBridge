import fs from 'fs-extra';
import { state } from './state';
import { CONFIG } from './config';

export const askChatbot = async (prompt: string): Promise<string> => {
    if (!state.page) {
        throw new Error('Browser page not initialized');
    }

    try {
        // Navigate to chatbot
        await state.page.goto(CONFIG.chatbotUrl, {
            waitUntil: 'networkidle2',
            timeout: CONFIG.timeouts.navigation
        });

        // Wait for the prompt textarea (ProseMirror is used by ChatGPT)
        const inputSelector = '#prompt-textarea';
        await state.page.waitForSelector(inputSelector, {
            timeout: CONFIG.timeouts.selector
        });

        // Clear and focus the input field using JS to bypass "Node not clickable" errors
        await state.page.evaluate((sel: string) => {
            const el = document.querySelector(sel) as HTMLElement;
            if (el) {
                if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
                    (el as HTMLInputElement).value = '';
                } else {
                    el.innerHTML = '<p><br></p>'; // ProseMirror clear
                }
                el.focus();
            }
        }, inputSelector);

        await new Promise(r => setTimeout(r, 200));

        // Insert prompt text instantaneously, preserving newlines without triggering Enter
        await state.page.evaluate((text: string) => {
            const el = document.activeElement as HTMLElement;
            if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) {
                (el as HTMLInputElement).value = text;
                el.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                // execCommand('insertText') works perfectly in ProseMirror to paste text and trigger input events
                document.execCommand('insertText', false, text);
            }
        }, prompt);

        // Click submit button or press Enter
        await new Promise(r => setTimeout(r, 500)); // small delay to let UI register text

        const sendBtnAvailable = await state.page.evaluate(() => {
            const btn = document.querySelector('button[data-testid="send-button"]') as HTMLButtonElement;
            if (btn && !btn.disabled) {
                btn.click();
                return true;
            }
            return false;
        });

        if (!sendBtnAvailable) {
            await state.page.keyboard.press('Enter');
        }

        // Wait for response to start generating (indicated by the stop button appearing)
        try {
            await state.page.waitForSelector('button[aria-label="Stop generating"]', { timeout: 5000 });
            // Now wait for it to disappear, which means generation is complete
            await state.page.waitForFunction(() => {
                return !document.querySelector('button[aria-label="Stop generating"]');
            }, { timeout: CONFIG.timeouts.response });
        } catch (e) {
            // Stop button not detected, fallback to arbitrary wait
            await new Promise(r => setTimeout(r, 4000));
        }

        // Extract response text
        const response = await state.page.evaluate(() => {
            const responses = document.querySelectorAll('div[data-message-author-role="assistant"]');
            if (responses.length === 0) return '';

            const lastResponse = responses[responses.length - 1];
            const contentDiv = lastResponse.querySelector('.markdown');
            return contentDiv ? contentDiv.textContent || '' : lastResponse.textContent || '';
        });

        const finalResponse = response.trim();

        // If it returned empty, dump a screenshot so we can see what the browser saw
        if (!finalResponse) {
            console.error('Bot returned an empty response. Dumping screenshot...');
            await state.page.screenshot({ path: 'debug_empty_response.png' });
            await fs.writeFile('debug_empty_response.html', await state.page.content());
        }

        return finalResponse;
    } catch (error) {
        throw new Error(`Failed to get response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
