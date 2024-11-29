import { Game } from './game';
import { PlayerConfig, PlayerType } from './game/player-types';
import { createErrorMessage, GameManager, GameMessage, handleGameMessage } from './message-handler';

export interface GameWebSocket {
    send(data: string): void;
    close(): void;
    readyState: number;
}

export interface GameStorage {
    list(options: { prefix: string }): Promise<Array<{ key: string, value: any }>>;
    put(key: string, value: any): Promise<void>;
    delete(key: string): Promise<void>;
}

export abstract class GameServerBase {
    protected gameManager: GameManager;
    protected sessions: Map<string, GameWebSocket>;
    protected wsToPlayer: Map<any, string>; // 'any' because WS implementations differ
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
        this.sessions = new Map();
        this.wsToPlayer = new Map();
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

    protected async handleRestRequest(method: string, parts: string[], body?: any) {
        if (parts[0] !== 'api') return null;

        switch (method) {
            case 'GET':
                if (parts[1] === 'games') {
                    const allGames = await this.storage.list({ prefix: 'game:' });
                    const games = Array.from(allGames.keys())
                        .map(key => key.replace('game:', ''));
                    return { games };
                }
                break;

            case 'POST':
                if (parts[1] === 'games') {
                    const { gameId, playerId } = body;
                    const players: PlayerConfig[] = [
                        { id: playerId, type: PlayerType.HUMAN },
                    ];
                    const newGame = new Game(12, players, gameId);
                    this.gameManager.games.set(gameId, newGame);
                    await this.storage.put(`game:${gameId}`, newGame.toJSON());
                    return { success: true };
                }
                break;

            case 'DELETE':
                if (parts[1] === 'games' && parts[2]) {
                    const gameId = parts[2];
                    const game = this.gameManager.games.get(gameId);
                    if (game) {
                        const players = game.getPlayers();
                        players.forEach(player => {
                            const playerWs = this.sessions.get(player.id);
                            if (playerWs) {
                                playerWs.send(JSON.stringify({
                                    type: 'error',
                                    message: 'Game has been deleted'
                                }));
                                playerWs.close();
                                this.sessions.delete(player.id);
                                this.cleanupWebSocket(playerWs);
                            }
                        });
                        this.gameManager.games.delete(gameId);
                    }
                    await this.storage.delete(`game:${gameId}`);
                    return { success: true };
                }
                break;
        }
        return null;
    }

    protected async handleWebSocketMessage(ws: GameWebSocket, data: GameMessage) {
        try {
            if (data.type === 'join_game') {
                this.sessions.set(data.playerId!, ws);
                this.setWebSocketPlayer(ws, data.playerId!);
                console.log('Player joined:', data.playerId);
            }

            const playerId = this.getWebSocketPlayer(ws);
            console.log('WebSocket message:', data, playerId);

            if (!playerId) {
                ws.send(JSON.stringify(createErrorMessage('Not authenticated')));
                return;
            }

            const messageWithPlayer: GameMessage = {
                ...data,
                playerId: playerId || data.playerId
            };

            handleGameMessage(messageWithPlayer, ws, this.sessions, this.gameManager);
        } catch (error) {
            console.error('Error handling message:', error);
            ws.send(JSON.stringify(createErrorMessage('Internal server error')));
        }
    }

    protected handleWebSocketClose(ws: GameWebSocket) {
        const playerId = this.getWebSocketPlayer(ws);
        if (playerId) {
            console.log('Client disconnected:', playerId);
            this.sessions.delete(playerId);
            this.cleanupWebSocket(ws);
        }
    }

    // Abstract methods to be implemented by platform-specific classes
    protected abstract setWebSocketPlayer(ws: any, playerId: string): void;
    protected abstract getWebSocketPlayer(ws: any): string | undefined;
    protected abstract cleanupWebSocket(ws: any): void;
} 