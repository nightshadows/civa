import Phaser from 'phaser';
import { GameScene } from './game/GameScene';

const socket = new WebSocket('ws://localhost:3000');

socket.addEventListener('open', () => {
    console.log('Connected to server');
});

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#1099bb',
    scene: GameScene
};

const game = new Phaser.Game(config);
game.scene.start('GameScene', { socket });
