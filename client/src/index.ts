import Phaser from 'phaser';
import { GameScene } from './phaser/game-scene';
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
});

// Game actions
const gameActions = {
    moveUnit: (unitId: string, destination: Position) => {
        socket.send(JSON.stringify({
            type: 'action',
            action: {
                type: 'MOVE_UNIT',
                payload: { unitId, destination }
            }
        }));
    },

    fortifyUnit: (unitId: string) => {
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
    }
};

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 700,
    backgroundColor: '#1099bb',
    scene: GameScene
};

const game = new Phaser.Game(config);
game.scene.start('GameScene', {
    playerId,
    gameActions,
    gameEvents,
    onReady: () => {
        // Join game when scene is ready
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'join_game',
                gameId: 'test-game',
                playerId
            }));
        } else {
            socket.addEventListener('open', () => {
                socket.send(JSON.stringify({
                    type: 'join_game',
                    gameId: 'test-game',
                    playerId
                }));
            }
            );
        }
    }
});
