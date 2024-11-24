import { TileType, Position, GameState, UnitType, Unit } from '@shared/types';
import { HexGrid } from './hex-grid';
import { UIPanel } from './ui-panel';

export class GameScene extends Phaser.Scene {
    private hexSize: number;
    private socket: WebSocket;
    private playerId?: string;
    private gameId: string;
    private selectedUnit: Unit | null = null;
    private highlightedHexes: Phaser.GameObjects.Graphics[] = [];
    private hexGrid: HexGrid;
    private selectedUnitSprite: Phaser.GameObjects.Graphics | null = null;
    private uiPanel: UIPanel;
    private mapContainer: Phaser.GameObjects.Container;

    constructor() {
        super({ key: 'GameScene' });
        this.hexSize = 32;
        this.hexGrid = new HexGrid(this.hexSize);
        this.gameId = 'test-game';
    }

    init(data: { socket: WebSocket; playerId: string }) {
        this.socket = data.socket;
        this.playerId = data.playerId;

        this.socket.addEventListener('message', (event) => {
            const data = JSON.parse(event.data);

            switch (data.type) {
                case 'joined_game':
                    console.log('Joined game with playerId:', data.playerId);
                    this.playerId = data.playerId;
                    localStorage.setItem('playerId', data.playerId);
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
        // Create container for map elements
        this.mapContainer = this.add.container(0, 0);

        // Add click handler
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            this.handleHexClick(pointer);
        });

        this.uiPanel = new UIPanel(this);

        // Add event listeners for UI actions
        this.events.on('fortify_unit', this.handleFortify, this);
        this.events.on('level_up_unit', this.handleLevelUp, this);
        this.events.on('end_turn', this.handleEndTurn, this);
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

    private drawHex(x: number, y: number, color: number): Phaser.GameObjects.Graphics {
        const graphics = new Phaser.GameObjects.Graphics(this);
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

        return graphics;
    }

    private drawUnit(unit: Unit, x: number, y: number): Phaser.GameObjects.Text {
        const text = unit.type === UnitType.ARCHER ? 'A' : 'W';
        const isMyUnit = unit.playerId === this.playerId;
        const color = isMyUnit ? '#00ff00' : '#ff0000';

        return new Phaser.GameObjects.Text(this, x - 8, y - 8, text, {
            color: color,
            fontSize: '16px',
            fontStyle: 'bold'
        });
    }

    public renderMap(tiles: { type: TileType; position: Position }[], units: Unit[] = []): void {
        console.log('Rendering map with units:', units);
        this.clearSelection();

        // Destroy all existing children
        this.mapContainer.removeAll(true);  // true means destroy the children
        console.log('Cleared map container');

        // Create a new container for tiles
        const tilesContainer = new Phaser.GameObjects.Container(this, 0, 0);
        this.mapContainer.add(tilesContainer);

        // Create a new container for units
        const unitsContainer = new Phaser.GameObjects.Container(this, 0, 0);
        this.mapContainer.add(unitsContainer);

        // Draw tiles first
        tiles.forEach(tile => {
            const pixelPos = this.hexGrid.hexToPixel(tile.position);
            const hex = this.drawHex(pixelPos.x, pixelPos.y, this.getTileColor(tile.type));
            tilesContainer.add(hex);
        });

        // Draw units on top
        units.forEach(unit => {
            const pixelPos = this.hexGrid.hexToPixel(unit.position);
            console.log('Drawing unit at position:', unit.position, 'pixel pos:', pixelPos);
            const unitSprite = this.drawUnit(unit, pixelPos.x, pixelPos.y);
            unitsContainer.add(unitSprite);
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
        this.uiPanel.updateUnitInfo(null);
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
        this.uiPanel.updateUnitInfo(unit);
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

    private handleFortify() {
        if (this.selectedUnit && this.selectedUnit.movementPoints > 0) {
            this.socket.send(JSON.stringify({
                type: 'action',
                action: {
                    type: 'FORTIFY_UNIT',
                    payload: {
                        unitId: this.selectedUnit.id
                    }
                }
            }));
        }
    }

    private handleLevelUp() {
        // To be implemented when we add experience system
    }

    private handleEndTurn() {
        this.socket.send(JSON.stringify({
            type: 'action',
            action: {
                type: 'END_TURN',
                payload: null
            }
        }));
    }
}
