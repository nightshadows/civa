import express from 'express';
import { Game } from './game';
import path from 'path';
import cors from 'cors';
import WebSocket from 'ws';
import { GameMessage, handleGameMessage } from './message-handler';
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
const wsToPlayer = new Map<WebSocket, string>();

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (message) => {
    const data = JSON.parse(message.toString()) as GameMessage;
    handleGameMessage(data, ws, wsToPlayer, true, gameManager);
  });

  ws.on('close', () => {
    const playerId = wsToPlayer.get(ws);
    console.log('Client disconnected:', playerId);
    wsToPlayer.delete(ws);
  });
});
