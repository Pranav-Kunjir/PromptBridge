
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
        const { text: response, debugHtml } = await state.page.evaluate(() => {
            const responses = document.querySelectorAll(
                'div[data-message-author-role="assistant"]'
            );

            if (responses.length === 0) return { text: '', debugHtml: '' };

            const last = responses[responses.length - 1];

            // Grab the <pre> element to dump its structure for debugging
            const preEl = last.querySelector('pre');
            const debugHtml = preEl ? preEl.outerHTML.slice(0, 1000) : 'NO_PRE_FOUND';

            // Try multiple selectors for the code content
            const codeBlock = last.querySelector('pre code') 
                           || last.querySelector('code');

            if (codeBlock) {
                // Use a TreeWalker to skip buttons and UI chrome
                const walker = document.createTreeWalker(
                    codeBlock,
                    NodeFilter.SHOW_TEXT,
                    {
                        acceptNode(node: Node) {
                            let parent = node.parentElement;
                            while (parent && parent !== codeBlock) {
                                const tag = parent.tagName.toLowerCase();
                                if (tag === 'button' || tag === 'svg' || tag === 'path' ||
                                    parent.getAttribute('role') === 'button' ||
                                    parent.classList.contains('code-header') ||
                                    parent.classList.contains('sticky')) {
                                    return NodeFilter.FILTER_REJECT;
                                }
                                parent = parent.parentElement;
                            }
                            return NodeFilter.FILTER_ACCEPT;
                        }
                    }
                );

                let text = '';
                let node: Node | null;
                while ((node = walker.nextNode())) {
                    text += node.textContent;
                }
                return { text: text || (codeBlock.textContent || ''), debugHtml };
            }

            // Fallback to innerText
            return { text: (last as HTMLElement).innerText || '', debugHtml };
        });

        // DEBUG: dump the pre HTML so we can see what's happening
        console.log('[DEBUG] Pre element HTML:', debugHtml);
        console.log('[DEBUG] Raw response first 300 chars:', JSON.stringify(response.slice(0, 300)));

        // Aggressively strip ALL known ChatGPT UI labels that may leak through.
        // Handle \r\n, \n, or no newline. Strip multiple labels if needed.
        let finalResponse = response;
        // Remove leading whitespace + known labels repeatedly until none remain
        let changed = true;
        while (changed) {
            const before = finalResponse;
            finalResponse = finalResponse.replace(/^[\s\r\n]*(Run|Python|Copy code|Copy)[\s\r\n]*/i, '');
            changed = finalResponse !== before;
        }
        finalResponse = finalResponse.trim();

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

