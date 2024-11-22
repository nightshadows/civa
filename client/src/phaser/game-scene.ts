import { TileType, Position, GameState, UnitType, Unit } from '@shared/types';
import { HexGrid } from './hex-grid';
import { UIPanel } from './ui-panel';
import { View } from './view';

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
    private view: View;
    private debugText: Phaser.GameObjects.Text;

    constructor() {
        super({ key: 'GameScene' });
        this.hexSize = 32;
        this.hexGrid = new HexGrid(this.hexSize);
        this.gameId = 'test-game';
    }

    init(data: { socket: WebSocket; playerId: string }) {
        this.socket = data.socket;
        this.playerId = data.playerId;

        // Create view with viewport dimensions
        this.view = new View(
            this.game.canvas.width,
            this.game.canvas.height - 100,
            this.hexSize
        );

        // Create UI Panel and map container early
        this.uiPanel = new UIPanel(this);
        this.mapContainer = this.add.container(0, 0);

        // Wait for assets to load before processing messages
        this.load.once('complete', () => {
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
                        this.handleGameState(data.state);
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
        });
    }

    create() {
        // Center the view initially
        const gameState = this.registry.get('gameState');
        const mapWidth = gameState?.mapWidth || 14;
        const mapHeight = gameState?.mapHeight || 10;

        // Calculate initial view position
        const initialX = (this.game.canvas.width - mapWidth * this.hexSize * 2 * 0.75) / 2;
        const initialY = (this.game.canvas.height - 100 - mapHeight * this.hexSize * Math.sqrt(3)) / 2;
        this.view.setPosition(0, 0);

        // Only keep left-click handler
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            this.handleHexClick(pointer);
        });

        this.uiPanel = new UIPanel(this);

        // Add event listeners for UI actions
        this.events.on('fortify_unit', this.handleFortify, this);
        this.events.on('level_up_unit', this.handleLevelUp, this);
        this.events.on('end_turn', this.handleEndTurn, this);

        this.debugText = this.add.text(10, 10, '', {
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 10, y: 5 },
            fontSize: '14px'
        });
        this.debugText.setDepth(1000); // Ensure it's always on top

        // Add keyboard controls for map panning
        const moveView = (deltaX: number, deltaY: number) => {
            const currentPos = this.view.getPosition();
            this.view.setPosition(currentPos.x + deltaX, currentPos.y + deltaY);

            const gameState = this.registry.get('gameState');
            if (gameState) {
                this.renderMap(gameState.visibleTiles, gameState.visibleUnits);
            }
        };

        // Calculate movement distances
        const hexWidth = this.hexSize * 2 * 0.75;
        const hexHeight = this.hexSize * Math.sqrt(3);

        // Setup keyboard controls
        this.input.keyboard.on('keydown-LEFT', () => {
            moveView(hexWidth, 0);
        });

        this.input.keyboard.on('keydown-RIGHT', () => {
            moveView(-hexWidth, 0);
        });

        this.input.keyboard.on('keydown-UP', () => {
            moveView(0, hexHeight);
        });

        this.input.keyboard.on('keydown-DOWN', () => {
            moveView(0, -hexHeight);
        });
    }

    private joinGame() {
        this.socket.send(JSON.stringify({
            type: 'join_game',
            gameId: this.gameId,
            playerId: this.playerId
        }));
    }

    private drawHex(x: number, y: number, tileType: TileType, position: Position): Phaser.GameObjects.Container {
        const container = new Phaser.GameObjects.Container(this, 0, 0);

        // Get sprite key based on tile type
        const spriteKey = this.getTileSprite(tileType);

        // Add the terrain sprite
        const sprite = new Phaser.GameObjects.Sprite(this, x, y, spriteKey);
        sprite.setScale(this.hexSize * 2 / sprite.width); // Scale to match hex size

        // Add coordinates text (you might want to remove this in production)
        const text = new Phaser.GameObjects.Text(this, x, y, `${position.x},${position.y}`, {
            color: '#000000',
            fontSize: '12px',
            align: 'center'
        });
        text.setOrigin(0.5, 0.5);

        container.add([sprite, text]);
        return container;
    }

    private getTileSprite(type: TileType): string {
        switch (type) {
            case TileType.GRASS: return 'grass';
            case TileType.FOREST: return 'forest';
            case TileType.HILLS: return 'hills';
            case TileType.WATER: return 'water';
            default: return 'grass';
        }
    }

    private drawUnit(unit: Unit, x: number, y: number): Phaser.GameObjects.Sprite {
        const isMyUnit = unit.playerId === this.playerId;
        const spriteKey = unit.type === UnitType.WARRIOR ? 'warrior' : 'archer';
        const sprite = this.add.sprite(x, y, spriteKey);

        if (!isMyUnit) {
            sprite.setTint(0xff0000);
            sprite.setAlpha(0.5);
        }

        return sprite;
    }

    public renderMap(tiles: { type: TileType; position: Position }[], units: Unit[] = []): void {
        this.mapContainer.removeAll(true);

        const tilesContainer = new Phaser.GameObjects.Container(this, 0, 0);
        const unitsContainer = new Phaser.GameObjects.Container(this, 0, 0);

        this.mapContainer.add(tilesContainer);
        this.mapContainer.add(unitsContainer);

        tiles.forEach(tile => {
            const worldPos = this.view.hexToWorld(tile.position);
            const screenPos = this.view.worldToScreen(worldPos.x, worldPos.y);
            const hex = this.drawHex(screenPos.x, screenPos.y, tile.type, tile.position);
            tilesContainer.add(hex);
        });

        units.forEach(unit => {
            const worldPos = this.view.hexToWorld(unit.position);
            const screenPos = this.view.worldToScreen(worldPos.x, worldPos.y);
            const unitSprite = this.drawUnit(unit, screenPos.x, screenPos.y);
            unitsContainer.add(unitSprite);
        });

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
        const gameState = this.registry.get('gameState');
        const mapData = gameState.visibleTiles.reduce((acc: TileType[][], tile) => {
            if (!acc[tile.position.y]) acc[tile.position.y] = [];
            acc[tile.position.y][tile.position.x] = tile.type;
            return acc;
        }, []);

        const movementHexes = this.hexGrid.getHexesInRange(
            unit.position,
            unit.movementPoints,
            gameState.mapSize,
            mapData
        );

        // Only filter out center position for highlighting
        const highlightHexes = movementHexes.filter(hex =>
            !(hex.x === unit.position.x && hex.y === unit.position.y)
        );

        // Draw highlights for each hex
        highlightHexes.forEach(hexPos => {
            const worldPos = this.view.hexToWorld(hexPos);
            const screenPos = this.view.worldToScreen(worldPos.x, worldPos.y);
            const highlight = this.drawHexHighlight(screenPos.x, screenPos.y);
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
        if (this.selectedUnitSprite) {
            this.selectedUnitSprite.destroy();
        }

        const worldPos = this.view.hexToWorld(unit.position);
        const screenPos = this.view.worldToScreen(worldPos.x, worldPos.y);

        // Create a new highlight for the selected unit
        const highlight = this.add.graphics();
        highlight.lineStyle(3, 0xff8c00, 1);  // Changed from 0x00ff00 to 0xff8c00 (dark orange)

        // Draw circle around the unit using screen coordinates
        highlight.strokeCircle(screenPos.x, screenPos.y, this.hexSize - 5);

        this.selectedUnitSprite = highlight;
        this.uiPanel.updateUnitInfo(unit);
    }

    private handleHexClick(pointer: Phaser.Input.Pointer): void {
        const clickedHexPos = this.view.screenToHex(pointer.x, pointer.y);
        const worldPos = this.view.screenToWorld(pointer.x, pointer.y);
        const gameState = this.registry.get('gameState');

        // Create map data for movement calculation
        const mapData = gameState.visibleTiles.reduce((acc: TileType[][], tile) => {
            if (!acc[tile.position.y]) acc[tile.position.y] = [];
            acc[tile.position.y][tile.position.x] = tile.type;
            return acc;
        }, []);

        // Update debug text
        this.debugText.setText(
            `Screen: (${Math.round(pointer.x)}, ${Math.round(pointer.y)})\n` +
            `World: (${Math.round(worldPos.x)}, ${Math.round(worldPos.y)})\n` +
            `Hex: (${clickedHexPos.x}, ${clickedHexPos.y})\n` +
            `View: (${this.view.getPosition().x}, ${this.view.getPosition().y})`
        );

        const clickedUnit = this.findUnitAtPosition(pointer.x, pointer.y);

        if (clickedUnit) {
            if (clickedUnit.playerId === this.playerId) {
                if (this.selectedUnit === clickedUnit) {
                    this.clearSelection();
                } else {
                    this.selectedUnit = clickedUnit;
                    this.highlightSelectedUnit(clickedUnit);
                    this.showMovementRange(clickedUnit);
                }
            }
        } else if (this.selectedUnit) {
            // Check if the clicked hex is within movement range
            const movementHexes = this.hexGrid.getHexesInRange(
                this.selectedUnit.position,
                this.selectedUnit.movementPoints,
                gameState.mapSize,
                mapData
            );

            const canMoveTo = movementHexes.some(hex =>
                hex.x === clickedHexPos.x && hex.y === clickedHexPos.y
            );

            if (canMoveTo) {
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

    private findUnitAtPosition(screenX: number, screenY: number): Unit | null {
        const hexPos = this.view.screenToHex(screenX, screenY);
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

    private handleGameState(state: GameState) {
        this.registry.set('gameState', state);
        this.renderMap(state.visibleTiles, state.visibleUnits);
        this.uiPanel.updateTurnInfo(state.currentPlayerId, state.playerId);
        this.uiPanel.updatePlayerList(state);
    }

    preload() {
        // Load warrior sprite
        this.load.spritesheet('warrior', 'assets/warrior.png', {
            frameWidth: 32,
            frameHeight: 32
        });

        // Load archer sprite
        this.load.spritesheet('archer', 'assets/archer.png', {
            frameWidth: 32,
            frameHeight: 32
        });

        // Add terrain sprites
        this.load.image('grass', 'assets/terrain/grass.png');
        this.load.image('forest', 'assets/terrain/forest.png');
        this.load.image('hills', 'assets/terrain/hills.png');
        this.load.image('water', 'assets/terrain/water.png');
    }
}
