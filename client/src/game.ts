import { GameSetup, GameActions, GameEventEmitter } from './engine-setup';
import { config } from './config';
import { getOrCreatePlayerId } from './utils';

// Check URL for 3D parameter and gameId
const urlParams = new URLSearchParams(window.location.search);
const use3D = urlParams.has('3d');
const gameId = urlParams.get('gameId');

if (!gameId) {
    window.location.href = '/'; // Redirect to landing page if no gameId
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

    joinGame: (gameId) => {
        socket.send(JSON.stringify({
            type: 'join_game',
            gameId,
            playerId
        }));
    },

    listGames: () => {
        socket.send(JSON.stringify({
            type: 'list_games',
            playerId
        }));
    },

    createGame: (gameId) => {
        socket.send(JSON.stringify({
            type: 'create_game',
            gameId,
            playerId
        }));
    },

    deleteGame: (gameId) => {
        socket.send(JSON.stringify({
            type: 'delete_game',
            gameId,
            playerId
        }));
    }
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
    if (socket.readyState === WebSocket.OPEN) {
    } else {
        socket.addEventListener('open', () => {
            gameActions.joinGame(gameId!);
        });
    }
    if (socket.readyState === WebSocket.OPEN) {
        gameActions.joinGame(gameId!);
    }
},
use3D);
