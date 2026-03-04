
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

        const inputSelector = '#prompt-textarea';

        await state.page.waitForSelector(inputSelector, {
            timeout: CONFIG.timeouts.selector
        });

        // Clear input
        await state.page.evaluate((sel: string) => {
            const el = document.querySelector(sel) as HTMLElement;

            if (!el) return;

            if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
                (el as HTMLInputElement).value = '';
            } else {
                el.innerHTML = '<p><br></p>';
            }

            el.focus();
        }, inputSelector);

        await new Promise(r => setTimeout(r, 200));

        // Insert prompt
        await state.page.evaluate((text: string) => {
            const el = document.activeElement as HTMLElement;

            if (!el) return;

            if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
                (el as HTMLInputElement).value = text;
                el.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                document.execCommand('insertText', false, text);
            }
        }, prompt);

        await new Promise(r => setTimeout(r, 500));

        // Send message
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

        // Wait until generation finishes
        try {
            await state.page.waitForSelector('button[aria-label="Stop generating"]', { timeout: 5000 });

            await state.page.waitForFunction(() => {
                return !document.querySelector('button[aria-label="Stop generating"]');
            }, { timeout: CONFIG.timeouts.response });

        } catch {
            await new Promise(r => setTimeout(r, 4000));
        }

        // Extract assistant response
        const response = await state.page.evaluate(() => {
            const responses = document.querySelectorAll(
                'div[data-message-author-role="assistant"]'
            );

            if (responses.length === 0) return '';

            const last = responses[responses.length - 1];

            // Try extracting code block first
            const codeBlock = last.querySelector('pre code');

            if (codeBlock) {
                return codeBlock.textContent || '';
            }

            // Fallback to text
            return (last as HTMLElement).innerText || '';
        });

        const finalResponse = response.trim();

        if (!finalResponse) {
            console.error('Bot returned an empty response. Dumping debug data...');
            await fs.ensureDir('debug');

            await state.page.screenshot({
                path: 'debug/debug_empty_response.png'
            });

            await fs.writeFile(
                'debug/debug_empty_response.html',
                await state.page.content()
            );
        }

        return finalResponse;

    } catch (error) {
        throw new Error(
            `Failed to get response: ${error instanceof Error ? error.message : 'Unknown error'
            }`
        );
    }
};

