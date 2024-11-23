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

const server = app.listen(3001, () => {
  console.log('Server running on http://localhost:3001');
});

const wss = new WebSocket.Server({ port: 3000 });

const games = new Map<string, Game>();
let nextPlayerId = 1;  // Counter for generating player IDs

wss.on('connection', (ws) => {
  console.log('Client connected');

  let playerId: string;
  let gameId: string;

  ws.on('message', (message) => {
    const data = JSON.parse(message.toString());

    switch (data.type) {
      case 'join_game':
        gameId = data.gameId;
        
        // Generate new player ID
        playerId = `player${nextPlayerId++}`;
        console.log(`Assigning playerId: ${playerId}`);

        // Create or join game
        if (!games.has(gameId)) {
          console.log('Creating new game');
          games.set(gameId, new Game(48, [playerId]));
        } else {
          const game = games.get(gameId)!;
          // Add player to existing game if possible
          if (game.canAddPlayer()) {
            game.addPlayer(playerId);
          } else {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Game is full'
            }));
            return;
          }
        }

        // Send join confirmation with assigned playerId
        ws.send(JSON.stringify({
          type: 'joined_game',
          playerId: playerId
        }));

        // Send initial game state
        const game = games.get(gameId)!;
        ws.send(JSON.stringify({
          type: 'game_state',
          state: game.getVisibleState(playerId)
        }));
        break;
      case 'action':
        const gameAction = games.get(gameId);
        if (!gameAction) return;
        if (!gameAction.isPlayerTurn(playerId)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Not your turn' }));
          return;
        }

        if (data.action.type === 'MOVE_UNIT') {
          const success = gameAction.moveUnit(
            data.action.payload.unitId,
            data.action.payload.destination
          );

          if (success) {
            // Broadcast updated game state to all players
            wss.clients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                const playerState = gameAction.getVisibleState(playerId);
                client.send(JSON.stringify({
                  type: 'game_state',
                  state: playerState
                }));
              }
            });
          } else {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Invalid move'
            }));
          }
        }
        break;
      default:
        console.error('Unknown message type:', data.type);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});
