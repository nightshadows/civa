import { TileType, Position, GameState } from '@shared/types';

export class GameScene extends Phaser.Scene {
    private hexSize: number;
    private socket: any;

    constructor() {
        super({ key: 'GameScene' });
        this.hexSize = 32;
    }

    init(socket: any) {
        this.socket = socket;
    }

    create() {
        // Connect to server
        const playerId = Math.random().toString(36).substring(7);
        const gameId = 'test-game';

        this.socket.on('game_state', (state: GameState) => {
            console.log('Received game state:', state);
            this.renderMap(state.visibleTiles);
        });

        this.socket.emit('join_game', { gameId, playerId });
    }

    private getTileColor(type: TileType): number {
        switch (type) {
            case TileType.GRASS: return 0x7ec850;
            case TileType.FOREST: return 0x2d5a27;
            case TileType.HILLS: return 0x8b7355;
            case TileType.WATER: return 0x4287f5;
            default: return 0x000000;
        }
    }

    private hexToPixel(hex: Position): { x: number, y: number } {
        const width = this.hexSize * 2;
        const height = Math.sqrt(3) * this.hexSize;

        return {
            x: hex.x * width * 0.75,
            y: hex.y * height + (hex.x % 2) * height/2
        };
    }

    private drawHex(x: number, y: number, color: number): void {
        const graphics = this.add.graphics();
        graphics.lineStyle(1, 0x000000, 0.5);
        graphics.fillStyle(color);

        const points: { x: number, y: number }[] = [];
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            points.push({
                x: x + this.hexSize * Math.cos(angle),
                y: y + this.hexSize * Math.sin(angle)
            });
        }

        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        points.forEach(point => graphics.lineTo(point.x, point.y));
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
    }

    public renderMap(tiles: { type: TileType; position: Position }[]): void {
        this.children.removeAll();

        tiles.forEach(tile => {
            const pixelPos = this.hexToPixel(tile.position);
            this.drawHex(pixelPos.x, pixelPos.y, this.getTileColor(tile.type));
        });
    }
}
