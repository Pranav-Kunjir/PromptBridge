
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

        // Wait until generation finishes robustly
        let unchangedCount = 0;
        let previousText = '';
        const maxWaitTime = CONFIG.timeouts.response || 120000;
        const startTime = Date.now();

        // Short initial delay to allow the network request to initiate
        await new Promise(r => setTimeout(r, 1500));

        while (Date.now() - startTime < maxWaitTime) {
            const status = await state.page.evaluate(() => {
                const stopBtn = document.querySelector('button[aria-label="Stop generating"]') ||
                    document.querySelector('button[data-testid="stop-button"]') ||
                    document.querySelector('.result-streaming');

                const responses = document.querySelectorAll('div[data-message-author-role="assistant"]');
                const lastResponse = responses.length > 0 ? responses[responses.length - 1] : null;
                const currentText = lastResponse ? (lastResponse.textContent || '') : '';

                return {
                    hasIndicators: !!stopBtn,
                    text: currentText
                };
            });

            if (status.hasIndicators) {
                // Explicit "still working" indicator found
                unchangedCount = 0;
            } else {
                // No explicit indicator. Check if text has stopped changing.
                // We check if we have text AND it's identical to the last check
                if (status.text.length > 0 && status.text === previousText) {
                    unchangedCount++;
                } else {
                    unchangedCount = 0;
                }
            }

            previousText = status.text;

            // If the text hasn't changed for 10 consecutive checks (10 * 600ms = 6 seconds) 
            // and we have at least some text, we can be confident generation is complete.
            if (unchangedCount >= 10 && previousText.length > 0) {
                break;
            }

            await new Promise(r => setTimeout(r, 600));
        }

        // Additional safety buffer to allow for any final DOM re-renders 
        // (like syntax highlighting or markdown formatting).
        await new Promise(r => setTimeout(r, 1500));

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

