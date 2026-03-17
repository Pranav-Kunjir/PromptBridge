# PromptBridge

PromptBridge is an open-source tool that exposes a "no limit LLM API" by bridging a frontend application and a Puppeteer-based backend.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Pranav-Kunjir/PromptBridge.git
   cd PromptBridge
   ```

2. Run the automated setup script from the root directory. This will install dependencies for both the frontend and backend, copy the `.env.example` to `.env` in the backend, and initialize the Prisma database:
   ```bash
   npm run setup
   ```
   *(Note: This executes `npm install`, `cd backend && npm install`, copying the `.env`, `npx prisma generate`, and `npx prisma db push` automatically.)*

3. Configure your environment variables in `backend/.env` if needed.

## Usage

You'll need to run both the frontend and backend development servers.

1. **Start the Frontend Server**:
   From the root directory, run:
   ```bash
   npm run dev
   ```

2. **Start the Backend Server**:
   Open a new terminal window, navigate to the backend directory, and start the API:
   ```bash
   cd backend
   npm run dev
   ```

Your frontend should now be running (typically at `http://localhost:5173`) and communicating with your PromptBridge backend!

## Contributing

We welcome contributions! To get started:

1. Fork the repository.
2. Create a new branch for your feature or bugfix (`git checkout -b feature/my-new-feature`).
3. Commit your changes (`git commit -m 'Add some feature'`).
4. Push to the branch (`git push origin feature/my-new-feature`).
5. Open a Pull Request.

Please ensure your code follows the existing style, and make sure `npm run lint` passes in the frontend if applicable.
