export interface GameWebSocket {
    send(data: string): void;
    close(): void;
    readyState: number;
}

export class WebSocketManager {
    private sessions: Map<string, GameWebSocket> = new Map();
    private wsToPlayer: Map<GameWebSocket, string> = new Map();

    setPlayerSocket(ws: GameWebSocket, playerId: string) {
        this.wsToPlayer.set(ws, playerId);
        this.sessions.set(playerId, ws);
    }

    getPlayerFromSocket(ws: GameWebSocket): string | undefined {
        return this.wsToPlayer.get(ws);
    }

    getSocketFromPlayer(playerId: string): GameWebSocket | undefined {
        return this.sessions.get(playerId);
    }

    removeSocket(ws: GameWebSocket) {
        const playerId = this.wsToPlayer.get(ws);
        if (playerId) {
            this.sessions.delete(playerId);
        }
        this.wsToPlayer.delete(ws);
    }

    broadcastToPlayers(playerIds: string[], message: string) {
        playerIds.forEach(playerId => {
            const ws = this.sessions.get(playerId);
            if (ws && ws.readyState === 1) { // WebSocket.OPEN
                ws.send(message);
            }
        });
    }
} 