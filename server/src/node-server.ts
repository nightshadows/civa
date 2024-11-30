import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { GameMessage } from './message-handler';
import { GameServerBase, Player, ServerRequest } from './game-server-base';
import { FileSystemStorage } from './storage/file-system-storage';
import { WebSocketServer } from 'ws';
import http from 'http';
import { createSessionToken, verifySessionToken, createSessionCookie, SessionPayload } from './auth/session';
import cookieParser from 'cookie-parser';

// Add interface for required WebSocket properties
interface GameWebSocket {
    send(data: string): void;
    close(): void;
    readyState: number;
}

class WebSocketAdapter implements GameWebSocket {
    private ws: import('ws');

    constructor(ws: import('ws')) {
        this.ws = ws;
    }

    send(data: string) {
        this.ws.send(data);
    }

    close() {
        this.ws.close();
    }

    get readyState() {
        return this.ws.readyState;
    }
}

export class NodeGameServer extends GameServerBase {
    private app: express.Application;
    private server: http.Server;
    private wss: WebSocketServer;
    private jwtSecret: string;

    constructor(
        storage: FileSystemStorage,
        jwtSecret: string
    ) {
        super(storage);
        this.app = express();
        this.app.use(cookieParser());
        this.app.use(cors({
            origin: 'http://localhost:1234',
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
        }));
        this.app.use(express.json());
        this.jwtSecret = jwtSecret;

        // Call setupExpress
        this.setupExpress(this.app);

        this.server = http.createServer(this.app);
        this.wss = new WebSocketServer({ 
            server: this.server,
        });
        
        this.wss.on('connection', (ws, request) => this.handleWebSocket(ws, request));
        this.server.listen(3000, () => {
            console.log('Server started on port 3000');
        });
    }

    private createServerRequest(req: Request): ServerRequest {
        return {
            headers: {
                get: (name: string) => req.headers[name.toLowerCase()] as string || null,
            },
            cookies: req.cookies
        };
    }

    setupExpress(app: express.Application) {
        app.use(cookieParser());
        
        app.use('/api/*', (req: Request, res: Response, next: NextFunction) => {
            this.authMiddleware(req, res, next);
        });

        app.options('/api/*', (req, res) => {
            res.set(this.corsHeaders).status(204).send();
        });

        app.get('/api/*', async (req, res) => {
            const serverRequest = this.createServerRequest(req);
            const result = await this.handleRestRequest('GET', req.path.split('/').filter(Boolean), undefined, serverRequest);
            
            if (result === null) {
                res.status(404).json({ error: 'Not Found' });
                return;
            }

            if (result.status) {
                res.status(result.status).json(result.body || { error: 'Error occurred' });
                return;
            }

            res.set(this.corsHeaders).json(result);
        });

        app.post('/api/*', async (req, res) => {
            const serverRequest = this.createServerRequest(req);
            const result = await this.handleRestRequest('POST', req.path.split('/').filter(Boolean), req.body, serverRequest);
            
            if (result === null) {
                res.status(404).json({ error: 'Not Found' });
                return;
            }

            if (result.status) {
                res.status(result.status).json(result.body || { error: 'Error occurred' });
                return;
            }

            if (result.headers) {
                Object.entries(result.headers).forEach(([key, value]) => {
                    res.setHeader(key, value);
                });
            }
            
            res.set(this.corsHeaders).json(result);
        });

        app.delete('/api/*', async (req, res) => {
            const serverRequest = this.createServerRequest(req);
            const result = await this.handleRestRequest('DELETE', req.path.split('/').filter(Boolean), req.body, serverRequest);
            
            if (result === null) {
                res.status(404).json({ error: 'Not Found' });
                return;
            }

            if (result.status) {
                res.status(result.status).json(result.body || { error: 'Error occurred' });
                return;
            }

            res.set(this.corsHeaders).json(result);
        });
    }

    handleWebSocket(ws: import('ws'), request: http.IncomingMessage) {
        const wsAdapter = new WebSocketAdapter(ws);
        const cookies = this.parseCookies(request);
        const serverRequest = {
            headers: {
                get: (name: string) => request.headers[name.toLowerCase()] as string || null,
            },
            cookies
        };

        // Debug logging
        console.log('WebSocket connection attempt');
        console.log('Headers:', request.headers);
        console.log('Cookies:', cookies);

        this.getPlayerFromRequest(serverRequest).then(player => {
            if (!player) {
                console.log('WebSocket authentication failed - no player found');
                ws.close();
                return;
            }

            this.wsManager.setPlayerSocket(wsAdapter, player.id);
            console.log('WebSocket authenticated for player:', player.id);

            ws.on('message', async (msg) => {
                const data = JSON.parse(msg.toString()) as GameMessage;
                await this.handleWebSocketMessage(wsAdapter, data);
            });

            ws.on('close', () => {
                this.handleWebSocketClose(wsAdapter);
            });
        }).catch(error => {
            console.error('WebSocket authentication error:', error);
            ws.close();
        });
    }

    private parseCookies(request: http.IncomingMessage): { [key: string]: string } {
        const cookies: { [key: string]: string } = {};
        const cookieHeader = request.headers.cookie;
        
        if (cookieHeader) {
            cookieHeader.split(';').forEach(cookie => {
                const firstEqualIndex = cookie.indexOf('=');
                if (firstEqualIndex > -1) {
                    const name = cookie.substring(0, firstEqualIndex).trim();
                    const value = cookie.substring(firstEqualIndex + 1).trim();
                    if (name && value) {
                        cookies[name] = value;
                    }
                }
            });
        }
        
        return cookies;
    }

    protected async getSessionFromRequest(request: ServerRequest): Promise<SessionPayload | null> {

        const sessionCookie = request.cookies?.session;
        if (!sessionCookie) {
            return null;
        }

        try {
            const session = await verifySessionToken(sessionCookie, this.jwtSecret);
            return session;
        } catch (error) {
            return null;
        }
    }

    protected async getPlayerFromRequest(request: ServerRequest | undefined): Promise<Player | undefined> {
        if (!request) return undefined;
        
        const session = await this.getSessionFromRequest(request);
        if (!session) return undefined;
        
        const storageKey = `player:${session.sub}`;
        const player = await this.storage.get({ prefix: storageKey });
        return player;
    }

    protected async createSessionToken(playerId: string): Promise<string> {
        return createSessionToken(playerId, this.jwtSecret);
    }

    protected createSessionCookie(token: string): string {
        return `session=${token}; Path=/; HttpOnly; SameSite=Lax${
            process.env.NODE_ENV === 'production' ? '; Secure' : ''
        }`;
    }

    // Separate middleware method
    private async authMiddleware(
        req: Request, 
        res: Response, 
        next: NextFunction
    ) {
        try {
            const path = req.originalUrl.split('/').filter(Boolean);
            
            if (path[0] === 'api' && !['register', 'auth'].includes(path[1])) {
                const serverRequest: ServerRequest = {
                    headers: {
                        get: (name: string) => req.headers[name.toLowerCase()] as string || null,
                    },
                    cookies: req.cookies
                };
                
                const player = await this.getPlayerFromRequest(serverRequest);
                if (!player) {
                    return res.status(401).json({ error: 'Unauthorized' });
                }
            }
            next();
        } catch (error) {
            next(error);
        }
    }

    protected corsHeaders = {
        'Access-Control-Allow-Origin': 'http://localhost:1234',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true'
    };
}

const server = new NodeGameServer(
    new FileSystemStorage('./storage'),
    process.env.JWT_SECRET || 'your-default-secret'
);