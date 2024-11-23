import { TileType, Position, GameState, UnitType, Unit } from '@shared/types';

export class GameScene extends Phaser.Scene {
    private hexSize: number;
    private socket: WebSocket;
    private playerId: string;
    private gameId: string;

    constructor() {
        super({ key: 'GameScene' });
        this.hexSize = 32;
        this.playerId = Math.random().toString(36).substring(7);
        this.gameId = 'test-game';
    }

    init(socket: WebSocket) {
        this.socket = socket;

        // Set up socket listeners
        this.socket.addEventListener('message', (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'game_state') {
                console.log('Received game state:', data.state);
                this.renderMap(data.state.visibleTiles, data.state.visibleUnits);
            }
        });

        // Wait for socket to be ready
        if (this.socket.readyState === WebSocket.OPEN) {
            this.joinGame();
        } else {
            this.socket.addEventListener('open', () => {
                this.joinGame();
            });
        }
    }

    create() {
        // Scene setup code can go here
    }

    private joinGame() {
        this.socket.send(JSON.stringify({
            type: 'join_game',
            gameId: this.gameId,
            playerId: this.playerId
        }));
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

    private drawUnit(unit: Unit, x: number, y: number): void {
        const text = unit.type === UnitType.ARCHER ? 'A' : 'W';
        const color = unit.playerId === this.playerId ? '#0000ff' : '#ff0000';
        
        this.add.text(x - 8, y - 8, text, {
            color: color,
            fontSize: '16px',
            fontStyle: 'bold'
        });
    }

    public renderMap(tiles: { type: TileType; position: Position }[], units: Unit[] = []): void {
        this.children.removeAll();

        // Draw tiles first
        tiles.forEach(tile => {
            const pixelPos = this.hexToPixel(tile.position);
            this.drawHex(pixelPos.x, pixelPos.y, this.getTileColor(tile.type));
        });

        // Draw units on top
        units.forEach(unit => {
            const pixelPos = this.hexToPixel(unit.position);
            this.drawUnit(unit, pixelPos.x, pixelPos.y);
        });
    }
}
