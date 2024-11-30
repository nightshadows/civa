const API_BASE = 'api';

import { config } from './config';
export interface ApiClient {
    listGames(): Promise<string[]>;
    createGame(gameId: string): Promise<void>;
    deleteGame(gameId: string): Promise<void>;
}

export interface Player {
    id: string;
    name: string;
    steamId: string;
    createdAt: number;
}

export class RestApiClient implements ApiClient {
    async listGames(): Promise<string[]> {
        const response = await fetch(`${config.apiUrl}/${API_BASE}/games`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error('Failed to list games');
        const data = await response.json();
        return data.games;
    }

    async createGame(gameId: string): Promise<void> {
        const response = await fetch(`${config.apiUrl}/${API_BASE}/games`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameId })
        });
        if (!response.ok) throw new Error('Failed to create game');
    }

    async deleteGame(gameId: string): Promise<void> {
        const response = await fetch(`${config.apiUrl}/${API_BASE}/games/${gameId}`, {
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

    async getPlayer(): Promise<Player | null> {
        try {
            const response = await fetch(`${config.apiUrl}/${API_BASE}/player`, {
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
            const response = await fetch(`${config.apiUrl}/${API_BASE}/register`, {
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
        const response = await fetch(`${config.apiUrl}/${API_BASE}/logout`, {
            method: 'POST',
            credentials: 'include',
        });
        if (!response.ok) {
            throw new Error('Logout failed');
        }
    }
} 