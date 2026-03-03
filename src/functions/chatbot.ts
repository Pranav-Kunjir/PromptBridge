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

        // Extract response text properly preserving markdown code blocks and newlines
        const response = await state.page.evaluate(() => {
            const responses = document.querySelectorAll('div[data-message-author-role="assistant"]');
            if (responses.length === 0) return '';

            const lastResponse = responses[responses.length - 1];
            const contentDiv = lastResponse.querySelector('.markdown');

            if (!contentDiv) {
                return (lastResponse as HTMLElement).innerText || lastResponse.textContent || '';
            }

            // Clone to avoid mutating the live DOM
            const clone = contentDiv.cloneNode(true) as HTMLElement;

            // Remove purely interactive or UI garbage elements from the ChatGPT interface clone explicitly
            clone.querySelectorAll('button').forEach(btn => btn.remove());
            clone.querySelectorAll('svg').forEach(svg => svg.remove());

            // Process all <pre> elements (Code blocks)
            const pres = clone.querySelectorAll('pre');
            pres.forEach(pre => {
                const codeEl = pre.querySelector('code');
                let codeText = '';

                if (codeEl) {
                    // For code wrappers, innerText is actually best to maintain spaces if it hasn't been squished
                    // but some elements use innerHTML. Let's rely on standard text content as they render code nodes 
                    // cleanly inside the spans.
                    codeText = codeEl.innerText || codeEl.textContent || '';
                } else {
                    codeText = pre.innerText || pre.textContent || '';
                }

                let lang = '';
                if (codeEl && codeEl.className) {
                    const match = codeEl.className.match(/language-(\w+)/);
                    if (match) lang = match[1];
                }

                // Make sure code blocks don't get destroyed by paragraph logic below.
                // Reconstruct exact Markdown ticks with preserved physical newline escapes.
                const markdownBlock = document.createElement('div');
                markdownBlock.className = 'processed-code-block';
                markdownBlock.innerText = `\n\`\`\`${lang}\n${codeText}\n\`\`\`\n`;

                pre.parentNode?.replaceChild(markdownBlock, pre);
            });

            // Make it visible to calculate structural breaks via innerText
            clone.style.position = 'absolute';
            clone.style.left = '-9999px';
            clone.style.width = '800px';
            document.body.appendChild(clone);

            // Force spacing on standard text blocks
            clone.querySelectorAll('p, .processed-code-block').forEach(el => {
                (el as HTMLElement).style.display = 'block';
                (el as HTMLElement).style.marginBottom = '1.5em';
                (el as HTMLElement).style.marginTop = '1.5em';
            });

            // Using pure innerText here reads the visual layout we just forced via CSS,
            // returning all preserved indents inside paragraphs and generated blocks!
            const result = clone.innerText;
            document.body.removeChild(clone);

            return result;
        });

        const finalResponse = response.trim();

        // If it returned empty, dump a screenshot so we can see what the browser saw
        if (!finalResponse) {
            console.error('Bot returned an empty response. Dumping screenshot...');
            await fs.ensureDir('debug');
            await state.page.screenshot({ path: 'debug/debug_empty_response.png' });
            await fs.writeFile('debug/debug_empty_response.html', await state.page.content());
        }

        return finalResponse;
    } catch (error) {
        throw new Error(`Failed to get response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
