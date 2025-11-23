# Chess and LLM Chat Application

A simple, ready-to-deploy chat application template powered by Cloudflare Workers AI. This project is based on Cloudflare's LLM Chat Template but has been significantly enhanced to include a fully functional 2-player chess game.

## Features

- **Integrated Chess Game**: Play a 2-player chess game directly in the browser.
- **AI Chess Assistant**: The chat interface is aware of the current chess board state. You can ask the AI for advice, analysis, or the best next move, and it will respond with context-aware suggestions.
- **Real-time Streaming**: Uses Server-Sent Events (SSE) for fast AI responses.
- **Cloudflare Powered**: Built on Cloudflare Workers AI for scalable and efficient model inference.

## How it Works

The application consists of a split-screen interface:
- **Left Side**: A playable chess board with move validation, check/checkmate detection, and coordinate labels.
- **Right Side**: An AI chat interface. When you send a message, the current state of the chess board (in matrix format) is silently appended to your message. This allows the LLM to "see" the board and provide relevant advice.

## Getting Started

1. Clone this repository:
   ```bash
   git clone https://github.com/iopo02/cf_ai_db2025.git
   cd cf_ai_db2025
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run locally:
   ```bash
   npm run dev
   ```

## Project Structure

- `public/chess.js`: Handles the chess game logic, rendering, and state management.
- `public/chat.js`: Manages the chat interface and appends board state to messages.
- `public/index.html`: The main application layout and styling.
- `src/index.ts`: The Cloudflare Worker backend handling AI requests.
