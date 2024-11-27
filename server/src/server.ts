import express from 'express';
import { Game } from './game';
import path from 'path';
import cors from 'cors';
import WebSocket from 'ws';
import { GameMessage, GameAction, broadcastGameState, createErrorMessage, createGameStateMessage, handleGameAction } from './message-handler';

const app = express();

// Enable CORS
app.use(cors());

// Serve static files from the client's public directory
app.use(express.static(path.join(__dirname, '../../client/public')));

const server = app.listen(3001, () => {
  console.log('Server running on http://localhost:3001');
});

const wss = new WebSocket.Server({ port: 3000 });
const games = new Map<string, Game>();
const playerSessions = new Map<string, string>();  // playerId -> gameId
const wsToPlayer = new Map<WebSocket, string>();   // WebSocket -> playerId

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (message) => {
    const data = JSON.parse(message.toString()) as GameMessage;

    switch (data.type) {
      case 'join_game':
        const gameId = data.gameId!;
        const playerId = data.playerId!;
        
        // Store WebSocket -> playerId mapping
        wsToPlayer.set(ws, playerId);
        console.log(`Associating client socket with playerId: ${playerId}`);

        // Create or join game
        if (!games.has(gameId)) {
          games.set(gameId, new Game(12, [playerId], gameId));
          playerSessions.set(playerId, gameId);
        } else {
          const game = games.get(gameId)!;
          if (!playerSessions.has(playerId)) {
            if (game.canAddPlayer()) {
              game.addPlayer(playerId);
              playerSessions.set(playerId, gameId);
            } else {
              ws.send(JSON.stringify(createErrorMessage('Game is full')));
              return;
            }
          }
        }

        const gameJoin = games.get(playerSessions.get(playerId!)!);
        if (!gameJoin) return;

        // Broadcast state to all players
        broadcastGameState(gameJoin, wsToPlayer, true);
        break;

      case 'action':
        const actionPlayerId = wsToPlayer.get(ws);
        const game = games.get(playerSessions.get(actionPlayerId!)!);
        
        if (!game || !actionPlayerId) return;

        const result = handleGameAction(game, actionPlayerId, data.action!);
        if (result.success) {
          broadcastGameState(game, wsToPlayer, true);
        } else {
          ws.send(JSON.stringify(createErrorMessage(result.error!)));
        }
        break;
      default:
        console.error('Unknown message type:', data.type);
    }
  });

  ws.on('close', () => {
    const playerId = wsToPlayer.get(ws);
    console.log('Client disconnected:', playerId);
    wsToPlayer.delete(ws);
  });
});
