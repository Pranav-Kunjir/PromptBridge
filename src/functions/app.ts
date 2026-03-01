import express, { Request, Response } from 'express';
import { state } from './state';
import { setupRoutes } from './routes';

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
    state.app.use((req: Request, res: Response, next: express.NextFunction) => {
        // Allow health and status checks without API key if desired, but we'll protect /chat
        if (req.path === '/chat') {
            const authHeader = req.headers.authorization;
            if (!authHeader || authHeader !== `Bearer ${API_KEY}`) {
                res.status(401).json({ error: 'Unauthorized', details: 'Invalid or missing API key' });
                return;
            }
        }
        next();
    });

    setupRoutes();
};
