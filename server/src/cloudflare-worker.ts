/// <reference types="@cloudflare/workers-types" />

import {
  GameMessage,
} from './message-handler';
import { GameServerBase, GameStorage, Player, ServerRequest } from './game-server-base';
import { createSessionToken, verifySessionToken, createSessionCookie, SessionPayload } from './auth/session';

export interface Env {
  GAME: DurableObjectNamespace;
  JWT_SECRET: string;
}

export class CloudflareStorage implements GameStorage {
  constructor(private storage: DurableObjectStorage) { }

  async put(key: string, value: any): Promise<void> {
    await this.storage.put(key, value);
  }

  async delete(key: string): Promise<void> {
    await this.storage.delete(key);
  }
  async list(options: { prefix: string }): Promise<Map<string, any>> {
    return await this.storage.list({ prefix: options.prefix });
  }

  async get(options: { prefix: string }): Promise<Player | undefined> {
    return await this.storage.get(`${options.prefix}`);
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
  constructor(
    private state: DurableObjectState,
    private env: Env
  ) {
    if (!env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is not set');
    }
    const storage = new CloudflareStorage(state.storage);
    super(storage);
  }

  protected async getSessionFromRequest(request: ServerRequest): Promise<SessionPayload | null> {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) return null;

    const sessionMatch = cookieHeader.match(/session=([^;]+)/);
    if (!sessionMatch) return null;

    return await verifySessionToken(sessionMatch[1], this.env.JWT_SECRET);
  }

  protected async getPlayerFromRequest(request: ServerRequest | undefined): Promise<Player | undefined> {
    if (!request) return undefined;
    const session = await this.getSessionFromRequest(request);
    if (!session) return undefined;
    return await this.storage.get({ prefix: `player:${session.sub}` });
  }

  protected getCorsHeaders(request: Request) {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = [
        'http://localhost:1234',          // Local development
        'https://civa-5ls.pages.dev'      // Production domain
    ];

    // Check if the request origin is in our allowed list
    const allowedOrigin = allowedOrigins.includes(origin) ? origin : '';

    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
        'Access-Control-Allow-Credentials': 'true',
    };
  }

  async fetch(request: Request): Promise<Response> {
    await this.initialized;

    // Always add CORS headers for all responses
    const corsHeaders = this.getCorsHeaders(request);

    // Handle CORS preflight request
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders,
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);

    // Skip auth check for registration and login endpoints
    if (parts[0] === 'api' && !['register', 'auth'].includes(parts[1])) {
      const authResponse = await this.checkAuthorized(request);
      if (authResponse) {
        return new Response(authResponse.body, {
          status: authResponse.status,
          headers: {
            ...corsHeaders,
            ...authResponse.headers
          }
        });
      }
    }

    try {
      if (parts[0] === 'api') {
        let body = undefined;
        const contentLength = request.headers.get('Content-Length');
        if (request.method !== 'GET' && contentLength !== '0' && contentLength !== null) {
          try {
            body = await request.json();
          } catch (e) {
            return new Response('Invalid JSON', {
              status: 400,
              headers: corsHeaders
            });
          }
        }

        const result = await this.handleRestRequest(request.method, parts, body, request);
        if (result) {
          return new Response(JSON.stringify(result), {
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
              ...(result.headers || {})
            }
          });
        }
      }

      if (request.headers.get('Upgrade') === 'websocket') {
        const player = await this.getPlayerFromRequest(request);
        if (!player) {
          return new Response('Unauthorized', { 
            status: 401,
            headers: corsHeaders 
          });
        }

        const { 0: client, 1: server } = new WebSocketPair();
        server.accept();

        this.wsManager.setPlayerSocket(server, player.id);

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

    } catch (error) {
      console.error('Request error:', error);
      return new Response('Internal Server Error', {
        status: 500,
        headers: corsHeaders
      });
    }

    return new Response('Not Found', { 
      status: 404,
      headers: corsHeaders 
    });
  }

  private async checkAuthorized(request: Request): Promise<Response | undefined> {
    const player = await this.getPlayerFromRequest(request);
    if (!player) {
      return new Response('Unauthorized', {
        status: 401,
        headers: {
          ...this.getCorsHeaders(request),
          'Content-Type': 'application/json'
        }
      });
    }
  }

  protected async createSessionToken(playerId: string): Promise<string> {
    if (!this.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is required for token creation');
    }
    return createSessionToken(playerId, this.env.JWT_SECRET);
  }

  protected createSessionCookie(token: string): string {
    return createSessionCookie(token);
  }
}
