import { GameSetup, GameActions } from './engine-setup';
import { GameEventEmitter } from './events';

// Get or create persistent playerId
const getOrCreatePlayerId = (): string => {
    const storedId = localStorage.getItem('playerId');
    if (storedId) {
        console.log('Using stored playerId:', storedId);
        return storedId;
    }
    return '';  // Return empty string, server will assign new ID if needed
};

const socket = new WebSocket('ws://localhost:3000');
const playerId = getOrCreatePlayerId();
const gameEvents = new GameEventEmitter();
const gameId = 'test-game';

socket.addEventListener('open', () => {
    console.log('Connected to server with playerId:', playerId);
});

// Socket event handling
socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);

    switch (data.type) {
        case 'joined_game':
            console.log('Joined game with playerId:', data.playerId);
            localStorage.setItem('playerId', data.playerId);
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
});// Create the event emitter

// Game actions
const gameActions: GameActions = {
    moveUnit: (unitId, destination) => {

        console.info('Moving unit', unitId, 'to', destination);
        socket.send(JSON.stringify({
            type: 'action',
            action: {
                type: 'MOVE_UNIT',
                payload: { unitId, destination }
            }
        }));
    },

    fortifyUnit: (unitId) => {
        console.info('Fortifying unit', unitId);
        socket.send(JSON.stringify({
            type: 'action',
            action: {
                type: 'FORTIFY_UNIT',
                payload: { unitId }
            }
        }));
    },

    endTurn: () => {
        console.info('Ending turn');
        socket.send(JSON.stringify({
            type: 'action',
            action: {
                type: 'END_TURN',
                payload: null
            }
        }));
    },

    joinGame: (gameId) => {
        console.info('Joining game', gameId);
        socket.send(JSON.stringify({
            type: 'join_game',
            gameId,
            playerId
        }));
    }
};

// Create game with chosen engine
const game = GameSetup.createGame({
    playerId,
    gameId,
    gameActions,
    gameEvents,  // Pass the event emitter
    width: 800,
    height: 700,
    backgroundColor: '#1099bb',
},
    () => {
        // Join game when scene is ready
        if (socket.readyState === WebSocket.OPEN) {
            gameActions.joinGame(gameId)
        } else {
            socket.addEventListener('open', () => {
                gameActions.joinGame(gameId);
            });
        }
    },
    true); // Set to true to use Babylon.js

// Setup WebSocket message handling
socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'gameState') {
        gameEvents.emit('updateGameState', data.state);
    } else if (data.type === 'error') {
        gameEvents.emit('gameError', { message: data.message });
    }
};
