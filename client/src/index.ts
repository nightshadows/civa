import Phaser from 'phaser';
import { GameScene } from './phaser/GameScene';

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

socket.addEventListener('open', () => {
    console.log('Connected to server with playerId:', playerId);
});

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#1099bb',
    scene: GameScene
};

const game = new Phaser.Game(config);
game.scene.start('GameScene', { socket, playerId });
