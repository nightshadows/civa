import { TileType, Position, GameState, UnitType, Unit } from '@shared/types';
import { HexGrid } from './HexGrid';

export class GameScene extends Phaser.Scene {
    private hexSize: number;
    private socket: WebSocket;
    private playerId?: string;
    private gameId: string;
    private selectedUnit: Unit | null = null;
    private highlightedHexes: Phaser.GameObjects.Graphics[] = [];
    private hexGrid: HexGrid;
    private selectedUnitSprite: Phaser.GameObjects.Graphics | null = null;

    constructor() {
        super({ key: 'GameScene' });
        this.hexSize = 32;
        this.hexGrid = new HexGrid(this.hexSize);
        this.gameId = 'test-game';
    }

    init(data: { socket: WebSocket }) {
        this.socket = data.socket;
        
        this.socket.addEventListener('message', (event) => {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
                case 'joined_game':
                    console.log('Joined game with playerId:', data.playerId);
                    this.playerId = data.playerId;
                    break;
                    
                case 'game_state':
                    console.log('Received game state:', data.state);
                    this.registry.set('gameState', data.state);
                    this.renderMap(data.state.visibleTiles, data.state.visibleUnits);
                    break;
                    
                case 'error':
                    console.error('Game error:', data.message);
                    break;
            }
        });

        // Join game when scene starts
        if (this.socket.readyState === WebSocket.OPEN) {
            this.joinGame();
        } else {
            this.socket.addEventListener('open', () => this.joinGame());
        }
    }

    create() {
        // Add click handler
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            this.handleHexClick(pointer);
        });
    }

    private joinGame() {
        this.socket.send(JSON.stringify({
            type: 'join_game',
            gameId: 'test-game'
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
        const isMyUnit = unit.playerId === this.playerId;
        const color = isMyUnit ? '#00ff00' : '#ff0000';
        
        console.log('Drawing unit:', {
            unitId: unit.id,
            unitPlayerId: unit.playerId,
            myPlayerId: this.playerId,
            isMyUnit
        });
        
        this.add.text(x - 8, y - 8, text, {
            color: color,
            fontSize: '16px',
            fontStyle: 'bold'
        });
    }

    public renderMap(tiles: { type: TileType; position: Position }[], units: Unit[] = []): void {
        this.clearSelection();  // Clear selection when re-rendering
        
        this.children.removeAll();

        // Draw tiles first
        tiles.forEach(tile => {
            const pixelPos = this.hexGrid.hexToPixel(tile.position);
            this.drawHex(pixelPos.x, pixelPos.y, this.getTileColor(tile.type));
        });

        // Draw units on top
        units.forEach(unit => {
            const pixelPos = this.hexGrid.hexToPixel(unit.position);
            this.drawUnit(unit, pixelPos.x, pixelPos.y);
        });

        // Restore selection if needed
        if (this.selectedUnit) {
            const stillExists = units.find(u => u.id === this.selectedUnit?.id);
            if (stillExists) {
                this.highlightSelectedUnit(this.selectedUnit);
                this.showMovementRange(this.selectedUnit);
            } else {
                this.selectedUnit = null;
            }
        }
    }

    private clearHighlights(): void {
        this.highlightedHexes.forEach(hex => hex.destroy());
        this.highlightedHexes = [];
    }

    private showMovementRange(unit: Unit): void {
        this.clearHighlights();
        
        // Get all hex coordinates within movement range
        const movementHexes = this.hexGrid.getHexesInRange(unit.position, unit.movementPoints);
        
        // Remove the unit's current position from the highlights
        const reachableHexes = movementHexes.filter(hex => 
            !(hex.x === unit.position.x && hex.y === unit.position.y)
        );
        
        // Draw highlights for each hex
        reachableHexes.forEach(hexPos => {
            const pixelPos = this.hexGrid.hexToPixel(hexPos);
            const highlight = this.drawHexHighlight(pixelPos.x, pixelPos.y);
            this.highlightedHexes.push(highlight);
        });
    }

    private drawHexHighlight(x: number, y: number): Phaser.GameObjects.Graphics {
        const highlight = this.add.graphics();
        highlight.lineStyle(2, 0xffff00, 0.5);
        highlight.fillStyle(0xffff00, 0.2);

        const points: { x: number, y: number }[] = [];
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            points.push({
                x: x + this.hexSize * Math.cos(angle),
                y: y + this.hexSize * Math.sin(angle)
            });
        }

        highlight.beginPath();
        highlight.moveTo(points[0].x, points[0].y);
        points.forEach(point => highlight.lineTo(point.x, point.y));
        highlight.closePath();
        highlight.fillPath();
        highlight.strokePath();

        return highlight;
    }

    private clearSelection(): void {
        this.selectedUnit = null;
        this.clearHighlights();
        if (this.selectedUnitSprite) {
            this.selectedUnitSprite.destroy();
            this.selectedUnitSprite = null;
        }
    }

    private highlightSelectedUnit(unit: Unit): void {
        // Clear any existing selection
        if (this.selectedUnitSprite) {
            this.selectedUnitSprite.destroy();
        }

        const pixelPos = this.hexGrid.hexToPixel(unit.position);
        
        // Create a new highlight for the selected unit
        const highlight = this.add.graphics();
        highlight.lineStyle(3, 0x00ff00, 1);  // Thick green border
        
        // Draw circle around the unit
        highlight.strokeCircle(pixelPos.x, pixelPos.y, this.hexSize - 5);
        
        this.selectedUnitSprite = highlight;
    }

    private handleHexClick(pointer: Phaser.Input.Pointer): void {
        const clickedHexPos = this.hexGrid.pixelToHex(pointer.x, pointer.y);
        const clickedUnit = this.findUnitAtPosition(pointer.x, pointer.y);
        
        if (clickedUnit) {
            // If clicking on a unit that belongs to the player
            if (clickedUnit.playerId === this.playerId) {
                // If clicking on the same unit that's already selected, deselect it
                if (this.selectedUnit === clickedUnit) {
                    this.clearSelection();
                } else {
                    // Select the new unit
                    this.selectedUnit = clickedUnit;
                    this.highlightSelectedUnit(clickedUnit);
                    this.showMovementRange(clickedUnit);
                }
            }
        } else if (this.selectedUnit) {
            // Check if the clicked hex is within movement range
            const movementHexes = this.hexGrid.getHexesInRange(this.selectedUnit.position, this.selectedUnit.movementPoints);
            const canMoveTo = movementHexes.some(hex => 
                hex.x === clickedHexPos.x && hex.y === clickedHexPos.y
            );

            if (canMoveTo) {
                console.log('Attempting to move unit:', {
                    unitId: this.selectedUnit.id,
                    from: this.selectedUnit.position,
                    to: clickedHexPos
                });

                // Send move action to server
                this.socket.send(JSON.stringify({
                    type: 'action',
                    action: {
                        type: 'MOVE_UNIT',
                        payload: {
                            unitId: this.selectedUnit.id,
                            destination: clickedHexPos
                        }
                    }
                }));
            }
            this.clearSelection();
        } else {
            this.clearSelection();
        }
    }

    private findUnitAtPosition(x: number, y: number): Unit | null {
        const hexPos = this.hexGrid.pixelToHex(x, y);
        const units = this.getVisibleUnits();
        
        return units.find(unit => 
            unit.position.x === hexPos.x && 
            unit.position.y === hexPos.y
        ) || null;
    }

    // Add this helper method to get current visible units
    private getVisibleUnits(): Unit[] {
        const gameState = this.registry.get('gameState');
        return gameState?.visibleUnits || [];
    }
}
