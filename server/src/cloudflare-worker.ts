/// <reference types="@cloudflare/workers-types" />

import { Game } from './game';
import { GameMessage, GameAction, broadcastGameState, createErrorMessage, createGameStateMessage, handleGameAction } from './message-handler';

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

    // Set up message handler
    ws.addEventListener('message', async (msg) => {
      const data = JSON.parse(msg.data as string) as GameMessage;
      
      switch (data.type) {
        case 'join_game': {
          const playerId = data.playerId!;
          this.sessions.set(playerId, ws);

          // Initialize game if not exists
          if (!this.game) {
            this.game = new Game(12, [playerId], 'default');
          } else if (this.game.canAddPlayer()) {
            this.game.addPlayer(playerId);
          } else {
            ws.send(JSON.stringify(createErrorMessage('Game is full')));
            return;
          }

          // Broadcast state to all players
          this.broadcastGameState();
          break;
        }

        case 'action': {
          if (!this.game) return;
          const playerId = this.getPlayerIdFromWs(ws);
          if (!playerId) return;

          const result = handleGameAction(this.game, playerId, data.action!);
          if (result.success) {
            this.broadcastGameState();
          } else {
            ws.send(JSON.stringify(createErrorMessage(result.error!)));
          }
          break;
        }
      }
    });

    // Handle disconnection
    ws.addEventListener('close', () => {
      const playerId = this.getPlayerIdFromWs(ws);
      if (playerId) {
        this.sessions.delete(playerId);
      }
    });
  }

  private getPlayerIdFromWs(ws: WebSocket): string | null {
    for (const [playerId, socket] of this.sessions.entries()) {
      if (socket === ws) return playerId;
    }
    return null;
  }

  private broadcastGameState() {
    if (!this.game) return;
    broadcastGameState(this.game, this.sessions, false);
  }
}
