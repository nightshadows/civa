import { SessionPayload } from './auth/session';
import { Game } from './game';
import { PlayerConfig, PlayerType } from './game/player-types';
import { createErrorMessage, GameManager, GameMessage, handleGameMessage } from './message-handler';
import { WebSocketManager } from './websocket/websocket-manager';

export interface GameWebSocket {
    send(data: string): void;
    close(): void;
    readyState: number;
}

export interface GameStorage {
    get(options: { prefix: string }): Promise<any>;
    list(options: { prefix: string }): Promise<Map<string, any>>;
    put(key: string, value: any): Promise<void>;
    delete(key: string): Promise<void>;
}

export interface Player {
    id: string;
    name: string;
    createdAt: number;
} 

export interface ServerRequest {
    headers: {
        get(name: string): string | null;
        cookie?: string;
    };
    cookies?: {
        session?: string;
    };
}

export abstract class GameServerBase {
    protected gameManager: GameManager;
    protected wsManager: WebSocketManager;
    protected initialized: Promise<void>;

    protected corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    constructor(protected storage: GameStorage) {
        this.gameManager = {
            games: new Map(),
            playerSessions: new Map()
        };
        this.wsManager = new WebSocketManager();
        this.initialized = this.initGameManager();
    }

    protected async initGameManager() {
        try {
            const games = await this.storage.list({ prefix: 'game:' });
            for (const [key, value] of games) {
                const storedGame = Game.fromJSON(value);
                this.gameManager.games.set(storedGame.gameId, storedGame);
            }
            console.log('Loaded games:', Array.from(this.gameManager.games.keys()));
        } catch (error) {
            console.error('Error initializing game manager:', error);
        }
    }

    protected async handleRestRequest(method: string, parts: string[], body?: any, request?: ServerRequest) {
        if (parts[0] !== 'api') return null;

        switch (method) {
            case 'GET':
                if (parts[1] === 'games') {
                    const player = await this.getPlayerFromRequest(request);
                    const allGames = await this.storage.list({ prefix: 'game:' });
                    const games = Array.from(allGames.keys())
                        .map(key => key.toString().replace('game:', ''));
                    return { games };
                }
                if (parts[1] === 'player') {
                    const player = await this.getPlayerFromRequest(request);
                    return { player };
                }
                break;

            case 'POST':
                if (parts[1] === 'register') {
                    const { name } = body;
                    
                    // Create new player
                    const player: Player = {
                        id: this.generatePlayerId(),
                        name: name,
                        createdAt: Date.now()
                    };

                    await this.storage.put(`player:${player.id}`, player);

                    // Create session token
                    const sessionToken = await this.createSessionToken(player.id);
                    
                    return {
                        success: true,
                        headers: {
                            'Set-Cookie': this.createSessionCookie(sessionToken)
                        }
                    };
                }
                if (parts[1] === 'games') {
                    // Get player from session
                    const player = await this.getPlayerFromRequest(request);
                    if (!player) {
                        return {
                            status: 401,
                            body: { message: 'Not authenticated' }
                        };
                    }

                    const { gameId } = body;
                    const players: PlayerConfig[] = [
                        { id: player.id, type: PlayerType.HUMAN },
                    ];
                    const newGame = new Game(12, players, gameId);
                    this.gameManager.games.set(gameId, newGame);
                    await this.storage.put(`game:${gameId}`, newGame.toJSON());
                    return { success: true };
                }
                if (parts[1] === 'logout') {
                    return {
                        success: true,
                        headers: {
                            'Set-Cookie': 'session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; secure; httponly; samesite=strict',
                            'Access-Control-Allow-Credentials': 'true'
                        }
                    };
                }
                break;

            case 'DELETE':
                if (parts[1] === 'games' && parts[2]) {
                    const gameId = parts[2];
                    
                    // Get player from session
                    const player = await this.getPlayerFromRequest(request);
                    if (!player) {
                        return {
                            status: 401,
                            body: { message: 'Not authenticated' }
                        };
                    }

                    // Get game and check ownership
                    const game = this.gameManager.games.get(gameId);
                    if (!game) {
                        return {
                            status: 404,
                            body: { message: 'Game not found' }
                        };
                    }

                    // Check if player is authorized to delete this game
                    const players = game.getPlayers();
                    if (!players.some(p => p.id === player.id)) {
                        return {
                            status: 403,
                            body: { message: 'Not authorized to delete this game' }
                        };
                    }

                    // Close websocket connections for all players
                    players.forEach(gamePlayer => {
                        const playerWs = this.wsManager.getSocketFromPlayer(gamePlayer.id);
                        if (playerWs) {
                            playerWs.send(JSON.stringify({
                                type: 'error',
                                message: 'Game has been deleted'
                            }));
                            playerWs.close();
                            this.wsManager.removeSocket(playerWs);
                        }
                    });

                    // Delete game
                    this.gameManager.games.delete(gameId);
                    await this.storage.delete(`game:${gameId}`);
                    return { success: true };
                }
                break;
        }
        return null;
    }

    protected async handleWebSocketMessage(ws: GameWebSocket, data: GameMessage) {
        try {
            const playerId = this.wsManager.getPlayerFromSocket(ws);
            if (!playerId) {
                ws.send(JSON.stringify(createErrorMessage('Not authenticated')));
                return;
            }

            if (data.type === 'join_game') {
                this.wsManager.setPlayerSocket(ws, playerId);
                console.log('Player joined:', playerId);
            }

            const messageWithPlayer: GameMessage = {
                ...data,
                playerId
            };

            handleGameMessage(messageWithPlayer, ws, this.wsManager, this.gameManager);
        } catch (error) {
            console.error('Error handling message:', error);
            ws.send(JSON.stringify(createErrorMessage('Internal server error')));
        }
    }

    protected handleWebSocketClose(ws: GameWebSocket) {
        const playerId = this.wsManager.getPlayerFromSocket(ws);
        if (playerId) {
            console.log('Client disconnected:', playerId);
            this.wsManager.removeSocket(ws);
        }
    }

    protected generatePlayerId(): string {
        const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        const length = 8;
        const randomValues = new Uint8Array(length);
        crypto.getRandomValues(randomValues);
        
        let id = 'p_';
        for (let i = 0; i < length; i++) {
            id += chars[randomValues[i] % chars.length];
        }
        
        return id;
    }

    // Add these abstract methods to be implemented by platform-specific classes
    protected abstract getPlayerFromRequest(request: ServerRequest | undefined): Promise<Player | undefined>;
    protected abstract createSessionToken(playerId: string): Promise<string>;
    protected abstract createSessionCookie(token: string): string;

    // Add abstract method for session handling
    protected abstract getSessionFromRequest(request: ServerRequest): Promise<SessionPayload | null>;
} 