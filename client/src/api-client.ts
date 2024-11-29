const API_BASE = 'api';

import { config } from './config';
export interface ApiClient {
    listGames(): Promise<string[]>;
    createGame(gameId: string, playerId: string): Promise<void>;
    deleteGame(gameId: string, playerId: string): Promise<void>;
}

export class RestApiClient implements ApiClient {
    async listGames(): Promise<string[]> {
        const response = await fetch(`${config.apiUrl}/${API_BASE}/games`);
        if (!response.ok) throw new Error('Failed to list games');
        const data = await response.json();
        return data.games;
    }

    async createGame(gameId: string, playerId: string): Promise<void> {
        const response = await fetch(`${config.apiUrl}/${API_BASE}/games`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameId, playerId })
        });
        if (!response.ok) throw new Error('Failed to create game');
    }

    async deleteGame(gameId: string, playerId: string): Promise<void> {
        const response = await fetch(`${config.apiUrl}/${API_BASE}/games/${gameId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId })
        });
        if (!response.ok) throw new Error('Failed to delete game');
    }
} 