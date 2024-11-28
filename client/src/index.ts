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

// Helper to generate a random gameId
function generateGameId(): string {
    return 'game-' + Math.random().toString(36).substring(2, 9);
}

// Modified game initialization
const initializeGame = () => {
    // Request list of available games first
    gameActions.listGames();
};

// Handle game list and joining
gameEvents.on('gamesList', ({ games }) => {
    if (games && games.length > 0) {
        // Join the first available game
        const gameId = games[0];
        console.log('Joining existing game:', gameId);
        gameActions.joinGame(gameId);
    } else {
        // Create a new game with generated ID
        const newGameId = generateGameId();
        console.log('Creating new game:', newGameId);
        gameActions.joinGame(newGameId);
    }
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

        case 'games_list':
            console.log('Available games:', data.games);
            gameEvents.emit('gamesList', { games: data.games });
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
    },

    listGames: () => {
        console.info('Listing available games');
        socket.send(JSON.stringify({
            type: 'list_games',
            playerId: playerId
        }));
    }
};

// Create game with engine choice based on URL parameter
const game = GameSetup.createGame({
    playerId,
    gameId: '', // We'll set this after getting games list
    gameActions,
    gameEvents,
    width: 800,
    height: 550,
    backgroundColor: '#1099bb',
},
    () => {
        // Initialize game when scene is ready
        if (socket.readyState === WebSocket.OPEN) {
            initializeGame();
        } else {
            socket.addEventListener('open', () => {
                initializeGame();
            });
        }
    },
    use3D); // Set to true to use Babylon.js

