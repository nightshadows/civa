import { GameState } from '@shared/types';

// Define all possible event types
export type GameEvents = {
    'updateGameState': GameState;
    'gameJoined': { playerId: string };
    'gameError': { message: string };
}

export class GameEventEmitter {
    private listeners: {
        [K in keyof GameEvents]?: Set<(data: GameEvents[K]) => void>;
    } = {};

    on<K extends keyof GameEvents>(event: K, callback: (data: GameEvents[K]) => void) {
        if (!this.listeners[event]) {
            this.listeners[event] = new Set();
        }
        this.listeners[event]!.add(callback);
    }

    off<K extends keyof GameEvents>(event: K, callback: (data: GameEvents[K]) => void) {
        this.listeners[event]?.delete(callback);
    }

    emit<K extends keyof GameEvents>(event: K, data: GameEvents[K]) {
        this.listeners[event]?.forEach(callback => callback(data));
    }
} 