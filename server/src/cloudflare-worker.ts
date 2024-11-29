/// <reference types="@cloudflare/workers-types" />

import {
  GameMessage,
} from './message-handler';
import { GameServerBase, GameStorage } from './game-server-base';

export interface Env {
  GAME: DurableObjectNamespace;
}

export class CloudflareStorage implements GameStorage {
  constructor(private storage: DurableObjectStorage) {}

  async put(key: string, value: any): Promise<void> {
      await this.storage.put(key, value);
  }

  async delete(key: string): Promise<void> {
      await this.storage.delete(key);
  }
  async list(options: { prefix: string }): Promise<Map<string, any>> {
      return await this.storage.list({ prefix: options.prefix });
  }
}

export { CloudflareGameServer as GameDO }

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const gameObjectId = env.GAME.idFromName('default');
    const gameObject = env.GAME.get(gameObjectId);
    
    // Forward all requests to the Durable Object
    return gameObject.fetch(request);
  }
};

export class CloudflareGameServer extends GameServerBase {
    constructor(private state: DurableObjectState) {
      const storage = new CloudflareStorage(state.storage);
        super(storage);
    }

    async fetch(request: Request): Promise<Response> {
        await this.initialized;

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: this.corsHeaders });
        }

        const url = new URL(request.url);
        const parts = url.pathname.split('/').filter(Boolean);

        // Handle REST API endpoints
        if (parts[0] === 'api') {
            const body = request.method !== 'GET' ? await request.json() : undefined;
            const result = await this.handleRestRequest(request.method, parts, body);
            if (result) {
                return new Response(JSON.stringify(result), {
                    headers: {
                        'Content-Type': 'application/json',
                        ...this.corsHeaders
                    }
                });
            }
            return new Response('Not Found', { status: 404 });
        }

        // Handle WebSocket
        if (request.headers.get('Upgrade') === 'websocket') {
            const { 0: client, 1: server } = new WebSocketPair();
            server.accept();
            
            server.addEventListener('message', async (msg) => {
                const data = JSON.parse(msg.data as string) as GameMessage;
                await this.handleWebSocketMessage(server, data);
            });

            server.addEventListener('close', () => {
                this.handleWebSocketClose(server);
            });

            return new Response(null, {
                status: 101,
                webSocket: client,
            });
        }

        return new Response('Not Found', { status: 404 });
    }

    protected setWebSocketPlayer(ws: WebSocket, playerId: string) {
        this.wsToPlayer.set(ws, playerId);
    }

    protected getWebSocketPlayer(ws: WebSocket) {
        return this.wsToPlayer.get(ws);
    }

    protected cleanupWebSocket(ws: WebSocket) {
        this.wsToPlayer.delete(ws);
    }
}
