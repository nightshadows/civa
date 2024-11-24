import express from 'express';
import { Game } from './game';
import path from 'path';
import cors from 'cors';
import WebSocket from 'ws';

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
    const data = JSON.parse(message.toString());

    switch (data.type) {
      case 'join_game':
        const gameId = data.gameId;
        const playerId = data.playerId;
        
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
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Game is full'
              }));
              return;
            }
          }
        }

        // Send initial game state
        const game = games.get(gameId)!;
        ws.send(JSON.stringify({
          type: 'game_state',
          state: game.getVisibleState(playerId)
        }));
        break;

      case 'action':
        const actionPlayerId = wsToPlayer.get(ws);
        const gameAction = games.get(playerSessions.get(actionPlayerId!)!);
        
        if (!gameAction || !actionPlayerId) return;

        if (!gameAction.isPlayerTurn(actionPlayerId)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Not your turn' }));
          return;
        }

        if (data.action.type === 'MOVE_UNIT') {
          const success = gameAction.moveUnit(
            data.action.payload.unitId,
            data.action.payload.destination
          );

          if (success) {
              // After processing action, broadcast state to all players
              wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                  const clientPlayerId = wsToPlayer.get(client);
                  if (clientPlayerId) {
                    const playerState = gameAction.getVisibleState(clientPlayerId);
                    client.send(JSON.stringify({
                      type: 'game_state',
                      state: playerState
                    }));
                  }
                }
              });
          } else {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Invalid move'
            }));
          }
        } else if (data.action.type === 'END_TURN') {
          gameAction.endTurn();

          // After processing action, broadcast state to all players
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              const clientPlayerId = wsToPlayer.get(client);
              if (clientPlayerId) {
                const playerState = gameAction.getVisibleState(clientPlayerId);
                client.send(JSON.stringify({
                  type: 'game_state',
                  state: playerState
                }));
              }
            }
          });
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
