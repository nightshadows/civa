import Phaser from 'phaser';
import { GameScene as PhaserGameScene } from './phaser/game-scene';
import { BabylonGameScene } from './babylon/babylon-game-scene';
import { GameEventEmitter } from './events';
import { Position } from '@shared/types';
export interface GameActions {
    moveUnit: (unitId: string, destination: Position) => void;
    fortifyUnit: (unitId: string) => void;
    endTurn: () => void;
    joinGame: (gameId: string) => void;
}

export interface GameSetupConfig {
    playerId: string;
    gameId: string;
    gameActions: GameActions;
    gameEvents: GameEventEmitter;
    width?: number;
    height?: number;
    backgroundColor?: string;
}

export class GameSetup {
    private static readonly DEFAULT_WIDTH = 800;
    private static readonly DEFAULT_HEIGHT = 700;
    private static readonly DEFAULT_BG_COLOR = '#1099bb';

    public static createGame(config: GameSetupConfig,
        onReady: () => void,
        useBabylon: boolean = false) {
        if (useBabylon) {
            const canvas = config.canvas || this.createCanvas(config.width, config.height);
            return this.setupBabylonGame(canvas, config, onReady);
        } else {
            return this.setupPhaserGame(config, onReady);
        }
    }

    private static createCanvas(width = this.DEFAULT_WIDTH, height = this.DEFAULT_HEIGHT): HTMLCanvasElement {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        document.body.appendChild(canvas);
        return canvas;
    }

    private static setupBabylonGame(
        canvas: HTMLCanvasElement,
        config: GameSetupConfig,
        onReady: () => void
    ) {
        const game = new BabylonGameScene(canvas);
        game.init({
            playerId: config.playerId,
            gameActions: config.gameActions,
            gameEvents: config.gameEvents,
            onReady: onReady
        });
        return game;
    }

    private static setupPhaserGame(
        config: GameSetupConfig,
        onReady: () => void
    ) {
        const phaserConfig = {
            type: Phaser.AUTO,
            width: config.width || this.DEFAULT_WIDTH,
            height: config.height || this.DEFAULT_HEIGHT,
            backgroundColor: config.backgroundColor || this.DEFAULT_BG_COLOR,
            scene: PhaserGameScene
        };

        const game = new Phaser.Game(phaserConfig);
        game.scene.start('GameScene', {
            playerId: config.playerId,
            gameActions: config.gameActions,
            gameEvents: config.gameEvents,
            onReady: onReady,
        });
        return game;
    }
} 