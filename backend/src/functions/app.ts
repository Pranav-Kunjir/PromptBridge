import express, { Request, Response } from 'express';
import { state } from './state';
import { setupRoutes } from './routes';
import { db } from './db';

export const setupApp = (): void => {
    const API_KEY = process.env.API_KEY || 'promptbridge_secret_key';

    // Native CORS handling
    state.app.use((req: Request, res: Response, next: express.NextFunction) => {
        res.header('Access-Control-Allow-Origin', '*'); // Allow all origins like localhost:5173
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

        // Intercept OPTIONS method for preflight
        if (req.method === 'OPTIONS') {
            res.sendStatus(200);
            return;
        }
        next();
    });

    state.app.use(express.json());
    state.app.use(express.urlencoded({ extended: true }));

    // Simple API Key Authorization Middleware
    state.app.use(async (req: Request, res: Response, next: express.NextFunction) => {
        // Allow health and status checks without API key if desired, but we'll protect /chat
        if (req.path === '/chat') {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                res.status(401).json({ error: 'Unauthorized', details: 'Missing API key' });
                return;
            }

            const token = authHeader.replace(/^Bearer\s+/, '');

            if (token === API_KEY) {
                // Admin fallback key is allowed
                next();
                return;
            }

            try {
                const apiKey = await db.apiKey.findUnique({
                    where: { key: token }
                });

                if (!apiKey || !apiKey.active) {
                    res.status(401).json({ error: 'Unauthorized', details: 'Invalid or inactive API key' });
                    return;
                }

                // Attach to request if needed
                (req as any).apiKeyId = apiKey.id;
                next();
            } catch (error) {
                console.error('API Key verification failed:', error);
                res.status(500).json({ error: 'Internal Server Error' });
                return;
            }
        } else {
            next();
        }
    });

    setupRoutes();
};
