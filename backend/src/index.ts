import { state } from './functions/state';
import { setupApp } from './functions/app';
import { initializeBrowser, shutdownBrowser } from './functions/browser';
import { CONFIG } from './functions/config';

const start = async (): Promise<void> => {
  setupApp();

  await initializeBrowser();

  state.app.listen(CONFIG.port, () => {
    console.log(`🚀 Server running on port ${CONFIG.port}`);
    console.log(`📝 Chatbot URL: ${CONFIG.chatbotUrl}`);
    console.log(`🤖 Headless mode: ${CONFIG.headless}`);
  });
};

process.on('SIGTERM', () => shutdownBrowser());
process.on('SIGINT', () => shutdownBrowser());

start().catch(error => {
  console.error('Failed to start service:', error);
  process.exit(1);
});
