import express from 'express';
import { Game } from './game/Game';
import path from 'path';
import cors from 'cors';
import WebSocket from 'ws';

const app = express();

// Enable CORS
app.use(cors());

// Serve static files from the client's public directory
app.use(express.static(path.join(__dirname, '../../client/public')));

const server = app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});

const wss = new WebSocket.Server({ port: 8080 });

const games = new Map<string, Game>();

wss.on('connection', (ws) => {
  console.log('Client connected');

  let playerId: string;
  let gameId: string;

  ws.on('message', (message) => {
    const data = JSON.parse(message);

    switch (data.type) {
      case 'join_game':
        console.log('Player joining game:', data);
        playerId = data.playerId;
        gameId = data.gameId;

        // Create or join game logic here
        if (!games.has(gameId)) {
          games.set(gameId, new Game(48, [playerId]));
        }
        const game = games.get(gameId)!;

        // Send initial state
        ws.send(JSON.stringify({ type: 'game_state', state: game.getVisibleState(playerId) }));
        break;
      case 'action':
        const game = games.get(gameId);
        if (!game) return;
        if (!game.isPlayerTurn(playerId)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Not your turn' }));
          return;
        }

        // Handle action and update game state
        // Broadcast updates to relevant players
        break;
      default:
        console.error('Unknown message type:', data.type);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});
