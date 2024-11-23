import { Game, AUTO } from 'phaser';
import { GameScene } from './game/GameScene';
import { io } from "socket.io-client";

const socket = io('http://localhost:3000');

const config = {
    type: AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#1099bb',
    scene: GameScene
};

const game = new Game(config);
game.scene.start('GameScene', socket);