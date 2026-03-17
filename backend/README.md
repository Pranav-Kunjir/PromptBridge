# PromptBridge Backend API

This is the backend for PromptBridge, implementing a "no limit LLM API" using Express and Puppeteer. It handles session management, browser automation, and database interactions using Prisma.

## Setup

If you ran `npm run setup` in the root directory, your backend is already installed and configured! To set it up manually:

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure the environment:
   ```bash
   cp .env.example .env
   # Edit .env with your specific variables
   ```

4. Initialize the Prisma database:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

## Usage

Start the development server with hot-reloading (using `nodemon`):
```bash
npm run dev
```

To build for production:
```bash
npm run build
```

To start the built production server:
```bash
npm start
```

## Available Scripts

- `npm run dev`: Starts the server with `nodemon` watching for changes in `src/`.
- `npm run build`: Compiles the TypeScript code to the `dist/` directory.
- `npm start`: Runs the compiled JavaScript from `dist/index.js`.
- `npm run clean`: Removes the `dist/` directory.

## Technologies Used

- [Express](https://expressjs.com/)
- [Puppeteer](https://pptr.dev/) & [Puppeteer Extra Stealth](https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth)
- [Prisma](https://www.prisma.io/)
