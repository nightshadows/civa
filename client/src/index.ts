import 'phaser';
import { GameScene } from './game/GameScene';

const socket = io('http://localhost:3000', {
    transports: ['websocket'],
    upgrade: false
});

socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('connect_error', (error: Error) => {
    console.error('Connection error:', error);
});

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#1099bb',
    scene: GameScene
};

const game = new Phaser.Game(config);
game.scene.start('GameScene', socket);