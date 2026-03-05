import { state } from './state';
import { askChatbot } from './chatbot';
import { ChatRequest, ErrorResponse } from './types';
import { formatResponseCode } from './utils';
import { db } from './db';

export const processQueue = async (): Promise<void> => {
    if (state.isProcessing || state.requestQueue.length === 0) {
        return;
    }

    state.isProcessing = true;

    while (state.requestQueue.length > 0) {
        // console.log(state.requestQueue)
        const { req, res, dbRequestId } = state.requestQueue[0];

        const startTime = Date.now();
        if (dbRequestId) {
            try {
                await db.apiRequest.update({
                    where: { id: dbRequestId },
                    data: { status: 'Processing' }
                });
            } catch (err) { }
        }

        try {
            const { prompt } = req.body as ChatRequest;
            const answer = await askChatbot(prompt);

            // Attempt to parse it as JSON to ensure it's clean, otherwise wrap it
            let parsedAnswer;
            try {
                parsedAnswer = JSON.parse(answer);
            } catch (e) {
                // Fallback if ChatGPT still included some markdown or text
                console.log(answer)
                const cleanAnswer = answer.replace(/````json/g, '').replace(/````/g, '').trim();
                console.log(cleanAnswer)
                try {
                    parsedAnswer = JSON.parse(cleanAnswer);
                } catch (e2) {
                    // Ultimate fallback, format it so it survives JSON parsing with literal newlines
                    parsedAnswer = { answer: formatResponseCode(answer) };
                }
            }

            if (dbRequestId) {
                try {
                    await db.apiRequest.update({
                        where: { id: dbRequestId },
                        data: {
                            status: 'Completed',
                            result: typeof parsedAnswer === 'string' ? parsedAnswer : JSON.stringify(parsedAnswer),
                            durationMs: Date.now() - startTime
                        }
                    });
                } catch (err) { }
            }

            // Optional Formatting Layer: ensure that literal `\n` characters are passed exactly as the API requested
            // In a JSON payload, a newline is usually naturally escaped by Express `res.json()`.
            res.json(parsedAnswer);
        } catch (error) {
            console.error('Error processing request:', error);

            if (dbRequestId) {
                try {
                    await db.apiRequest.update({
                        where: { id: dbRequestId },
                        data: {
                            status: 'Failed',
                            error: error instanceof Error ? error.message : 'Unknown error',
                            durationMs: Date.now() - startTime
                        }
                    });
                } catch (err) { }
            }

            res.status(500).json({
                error: 'Failed to get response',
                details: error instanceof Error ? error.message : 'Unknown error'
            } as ErrorResponse);
        }

        // Remove processed request
        state.requestQueue.shift();

        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    state.isProcessing = false;
};
