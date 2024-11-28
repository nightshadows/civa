/// <reference types="@cloudflare/workers-types" />

import { Game } from './game';
import { createErrorMessage, GameManager, GameMessage, getPlayerIdFromWs, handleGameMessage } from './message-handler';

export interface Env {
  GAME: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const gameId = url.searchParams.get('gameId') || 'default';

    // Get DO instance for this game
    const gameObjectId = env.GAME.idFromName(gameId);
    const gameObject = env.GAME.get(gameObjectId);
    console.log('fetch gameObject', gameObject);

    // Forward request to DO
    return gameObject.fetch(request);
  }
};

// Durable Object definition
export class GameDO {
  private state: DurableObjectState;
  private gameManager: GameManager = {
    games: new Map<string, Game>(),
    playerSessions: new Map<string, string>()
  };
  private sessions = new Map<string, WebSocket>();
  private wsToPlayer = new Map<WebSocket, string>();
  private initialized: Promise<void>;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.initialized = this.initGameManager();
  }

  private async initGameManager() {
    try {
      // List all stored games
      const games = await this.state.storage.list({ prefix: 'game:' });
      for (const [key, value] of games) {
        const storedGame = Game.fromJSON(value);
        this.gameManager.games.set(storedGame.gameId, storedGame);
      }
      console.log('Loaded games:', Array.from(this.gameManager.games.keys()));
    } catch (error) {
      console.error('Error initializing game manager:', error);
    }
  }

  async fetch(request: Request) {
    await this.initialized;
    const url = new URL(request.url);

    if (url.pathname === '/reset') {
      console.log('Clearing state for game:', url.searchParams.get('gameId'));
      await this.state.storage.deleteAll();
      this.gameManager.games.clear();
      this.gameManager.playerSessions.clear();
      this.sessions.clear();
      this.wsToPlayer.clear();
      return new Response('State cleared', { status: 200 });
    }

    if (request.headers.get('Upgrade') === 'websocket') {
      const { 0: client, 1: server } = new WebSocketPair();
      await this.handleWebSocket(server);
      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    return new Response('Expected WebSocket', { status: 400 });
  }

  private async handleWebSocket(ws: WebSocket) {
    ws.accept();

    ws.addEventListener('message', async (msg) => {
      try {
        const data = JSON.parse(msg.data as string) as GameMessage;

        if (data.type === 'join_game' || data.type === 'list_games') {
          this.sessions.set(data.playerId!, ws);
          this.wsToPlayer.set(ws, data.playerId!);
          console.log('Player joined:', data.playerId);
        }

        const playerId = this.wsToPlayer.get(ws);
        if (!playerId && data.type !== 'join_game') {
          ws.send(JSON.stringify(createErrorMessage('Not authenticated')));
          return;
        }

        const messageWithPlayer: GameMessage = {
          ...data,
          playerId: playerId || data.playerId
        };

        const result = handleGameMessage(messageWithPlayer, ws, this.sessions, this.gameManager);

        if (result.game) {
          await this.state.storage.put(`game:${result.game.gameId}`, result.game.toJSON());
          this.gameManager.games.set(result.game.gameId, result.game);
          console.log('Saved game state:', result.game.gameId);
        }
      } catch (error) {
        console.error('Error handling message:', error);
        ws.send(JSON.stringify(createErrorMessage('Internal server error')));
      }
    });

    ws.addEventListener('close', () => {
      const playerId = this.wsToPlayer.get(ws);
      if (playerId) {
        console.log('Client disconnected:', playerId);
        this.sessions.delete(playerId);
        this.wsToPlayer.delete(ws);
      }
    });
  }
}
