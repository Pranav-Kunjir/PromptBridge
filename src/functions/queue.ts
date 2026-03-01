import { state } from './state';
import { askChatbot } from './chatbot';
import { ChatRequest, ErrorResponse } from './types';

export const processQueue = async (): Promise<void> => {
    if (state.isProcessing || state.requestQueue.length === 0) {
        return;
    }

    state.isProcessing = true;

    while (state.requestQueue.length > 0) {
        const { req, res } = state.requestQueue[0];

        try {
            const { prompt } = req.body as ChatRequest;
            const answer = await askChatbot(prompt);

            // Attempt to parse it as JSON to ensure it's clean, otherwise wrap it
            let parsedAnswer;
            try {
                parsedAnswer = JSON.parse(answer);
            } catch (e) {
                // Fallback if ChatGPT still included some markdown or text
                const cleanAnswer = answer.replace(/```json/g, '').replace(/```/g, '').trim();
                try {
                    parsedAnswer = JSON.parse(cleanAnswer);
                } catch (e2) {
                    parsedAnswer = answer; // Ultimate fallback
                }
            }

            res.json(parsedAnswer);
        } catch (error) {
            console.error('Error processing request:', error);
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
