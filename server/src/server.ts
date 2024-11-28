import express from 'express';
import { Game } from './game';
import path from 'path';
import cors from 'cors';
import WebSocket from 'ws';
import { createErrorMessage, GameMessage, handleGameMessage } from './message-handler';
import { GameManager } from './message-handler';

const app = express();

// Enable CORS
app.use(cors());

// Serve static files from the client's public directory
app.use(express.static(path.join(__dirname, '../../client/public')));

const server = app.listen(3001, () => {
  console.log('Server running on http://localhost:3001');
});

const wss = new WebSocket.Server({ port: 3000 });
const gameManager: GameManager = {
  games: new Map<string, Game>(),
  playerSessions: new Map<string, string>()
};
const sessions = new Map<string, WebSocket>();  // playerId -> WebSocket
const wsToPlayer = new Map<WebSocket, string>(); // Track WebSocket -> playerId

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.addEventListener('message', async (msg) => {
    try {
      const data = JSON.parse(msg.data.toString()) as GameMessage;
      
      if (data.type === 'join_game' || data.type === 'list_games') {
        // Store both mappings on join
        sessions.set(data.playerId!, ws);
        wsToPlayer.set(ws, data.playerId!);
        console.log('Player joined:', data.playerId);
      }

      // Get playerId from WebSocket mapping
      const playerId = wsToPlayer.get(ws);
      if (!playerId && data.type !== 'join_game') {
        ws.send(JSON.stringify(createErrorMessage('Not authenticated')));
        return;
      }

      // Add playerId to all messages
      const messageWithPlayer: GameMessage = {
        ...data,
        playerId: playerId || data.playerId
      };

      handleGameMessage(messageWithPlayer, ws, sessions, gameManager);
    } catch (error) {
      console.error('Error handling message:', error);
      ws.send(JSON.stringify(createErrorMessage('Internal server error')));
    }
  });

  ws.addEventListener('close', () => {
    const playerId = wsToPlayer.get(ws);
    if (playerId) {
      console.log('Client disconnected:', playerId);
      sessions.delete(playerId);
      wsToPlayer.delete(ws);
    }
  });
});
