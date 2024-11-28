import { GameSetup, GameActions, GameEventEmitter } from './engine-setup';
import { config } from './config';

// Check URL for 3D parameter
const use3D = new URLSearchParams(window.location.search).has('3d');

// Get or create persistent playerId
const getOrCreatePlayerId = (): string => {
    const storedId = localStorage.getItem('playerId');
    if (storedId) {
        console.log('Using stored playerId:', storedId);
        return storedId;
    }
    // Generate UUID v4
    const newId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
    localStorage.setItem('playerId', newId);
    return newId;
};


const wsUrl = config.wsUrl;
console.log('Connecting to', wsUrl);
const socket = new WebSocket(wsUrl);
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

// Create game with engine choice based on URL parameter
const game = GameSetup.createGame({
    playerId,
    gameId,
    gameActions,
    gameEvents,
    width: 800,
    height: 550,
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
    use3D); // Set to true to use Babylon.js

