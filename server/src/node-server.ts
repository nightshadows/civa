import express from 'express';
import cors from 'cors';
import { GameMessage } from './message-handler';
import { GameServerBase } from './game-server-base';
import { FileSystemStorage } from './storage/file-system-storage';
import { WebSocketServer } from 'ws';
import http from 'http';

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

    constructor(storage: FileSystemStorage) {
        super(storage);
        this.app = express();
        this.app.use(cors());
        this.app.use(express.json());

        // Call setupExpress
        this.setupExpress(this.app);

        this.server = http.createServer(this.app);
        this.wss = new WebSocketServer({ server: this.server });
        
        this.wss.on('connection', (ws) => this.handleWebSocket(ws));
        this.server.listen(3000, () => {
            console.log('Server started on port 3000');
        });
    }

    setupExpress(app: express.Application) {
        app.options('/api/*', (req, res) => {
          console.log("OPTIONS");
            res.set(this.corsHeaders).status(204).send();
        });

        app.get('/api/*', async (req, res) => {
            const result = await this.handleRestRequest('GET', req.path.split('/').filter(Boolean));
            if (result) {
                res.set(this.corsHeaders).json(result);
            } else {
                res.status(404).json({ error: 'Not Found' });
            }
        });

        app.post('/api/*', async (req, res) => {
            const result = await this.handleRestRequest('POST', req.path.split('/').filter(Boolean), req.body);
            if (result) {
                res.set(this.corsHeaders).json(result);
            } else {
                res.status(404).json({ error: 'Not Found' });
            }
        });

        app.delete('/api/*', async (req, res) => {
            const result = await this.handleRestRequest('DELETE', req.path.split('/').filter(Boolean), req.body);
            if (result) {
                res.set(this.corsHeaders).json(result);
            } else {
                res.status(404).json({ error: 'Not Found' });
            }
        });


    }

    handleWebSocket(ws: import('ws')) {
        const wsAdapter = new WebSocketAdapter(ws);

        ws.on('message', async (msg) => {
            const data = JSON.parse(msg.toString()) as GameMessage;
            await this.handleWebSocketMessage(wsAdapter, data);
        });

        ws.on('close', () => {
            this.handleWebSocketClose(wsAdapter);
        });
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

const server = new NodeGameServer(new FileSystemStorage('./storage'));