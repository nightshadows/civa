import "phaser"
import { GameScene } from './game/GameScene.js';

const socket = new WebSocket('ws://localhost:3000');

socket.addEventListener('open', () => {
  console.log('Connected to server');
});

socket.addEventListener('error', (error: Event) => {
  console.error('Connection error:', error);
});

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#1099bb',
  scene: GameScene
};

const game = new Phaser.Game(config);
game.scene.start('GameScene', socket);
