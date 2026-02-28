import express, { Request, Response } from 'express';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs-extra';
import { Browser, Page, Cookie } from 'puppeteer';

// Apply stealth plugin
puppeteer.use(StealthPlugin());

// Type definitions
interface SessionData {
  cookies: Cookie[];
  localStorage: Record<string, string>; // browser localStorage data
}

interface ChatRequest {
  prompt: string;
}

interface ChatResponse {
  answer: string;
}

interface ErrorResponse {
  error: string;
  details?: string;
}

// Configuration
const CONFIG = {
  sessionFile: './session.json',
  chatbotUrl: process.env.CHATBOT_URL || 'https://chatgpt.com/',
  headless: process.env.NODE_ENV === 'production',
  port: process.env.PORT || 3000,
  selectors: {
    input: process.env.INPUT_SELECTOR || 'textarea',
    submitButton: process.env.SUBMIT_SELECTOR || 'button[type="submit"]',
    response: process.env.RESPONSE_SELECTOR || '.response',
  },
  timeouts: {
    navigation: 30000,
    response: 60000,
    selector: 10000,
  }
};

class ChatbotAPIService {
  private app: express.Application;
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isInitialized = false;
  private requestQueue: Array<{ req: Request; res: Response }> = [];
  private isProcessing = false;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        initialized: this.isInitialized,
        queueLength: this.requestQueue.length
      });
    });

    // Chat endpoint
    this.app.post('/chat', this.handleChatRequest.bind(this));

    // Admin: save session
    this.app.post('/admin/save-session', this.handleSaveSession.bind(this));

    // Admin: get status
    this.app.get('/admin/status', (req: Request, res: Response) => {
      res.json({
        initialized: this.isInitialized,
        queueLength: this.requestQueue.length,
        browserActive: !!this.browser,
        pageActive: !!this.page
      });
    });
  }

  private async handleChatRequest(req: Request, res: Response): Promise<void> {
    const { prompt } = req.body as ChatRequest;

    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Missing or invalid prompt' } as ErrorResponse);
      return;
    }

    if (prompt.length > 10000) {
      res.status(400).json({ error: 'Prompt too long (max 10000 characters)' } as ErrorResponse);
      return;
    }

    if (!this.isInitialized) {
      res.status(503).json({ error: 'Service not ready', details: 'Browser not initialized' } as ErrorResponse);
      return;
    }

    // Add to queue
    this.requestQueue.push({ req, res });

    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  private async handleSaveSession(req: Request, res: Response): Promise<void> {
    try {
      await this.saveSession();
      res.json({ message: 'Session saved successfully' });
    } catch (error) {
      console.error('Failed to save session:', error);
      res.status(500).json({ error: 'Failed to save session' } as ErrorResponse);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      const { req, res } = this.requestQueue[0];

      try {
        const { prompt } = req.body as ChatRequest;
        const answer = await this.askChatbot(prompt);
        res.json({ answer } as ChatResponse);
      } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({
          error: 'Failed to get response',
          details: error instanceof Error ? error.message : 'Unknown error'
        } as ErrorResponse);
      }

      // Remove processed request
      this.requestQueue.shift();

      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.isProcessing = false;
  }

  private async askChatbot(prompt: string): Promise<string> {
    if (!this.page) {
      throw new Error('Browser page not initialized');
    }

    try {
      // Navigate to chatbot
      await this.page.goto(CONFIG.chatbotUrl, {
        waitUntil: 'networkidle2',
        timeout: CONFIG.timeouts.navigation
      });

      // Wait for and clear input field
      await this.page.waitForSelector(CONFIG.selectors.input, {
        timeout: CONFIG.timeouts.selector
      });
      await this.page.click(CONFIG.selectors.input, { clickCount: 3 });
      await this.page.keyboard.press('Backspace');

      // Type prompt
      await this.page.type(CONFIG.selectors.input, prompt, { delay: 50 });

      // Click submit button
      await this.page.click(CONFIG.selectors.submitButton);

      // Wait for response with timeout
      await this.page.waitForSelector(CONFIG.selectors.response, {
        timeout: CONFIG.timeouts.response
      });

      // Extract response text
      const response = await this.page.$eval(
        CONFIG.selectors.response,
        (el: Element) => el.textContent || ''
      );

      return response.trim();
    } catch (error) {
      throw new Error(`Failed to get response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async saveSession(): Promise<void> {
    if (!this.page) {
      throw new Error('Browser page not initialized');
    }

    const cookies = await this.page.cookies();

    // Properly type the evaluate function
    const localStorageData = await this.page.evaluate((): Record<string, string> => {
      const data: Record<string, string> = {};
      // Use window.localStorage to avoid TypeScript confusion
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key) {
          data[key] = window.localStorage.getItem(key) || '';
        }
      }
      return data;
    });

    const sessionData: SessionData = {
      cookies,
      localStorage: localStorageData
    };

    await fs.writeJSON(CONFIG.sessionFile, sessionData, { spaces: 2 });
    console.log('Session saved successfully');
  }

  private async loadSession(): Promise<boolean> {
    try {
      if (!this.page) {
        throw new Error('Browser page not initialized');
      }

      const exists = await fs.pathExists(CONFIG.sessionFile);
      if (!exists) {
        console.log('No saved session found, navigating without session...');
        await this.page.goto(CONFIG.chatbotUrl, {
          waitUntil: 'networkidle2',
          timeout: CONFIG.timeouts.navigation
        });
        return false;
      }

      const sessionData = await fs.readJSON(CONFIG.sessionFile) as SessionData;

      // Navigate to the site before setting cookies
      await this.page.goto(CONFIG.chatbotUrl, {
        waitUntil: 'networkidle2',
        timeout: CONFIG.timeouts.navigation
      });

      // Set cookies
      await this.page.setCookie(...sessionData.cookies);

      // Set localStorage - properly typed
      await this.page.evaluate((storageData: Record<string, string>) => {
        for (const [key, value] of Object.entries(storageData)) {
          window.localStorage.setItem(key, value);
        }
      }, sessionData.localStorage);

      // Refresh to apply session
      await this.page.reload({ waitUntil: 'networkidle2' });

      console.log('Session restored successfully');
      return true;
    } catch (error) {
      console.error('Failed to load session:', error);
      return false;
    }
  }

  public async initialize(): Promise<void> {
    try {
      console.log('Initializing browser...');

      this.browser = await puppeteer.launch({
        headless: CONFIG.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--window-size=1920,1080'
        ],
        defaultViewport: {
          width: 1920,
          height: 1080
        }
      });

      this.page = await this.browser.newPage();

      // Set a realistic user agent
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Load session
      const sessionLoaded = await this.loadSession();

      this.isInitialized = true;
      console.log(`Browser initialized successfully. Session loaded: ${sessionLoaded}`);

      // Handle browser disconnection
      this.browser.on('disconnected', () => {
        console.error('Browser disconnected!');
        this.isInitialized = false;
        this.reinitialize();
      });

    } catch (error) {
      console.error('Failed to initialize browser:', error);
      throw error;
    }
  }

  private async reinitialize(): Promise<void> {
    console.log('Attempting to reinitialize browser...');
    setTimeout(async () => {
      try {
        await this.initialize();
      } catch (error) {
        console.error('Failed to reinitialize browser:', error);
      }
    }, 5000);
  }

  public async start(): Promise<void> {
    await this.initialize();

    this.app.listen(CONFIG.port, () => {
      console.log(`🚀 Server running on port ${CONFIG.port}`);
      console.log(`📝 Chatbot URL: ${CONFIG.chatbotUrl}`);
      console.log(`🤖 Headless mode: ${CONFIG.headless}`);
    });
  }

  public async shutdown(): Promise<void> {
    console.log('Shutting down gracefully...');

    // Wait for queue to empty
    while (this.requestQueue.length > 0) {
      console.log(`Waiting for ${this.requestQueue.length} requests to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Save session before closing
    try {
      await this.saveSession();
    } catch (error) {
      console.error('Failed to save session on shutdown:', error);
    }

    // Close browser
    if (this.browser) {
      await this.browser.close();
    }

    process.exit(0);
  }
}

// Create and start service
const service = new ChatbotAPIService();

// Handle graceful shutdown
process.on('SIGTERM', () => service.shutdown());
process.on('SIGINT', () => service.shutdown());

// Start the service
service.start().catch(error => {
  console.error('Failed to start service:', error);
  process.exit(1);
});