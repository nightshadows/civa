import { GameSetup } from './engine-setup';
import { config } from './config';
import { getOrCreatePlayerId } from './utils';
import { Position } from '@shared/types';
import { GameState } from '@shared/types';

// Check URL for 3D parameter and gameId
const urlParams = new URLSearchParams(window.location.search);
const use3D = urlParams.has('3d');
const gameId = urlParams.get('gameId');

if (!gameId) {
    window.location.href = '/'; // Redirect to landing page if no gameId
}

export interface GameActions {
    attackUnit: (attackerId: string, targetId: string) => void;
    joinGame: () => void;
    moveUnit: (unitId: string, destination: Position) => void;
    fortifyUnit: (unitId: string) => void;
    endTurn: () => void;
}

export type GameEvents = {
    'updateGameState': GameState;
    'gameJoined': { playerId: string };
    'gameError': { message: string };
    'gamesList': { games: string[] };
}

export class GameEventEmitter {
    private listeners: {
        [K in keyof GameEvents]?: Set<(data: GameEvents[K]) => void>;
    } = {};

    on<K extends keyof GameEvents>(event: K, callback: (data: GameEvents[K]) => void) {
        if (!this.listeners[event]) {
            // @ts-ignore typescript can't coerce the type of the key
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

const wsUrl = config.wsUrl;
const socket = new WebSocket(wsUrl);
const playerId = getOrCreatePlayerId();
const gameEvents = new GameEventEmitter();

// Socket event handling
socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);

    switch (data.type) {
        case 'joined_game':
            console.log('Joined game with playerId:', data.playerId);
            gameEvents.emit('gameJoined', { playerId: data.playerId });
            break;

        case 'game_state':
            console.log('Received game state:', data.state);
            gameEvents.emit('updateGameState', data.state);
            break;

        case 'error':
            console.error('Game error:', data.message);
            gameEvents.emit('gameError', { message: data.message });
            break;
    }
});

// Game actions
const gameActions: GameActions = {
    moveUnit: (unitId, destination) => {
        socket.send(JSON.stringify({
            type: 'action',
            action: {
                type: 'MOVE_UNIT',
                payload: { unitId, destination }
            }
        }));
    },

    fortifyUnit: (unitId) => {
        socket.send(JSON.stringify({
            type: 'action',
            action: {
                type: 'FORTIFY_UNIT',
                payload: { unitId }
            }
        }));
    },

    endTurn: () => {
        socket.send(JSON.stringify({
            type: 'action',
            action: {
                type: 'END_TURN',
                payload: null
            }
        }));
    },

    joinGame: () => {
        socket.send(JSON.stringify({
            type: 'join_game',
            gameId,
            playerId
        }));
    },

    attackUnit: (attackerId, targetId) => {
        socket.send(JSON.stringify({
            type: 'action',
            action: {
                type: 'ATTACK_UNIT',
                payload: { 
                    unitId: attackerId,
                    targetId: targetId
                }
            }
        }));
    },
};

// Initialize game
const game = GameSetup.createGame({
    playerId,
    gameId: gameId!,
    gameActions,
    gameEvents,
    width: 800,
    height: 550,
    backgroundColor: '#1099bb',
},
() => {
    console.log('Game initialized with ID:', gameId);
    gameActions.joinGame();
},
use3D);
