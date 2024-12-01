import Phaser from 'phaser';
import { GameScene as PhaserGameScene } from './phaser/game-scene';
import { BabylonGameScene } from './babylon/babylon-game-scene';
import { GameActions, GameEventEmitter } from './game';

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
            const canvas = this.createCanvas(config.width, config.height);
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
        const UI_PANEL_HEIGHT = 150;
        const windowHeight = window.innerHeight;
        const windowWidth = window.innerWidth;
        const gameHeight = windowHeight - UI_PANEL_HEIGHT;

        const phaserConfig = {
            type: Phaser.AUTO,
            width: windowWidth,
            height: gameHeight,
            backgroundColor: config.backgroundColor || this.DEFAULT_BG_COLOR,
            scene: PhaserGameScene,
            scale: {
                mode: Phaser.Scale.RESIZE,
                autoCenter: Phaser.Scale.CENTER_BOTH,
                parent: 'gameContainer',
            }
        };

        const game = new Phaser.Game(phaserConfig);

        // Handle window resizing
        window.addEventListener('resize', () => {
            const newWidth = window.innerWidth;
            const newHeight = window.innerHeight - UI_PANEL_HEIGHT;
            game.scale.resize(newWidth, newHeight);
        });

        game.scene.start('GameScene', {
            playerId: config.playerId,
            gameActions: config.gameActions,
            gameEvents: config.gameEvents,
            onReady: onReady,
            uiPanelHeight: UI_PANEL_HEIGHT
        });
        return game;
    }
}