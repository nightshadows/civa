/// <reference types="@cloudflare/workers-types" />

import { Game } from './game';
import { GameMessage,  getPlayerIdFromWs,  handleGameMessage } from './message-handler';

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
    
    // Forward request to DO
    return gameObject.fetch(request);
  }
};

// Durable Object definition
export class GameDO {
  private state: DurableObjectState;
  private game: Game | null = null;
  private sessions = new Map<string, WebSocket>();
  
  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);

    // Handle WebSocket upgrade
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
      const data = JSON.parse(msg.data as string) as GameMessage;
      handleGameMessage(data, ws, this.sessions, false, undefined, this.game!);
    });

    ws.addEventListener('close', () => {
      const playerId = getPlayerIdFromWs(ws, this.sessions);
      if (playerId) {
        this.sessions.delete(playerId);
      }
    });
  }
}
