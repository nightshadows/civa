import { config } from './config';
import { GameState } from '@shared/types';

export interface GameInfo {
    maxPlayers: number;
    currentPlayers: number;
    players: string[];
}

export interface ApiClient {
    listGames(): Promise<{ games: string[], gameStates: Record<string, GameInfo> }>;
    createGame(gameId: string, addAiPlayer?: boolean): Promise<void>;
    deleteGame(gameId: string): Promise<void>;
    getGameInfo(gameId: string): Promise<GameInfo>;
}

export interface Player {
    id: string;
    name: string;
    steamId: string;
    createdAt: number;
}

export class RestApiClient implements ApiClient {
    async listGames(): Promise<{ games: string[], gameStates: Record<string, GameInfo> }> {
        const response = await fetch(`${config.apiUrl}/games`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error('Failed to list games');
        return await response.json();
    }

    async createGame(gameId: string, addAiPlayer: boolean = false): Promise<void> {
        const response = await fetch(`${config.apiUrl}/games`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameId, addAiPlayer })
        });
        if (!response.ok) throw new Error('Failed to create game');
    }

    async deleteGame(gameId: string): Promise<void> {
        const response = await fetch(`${config.apiUrl}/games/${gameId}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            switch (response.status) {
                case 401:
                    throw new Error('Not authenticated');
                case 403:
                    throw new Error('Not authorized to delete this game');
                case 404:
                    throw new Error('Game not found');
                default:
                    throw new Error('Failed to delete game');
            }
        }
    }

    async getGameInfo(gameId: string): Promise<GameInfo> {
        const response = await fetch(`${config.apiUrl}/games/${gameId}/info`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error('Failed to get game info');
        return await response.json();
    }

    async getPlayer(): Promise<Player | null> {
        try {
            const response = await fetch(`${config.apiUrl}/player`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include' // Important for sending cookies
            });

            if (response.status === 401) {
                return null; // Not logged in
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.player;
        } catch (error) {
            console.error('Failed to fetch player:', error);
            return null;
        }
    }

    async register(name: string): Promise<{ success: boolean, error?: string }> {
        try {
            const response = await fetch(`${config.apiUrl}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ name })
            });

            if (!response.ok) {
                const error = await response.json();
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: 'Failed to connect to server' };
        }
    }

    async logout(): Promise<void> {
        const response = await fetch(`${config.apiUrl}/logout`, {
            method: 'POST',
            credentials: 'include',
        });
        if (!response.ok) {
            throw new Error('Logout failed');
        }
    }
}
