import { Request, Response } from 'express';
import { state } from './state';
import { saveSession } from './session';
import { processQueue } from './queue';
import { ChatRequest, ErrorResponse } from './types';

export const setupRoutes = (): void => {
    // Health check endpoint
    state.app.get('/health', (req: Request, res: Response) => {
        res.json({
            status: 'ok',
            initialized: state.isInitialized,
            queueLength: state.requestQueue.length
        });
    });

    // Chat endpoint
    state.app.post('/chat', async (req: Request, res: Response): Promise<void> => {
        const { prompt } = req.body as ChatRequest;

        if (!prompt || typeof prompt !== 'string') {
            res.status(400).json({ error: 'Missing or invalid prompt' } as ErrorResponse);
            return;
        }

        if (!state.isInitialized) {
            res.status(503).json({ error: 'Service not ready', details: 'Browser not initialized' } as ErrorResponse);
            return;
        }

        // Add to queue
        const queuePosition = state.requestQueue.length + 1;
        state.requestQueue.push({ req, res });
        console.log(`[API] Request received. Queue position: ${queuePosition}`);

        if (!state.isProcessing) {
            processQueue();
        } else {
            console.log(`[API] Processing another request. Request queued at position ${queuePosition}.`);
        }
    });

    // Admin: save session
    state.app.post('/admin/save-session', async (req: Request, res: Response): Promise<void> => {
        try {
            await saveSession();
            res.json({ message: 'Session saved successfully' });
        } catch (error) {
            console.error('Failed to save session:', error);
            res.status(500).json({ error: 'Failed to save session' } as ErrorResponse);
        }
    });

    // Admin: get status
    state.app.get('/admin/status', (req: Request, res: Response) => {
        res.json({
            initialized: state.isInitialized,
            queueLength: state.requestQueue.length,
            browserActive: !!state.browser,
            pageActive: !!state.page
        });
    });
};
