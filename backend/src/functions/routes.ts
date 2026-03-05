import { Request, Response } from 'express';
import { state } from './state';
import { saveSession } from './session';
import { startBrowser, stopBrowser } from './browser';
import { processQueue } from './queue';
import { ChatRequest, ErrorResponse } from './types';
import { db } from './db';

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

        // Log request to DB
        let dbRequestId = '';
        try {
            const apiReq = await db.apiRequest.create({
                data: {
                    prompt,
                    status: 'Queued'
                }
            });
            dbRequestId = apiReq.id;
        } catch (err) {
            console.error('Failed to log request to DB:', err);
        }

        // Add to queue
        const queuePosition = state.requestQueue.length + 1;
        state.requestQueue.push({ req, res, dbRequestId });
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

    // Admin: start browser logic
    state.app.post('/admin/start', async (req: Request, res: Response): Promise<void> => {
        try {
            await startBrowser();
            res.json({ message: 'API Logic started successfully' });
        } catch (error) {
            console.error('Failed to start browser:', error);
            res.status(500).json({ error: 'Failed to start API Logic' } as ErrorResponse);
        }
    });

    // Admin: stop browser logic
    state.app.post('/admin/stop', async (req: Request, res: Response): Promise<void> => {
        try {
            await stopBrowser();
            res.json({ message: 'API Logic stopped successfully' });

            // Kill the backend process completely as requested by user
            setTimeout(() => {
                console.log('Terminating backend process...');
                process.exit(0);
            }, 500);
        } catch (error) {
            console.error('Failed to stop browser:', error);
            res.status(500).json({ error: 'Failed to stop API Logic' } as ErrorResponse);
        }
    });

    // Admin: get status
    state.app.get('/admin/status', async (req: Request, res: Response) => {
        try {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

            const totalRequests24h = await db.apiRequest.count({
                where: { createdAt: { gte: twentyFourHoursAgo } }
            });

            res.json({
                isActive: state.isActive,
                initialized: state.isInitialized,
                queueLength: state.requestQueue.length,
                browserActive: !!state.browser,
                pageActive: !!state.page,
                totalRequests24h
            });
        } catch (error) {
            // Fallback if DB fails
            res.json({
                isActive: state.isActive,
                initialized: state.isInitialized,
                queueLength: state.requestQueue.length,
                browserActive: !!state.browser,
                pageActive: !!state.page,
                totalRequests24h: 0
            });
        }
    });

    // Admin: get recent analytics
    state.app.get('/admin/analytics', async (req: Request, res: Response) => {
        try {
            const logs = await db.apiRequest.findMany({
                orderBy: { createdAt: 'desc' },
                take: 10
            });
            res.json({ logs });
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch analytics' });
        }
    });
};
