import { TileType, Position, GameState, UnitType, Unit, CombatType } from '@shared/types';
import { HexGrid } from './hex-grid';
import { UIPanel } from './ui-panel';
import { View } from './view';
import { GameActions, GameEventEmitter } from '../game';
import { getHexDistance } from '@shared/hex-utils';

export class GameScene extends Phaser.Scene {
    private hexSize: number;
    private playerId?: string;
    private selectedUnit: Unit | null = null;
    private highlightedHexes: Phaser.GameObjects.Graphics[] = [];
    private hexGrid: HexGrid;
    private selectedUnitSprite: Phaser.GameObjects.Graphics | null = null;
    private uiPanel?: UIPanel;
    private mapContainer?: Phaser.GameObjects.Container;
    private view?: View;
    private debugText?: Phaser.GameObjects.Text;
    private gameActions?: GameActions;
    private gameEvents?: GameEventEmitter;
    private boundHandleGameState?: (state: GameState) => void;
    private uiPanelHeight: number = 150;
    private players: Map<string, { name: string; type: string }> = new Map();

    constructor() {
        super({ key: 'GameScene' });
        this.hexSize = 32;
        this.hexGrid = new HexGrid(this.hexSize);
    }

    init(data: {
        playerId: string;
        gameActions: GameActions;
        gameEvents: GameEventEmitter;
        onReady: () => void;
        uiPanelHeight: number;
    }) {
        this.playerId = data.playerId;
        this.gameActions = data.gameActions;
        this.gameEvents = data.gameEvents;
        this.uiPanelHeight = data.uiPanelHeight;

        // Create view with adjusted viewport dimensions
        this.view = new View(
            this.game.canvas.width,
            this.game.canvas.height - this.uiPanelHeight,
            this.hexSize
        );

        // Create map container with proper positioning and depth
        this.mapContainer = this.add.container(0, 0);
        this.mapContainer.setDepth(0); // Set map to lowest depth

        // Create UI Panel with higher depth
        this.uiPanel = new UIPanel(this, this.uiPanelHeight);

        // Subscribe to game state updates with type safety
        this.boundHandleGameState = this.handleGameState.bind(this);
        this.gameEvents.on('updateGameState', this.boundHandleGameState);

        // Optional: Handle other events
        this.gameEvents.on('gameError', ({ message }) => {
            console.error('Game error:', message);
            // Handle error in UI
        });

        // Wait for assets to load before initializing
        this.load.once('complete', () => {
            data.onReady();
        });

        // Add handler for player_joined event
        this.gameEvents.on('player_joined', (message) => {
            if (message.player) {
                this.players.set(message.player.id, {
                    name: message.player.name,
                    type: message.player.type
                });
                // Update UI if we have a game state
                const gameState = this.registry.get('gameState');
                if (gameState) {
                    this.uiPanel?.updatePlayerList(gameState, this.players);
                }
            }
        });
    }

    shutdown() {
        if (this.gameEvents && this.boundHandleGameState) {
            this.gameEvents.off('updateGameState', this.boundHandleGameState);
        }
    }

    create() {
        // Center the view initially
        const gameState = this.registry.get('gameState');
        const mapWidth = gameState?.mapWidth || 14;
        const mapHeight = gameState?.mapHeight || 10;

        // Calculate initial view position
        const initialX = (this.game.canvas.width - mapWidth * this.hexSize * 2 * 0.75) / 2;
        const initialY = (this.game.canvas.height - this.uiPanelHeight - mapHeight * this.hexSize * Math.sqrt(3)) / 2;
        this.view!.setPosition(0, 0);

        // Only keep left-click handler
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            this.handleHexClick(pointer);
        });

        // Add event listeners for UI actions
        this.events.on('fortify_unit', this.handleFortify, this);
        this.events.on('level_up_unit', this.handleLevelUp, this);
        this.events.on('end_turn', this.handleEndTurn, this);
        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            this.updateDebugText(pointer);
        });

        // Create debug text with better positioning and style
        this.debugText = this.add.text(10, 10, '', {
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 10, y: 5 },
            fontSize: '14px'
        });
        this.debugText.setDepth(1000).setScrollFactor(0); // Keep it fixed on screen

        // Add keyboard controls for map panning
        const moveView = (deltaX: number, deltaY: number) => {
            this.view!.moveView(deltaX, deltaY);

            const gameState = this.registry.get('gameState');
            if (gameState) {
                this.renderMap(gameState.visibleTiles, gameState.visibleUnits);
            }
        };

        // Calculate movement distances
        const hexWidth = this.hexSize * 2 * 0.75;
        const hexHeight = this.hexSize * Math.sqrt(3);

        // Setup keyboard controls
        this.input?.keyboard?.on('keydown-LEFT', () => {
            moveView(hexWidth, 0);
        });

        this.input?.keyboard?.on('keydown-RIGHT', () => {
            moveView(-hexWidth, 0);
        });

        this.input?.keyboard?.on('keydown-UP', () => {
            moveView(0, hexHeight);
        });

        this.input?.keyboard?.on('keydown-DOWN', () => {
            moveView(0, -hexHeight);
        });

        // Add Enter key handler
        this.input?.keyboard?.on('keydown-ENTER', () => {
            const gameState = this.registry.get('gameState');
            if (!gameState || gameState.currentPlayerId !== this.playerId) return;

            const myUnits = this.getVisibleUnits().filter(u => u.playerId === this.playerId);
            const unitsWithMovement = myUnits.filter(u => u.movementPoints > 0);

            if (unitsWithMovement.length === 0) {
                // If no units have movement points, end turn
                this.handleEndTurn();
                return;
            }

            if (!this.selectedUnit) {
                // If no unit selected, select first unit with movement
                this.selectedUnit = unitsWithMovement[0];
                this.highlightSelectedUnit(unitsWithMovement[0]);
                this.showAuxInfo(unitsWithMovement[0]);
                return;
            }

            // Find index of current selected unit
            const currentIndex = unitsWithMovement.findIndex(u => u.id === this.selectedUnit?.id);

            if (currentIndex === -1 || currentIndex === unitsWithMovement.length - 1) {
                // If current unit not found or is last unit, select first unit
                this.selectedUnit = unitsWithMovement[0];
                this.highlightSelectedUnit(unitsWithMovement[0]);
                this.showAuxInfo(unitsWithMovement[0]);
            } else {
                // Select next unit
                this.selectedUnit = unitsWithMovement[currentIndex + 1];
                this.highlightSelectedUnit(unitsWithMovement[currentIndex + 1]);
                this.showAuxInfo(unitsWithMovement[currentIndex + 1]);
            }
        });
    }

    private drawHex(x: number, y: number, tileType: TileType, position: Position): Phaser.GameObjects.Container {
        const container = new Phaser.GameObjects.Container(this, 0, 0);

        // Add the terrain sprite
        const spriteKey = this.getTileSprite(tileType);
        const sprite = new Phaser.GameObjects.Sprite(this, x, y, spriteKey);
        sprite.setScale(this.hexSize * 2 / sprite.width);

        container.add([sprite]);
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

    private drawUnit(unit: Unit, x: number, y: number): Phaser.GameObjects.Container {
        const container = new Phaser.GameObjects.Container(this, x, y);

        // Create unit sprite
        const isMyUnit = unit.playerId === this.playerId;
        let spriteKey;
        switch (unit.type) {
            case UnitType.WARRIOR:
                spriteKey = 'warrior';
                break;
            case UnitType.ARCHER:
                spriteKey = 'archer';
                break;
            case UnitType.SETTLER:
                spriteKey = 'settler';
                break;
            default:
                spriteKey = 'warrior';
        }
        const sprite = this.add.sprite(0, 0, spriteKey);

        if (!isMyUnit) {
            sprite.setTint(0xff0000);
            sprite.setAlpha(0.5);
        }

        // Add health bar
        const healthBarWidth = 30;
        const healthBarHeight = 4;
        const healthBarY = -sprite.height / 2 - 8; // Changed from -10 to -8

        // Health bar background (red)
        const healthBarBg = this.add.rectangle(
            0,
            healthBarY,
            healthBarWidth,
            healthBarHeight,
            0xff0000
        );

        // Health bar fill (green)
        const healthPercent = unit.currentHp / unit.maxHp;
        const healthBarFill = this.add.rectangle(
            -healthBarWidth / 2 + (healthBarWidth * healthPercent) / 2,
            healthBarY,
            healthBarWidth * healthPercent,
            healthBarHeight,
            0x00ff00
        );

        container.add([sprite, healthBarBg, healthBarFill]);
        return container;
    }

    public renderMap(tiles: { type: TileType; position: Position }[], units: Unit[] = []): void {
        this.mapContainer!.removeAll(true);
        this.clearHighlights();

        const tilesContainer = new Phaser.GameObjects.Container(this, 0, 0);
        const unitsContainer = new Phaser.GameObjects.Container(this, 0, 0);

        this.mapContainer!.add(tilesContainer);
        this.mapContainer!.add(unitsContainer);

        // If no tiles, don't proceed
        if (tiles.length === 0) return;

        // Only automatically update view position once (on first render)
        if (!this.view!.hasBeenCentered) {
            const { x: centerX, y: centerY } = this.getViewCenter(tiles);
            this.view!.setPosition(centerX, centerY);
            this.view!.hasBeenCentered = true;
        }

        // Render tiles and units
        tiles.forEach(tile => {
            const worldPos = this.view!.hexToWorld(tile.position);
            const screenPos = this.view!.worldToScreen(worldPos.x, worldPos.y);
            const hex = this.drawHex(screenPos.x, screenPos.y, tile.type, tile.position);
            tilesContainer.add(hex);
        });

        units.forEach(unit => {
            const worldPos = this.view!.hexToWorld(unit.position);
            const screenPos = this.view!.worldToScreen(worldPos.x, worldPos.y);
            const unitSprite = this.drawUnit(unit, screenPos.x, screenPos.y);
            unitsContainer.add(unitSprite);
        });

        if (this.selectedUnit) {
            const updatedUnit = units.find(u => u.id === this.selectedUnit?.id);
            if (updatedUnit) {
                this.selectedUnit = updatedUnit;
                this.highlightSelectedUnit(updatedUnit);
                this.showAuxInfo(updatedUnit);
            } else {
                this.selectedUnit = null;
            }
        }
    }
    private getViewCenter(tiles: { type: TileType; position: Position; }[]): Position {
        // Find map boundaries
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        tiles.forEach(tile => {
            minX = Math.min(minX, tile.position.x);
            maxX = Math.max(maxX, tile.position.x);
            minY = Math.min(minY, tile.position.y);
            maxY = Math.max(maxY, tile.position.y);
        });

        // Calculate map dimensions
        const mapWidth = (maxX - minX + 1) * this.hexSize * 2 * 0.75;
        const mapHeight = (maxY - minY + 1) * this.hexSize * Math.sqrt(3);

        // Calculate center offset
        const centerX = (this.game.canvas.width - mapWidth) / 2;
        const centerY = (this.game.canvas.height - this.uiPanelHeight - mapHeight) / 2;

        return { x: centerX, y: centerY };
    }

    private clearHighlights(): void {
        this.highlightedHexes.forEach(hex => hex.destroy());
        this.highlightedHexes = [];
    }

    private showMovementRange(unit: Unit): void {
        this.clearHighlights();

        if (unit.movementPoints === 0) return;

        // Show movement range
        const gameState = this.registry.get('gameState') as GameState;
        const mapData = gameState.visibleTiles.reduce((acc: TileType[][], tile) => {
            if (!acc[tile.position.y]) acc[tile.position.y] = [];
            acc[tile.position.y][tile.position.x] = tile.type;
            return acc;
        }, []);

        const movementHexes = this.hexGrid.getReachableAndVisibleHexes(
            unit.position,
            unit.movementPoints,
            { width: gameState.mapSize, height: gameState.mapSize },
            mapData
        );

        // Only filter out center position for highlighting
        const highlightHexes = movementHexes.filter(hex =>
            !(hex.x === unit.position.x && hex.y === unit.position.y)
        );

        // Draw highlights for each hex
        highlightHexes.forEach(hexPos => {
            const worldPos = this.view!.hexToWorld(hexPos);
            const screenPos = this.view!.worldToScreen(worldPos.x, worldPos.y);
            const highlight = this.drawHexHighlight(screenPos.x, screenPos.y);
            this.highlightedHexes.push(highlight);
        });
    }

    private drawHexHighlight(x: number, y: number): Phaser.GameObjects.Graphics {
        return this.drawHexHighlightColor(x, y, 0xffff00);
    }

    private drawHexHighlightColor(x: number, y: number, color: number): Phaser.GameObjects.Graphics {
        const highlight = this.add.graphics();
        highlight.lineStyle(2, color, 0.5);
        highlight.fillStyle(color, 0.2);

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
        this.uiPanel!.updateUnitInfo(null);
    }

    private highlightSelectedUnit(unit: Unit): void {
        if (this.selectedUnitSprite) {
            this.selectedUnitSprite.destroy();
        }

        const worldPos = this.view!.hexToWorld(unit.position);
        const screenPos = this.view!.worldToScreen(worldPos.x, worldPos.y);

        // Create a new highlight for the selected unit
        const highlight = this.add.graphics();
        highlight.lineStyle(3, 0xff8c00, 1);  // Changed from 0x00ff00 to 0xff8c00 (dark orange)

        // Draw circle around the unit using screen coordinates
        highlight.strokeCircle(screenPos.x, screenPos.y, this.hexSize - 5);

        this.selectedUnitSprite = highlight;
        this.uiPanel!.updateUnitInfo(unit);
    }

    private handleHexClick(pointer: Phaser.Input.Pointer): void {
        const clickedHexPos = this.view!.screenToHex(pointer.x, pointer.y);
        const gameState = this.registry.get('gameState') as GameState;

        // Early return if no game state
        if (!gameState) {
            return;
        }

        // Create map data for movement calculation
        const mapData = gameState.visibleTiles.reduce((acc: TileType[][], tile) => {
            if (!acc[tile.position.y]) acc[tile.position.y] = [];
            acc[tile.position.y][tile.position.x] = tile.type;
            return acc;
        }, []);

        const clickedUnit = this.findUnitAtPosition(pointer.x, pointer.y);

        if (clickedUnit) {
            if (clickedUnit.playerId === this.playerId) {
                // Select own unit
                if (this.selectedUnit === clickedUnit) {
                    this.clearSelection();
                } else {
                    this.selectedUnit = clickedUnit;
                    this.highlightSelectedUnit(clickedUnit);
                    if (clickedUnit.movementPoints > 0) {
                        this.showAuxInfo(clickedUnit);
                    }
                }
            } else if (this.selectedUnit && this.selectedUnit.movementPoints > 0) {
                // Check if target is within attack range
                const distance = getHexDistance(this.selectedUnit.position, clickedUnit.position);
                const canAttack = this.canAttackTarget(this.selectedUnit, clickedUnit, distance);

                if (canAttack) {
                    this.gameActions!.attackUnit(this.selectedUnit.id, clickedUnit.id);
                }
            }
        } else if (this.selectedUnit) {
            // Check if the clicked hex is within movement range
            const movementHexes = this.hexGrid.getReachableAndVisibleHexes(
                this.selectedUnit.position,
                this.selectedUnit.movementPoints,
                { width: gameState.mapSize, height: gameState.mapSize },
                mapData
            );

            const canMoveTo = movementHexes.some(hex =>
                hex.x === clickedHexPos.x && hex.y === clickedHexPos.y
            );

            if (canMoveTo) {
                this.gameActions!.moveUnit(this.selectedUnit.id, clickedHexPos);
            }
        } else {
            this.clearSelection();
        }
    }

    private findUnitAtPosition(screenX: number, screenY: number): Unit | null {
        const hexPos = this.view!.screenToHex(screenX, screenY);
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
            this.gameActions!.fortifyUnit(this.selectedUnit.id);
        }
    }

    private handleLevelUp() {
        // To be implemented when we add experience system
    }

    private handleEndTurn() {
        this.gameActions!.endTurn();
    }

    private handleGameState(state: GameState) {
        this.registry.set('gameState', state);
        this.renderMap(state.visibleTiles, state.visibleUnits);
        this.uiPanel!.updateTurnInfo(state.currentPlayerId, state.playerId, state.turnNumber);
        this.uiPanel!.updatePlayerList(state, this.players);
        this.uiPanel?.updateMoveHistory(state.moveHistory);

        // Update highlight position if there's a selected unit
        if (this.selectedUnit) {
            const updatedUnit = state.visibleUnits.find(u => u.id === this.selectedUnit!.id);
            if (updatedUnit) {
                this.selectedUnit = updatedUnit; // Update the selected unit reference
                this.highlightSelectedUnit(updatedUnit);
                this.showAuxInfo(updatedUnit);
            } else {
                // Unit is no longer visible or was removed
                this.clearSelection();
            }
        }
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

        // Load settler sprite
        this.load.spritesheet('settler', 'assets/settler.png', {
            frameWidth: 32,
            frameHeight: 32
        });

        // Add terrain sprites
        this.load.image('grass', 'assets/terrain/grass.png');
        this.load.image('forest', 'assets/terrain/forest.png');
        this.load.image('hills', 'assets/terrain/hills.png');
        this.load.image('water', 'assets/terrain/water.png');
    }

    private areUnitsAdjacent(pos1: Position, pos2: Position): boolean {
        const neighbors = this.hexGrid.getNeighbors(pos1);
        return neighbors.some(n => n.x === pos2.x && n.y === pos2.y);
    }

    private canAttackTarget(attacker: Unit, defender: Unit, distance: number): boolean {
        if (attacker.combatType === CombatType.MELEE) {
            return distance === 1;
        } else if (attacker.combatType === CombatType.RANGED) {
            return distance <= (attacker.range || 1);
        }
        return false;
    }

    private showAttackRange(unit: Unit): void {
        const gameState = this.registry.get('gameState') as GameState;
        if (!gameState) return;

        if (unit.movementPoints === 0) return;

        // Get all enemy units
        const enemyUnits = gameState.visibleUnits.filter(u =>
            u.playerId !== unit.playerId
        );

        // Check each enemy unit if it's in attack range
        enemyUnits.forEach(enemyUnit => {
            const distance = getHexDistance(unit.position, enemyUnit.position);
            if (this.canAttackTarget(unit, enemyUnit, distance)) {
                const worldPos = this.view!.hexToWorld(enemyUnit.position);
                const screenPos = this.view!.worldToScreen(worldPos.x, worldPos.y);
                // Use red color for attackable units
                const highlight = this.drawHexHighlightColor(screenPos.x, screenPos.y, 0xff0000);
                this.highlightedHexes.push(highlight);
            }
        });
    }

    private showAuxInfo(unit: Unit): void {
        this.showMovementRange(unit);
        this.showAttackRange(unit);
    }

    // Add new method to handle debug text updates
    private updateDebugText(pointer: Phaser.Input.Pointer): void {
        if (!this.debugText) return;

        const worldPos = this.view!.screenToWorld(pointer.x, pointer.y);
        const hexPos = this.view!.screenToHex(pointer.x, pointer.y);
        const viewPos = this.view!.getPosition();
        const selectedUnitInfo = this.selectedUnit
            ? `Selected: ${this.selectedUnit.type} at (${this.selectedUnit.position.x},${this.selectedUnit.position.y})`
            : 'No unit selected';

        this.debugText.setText(
            `Screen: (${Math.round(pointer.x)}, ${Math.round(pointer.y)})\n` +
            `World: (${Math.round(worldPos.x)}, ${Math.round(worldPos.y)})\n` +
            `Hex: (${hexPos.x}, ${hexPos.y})\n` +
            `View: (${Math.round(viewPos.x)}, ${Math.round(viewPos.y)})\n` +
            selectedUnitInfo
        );
    }
}
