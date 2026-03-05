import { Cookie, Page, Browser } from 'puppeteer';
import { Request, Response, Application } from 'express';

export interface SessionData {
    cookies: Cookie[];
    localStorage: Record<string, string>;
}

export interface ChatRequest {
    prompt: string;
}

export interface ChatResponse {
    answer: string;
}

export interface ErrorResponse {
    error: string;
    details?: string;
}

export interface AppState {
    app: Application;
    browser: Browser | null;
    page: Page | null;
    isInitialized: boolean;
    requestQueue: Array<{ req: Request; res: Response; dbRequestId: string }>;
    isProcessing: boolean;
}
