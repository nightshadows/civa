import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, Material, MeshBuilder, StandardMaterial, Color3, TransformNode, Vector2, DynamicTexture, Mesh, FresnelParameters, Animation, Viewport, Matrix } from '@babylonjs/core';
import { TileType, Position, GameState, UnitType, Unit, CombatType } from '@shared/types';
import { BabylonHexGrid } from './babylon-hex-grid';
import { BabylonUIPanel } from './babylon-ui-panel';
import { GameActions, GameEventEmitter } from '../game';
import { BabylonView } from './babylon-view';
import { BabylonHexMeshFactory } from './babylon-hex-mesh-factory';
import { getHexDistance } from '@shared/hex-utils';

export class BabylonGameScene {
    private scene: Scene;
    private engine: Engine;
    private hexSize: number;
    private playerId?: string;
    private selectedUnit: Unit | null = null;
    private highlightedHexes: TransformNode[] = [];
    private hexGrid: BabylonHexGrid;
    private selectedUnitMesh: Mesh | null = null;
    private uiPanel?: BabylonUIPanel;
    private gameActions?: GameActions;
    private gameEvents?: GameEventEmitter;
    private boundHandleGameState?: (state: GameState) => void;
    private currentGameState?: GameState;
    private camera: ArcRotateCamera;
    private view: BabylonView;
    private hexMeshFactory: BabylonHexMeshFactory;
    private tileMeshes: Map<string, TransformNode> = new Map();
    private unitMeshes: Map<string, TransformNode> = new Map();
    private hasInitialCameraPosition: boolean = false;

    constructor(private canvas: HTMLCanvasElement) {
        this.hexSize = 1; // Babylon uses different scale
        this.hexGrid = new BabylonHexGrid(this.hexSize);

        // Create engine and scene
        this.engine = new Engine(canvas, true);
        this.scene = new Scene(this.engine);

        // Update camera initialization
        this.camera = new ArcRotateCamera(
            "camera",
            Math.PI / 4, // alpha - initial rotation
            Math.PI / 3, // beta - initial tilt
            20,         // radius - will be adjusted based on map size
            Vector3.Zero(),
            this.scene
        );

        // Disable default keyboard rotation controls
        this.camera.keysUp = [];
        this.camera.keysDown = [];
        this.camera.keysLeft = [];
        this.camera.keysRight = [];

        // Add custom keyboard controls for panning
        this.scene.onKeyboardObservable.add((kbInfo) => {
            const panSpeed = 2.0;
            const up = Vector3.Cross(this.camera.getDirection(Vector3.Right()), Vector3.Up()).scaleInPlace(this.camera.radius / 10);
            const right = this.camera.getDirection(Vector3.Right()).scaleInPlace(this.camera.radius / 10);

            switch (kbInfo.type) {
                case 1: // KeyboardEventTypes.KEYDOWN
                    switch (kbInfo.event.key) {
                        case "ArrowUp":
                            this.camera.target.addInPlace(up.scale(panSpeed));
                            break;
                        case "ArrowDown":
                            this.camera.target.addInPlace(up.scale(-panSpeed));
                            break;
                        case "ArrowLeft":
                            this.camera.target.addInPlace(right.scale(-panSpeed));
                            break;
                        case "ArrowRight":
                            this.camera.target.addInPlace(right.scale(panSpeed));
                            break;
                    }
                    break;
            }
        });

        this.camera.attachControl(canvas, true);

        // Set camera limits
        this.camera.lowerRadiusLimit = 5;
        this.camera.upperRadiusLimit = 100;
        this.camera.lowerBetaLimit = 0.1;
        this.camera.upperBetaLimit = Math.PI / 2;

        // Add lighting
        const light = new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);

        // Create view manager
        this.view = new BabylonView(
            canvas.width,
            canvas.height,
            this.hexSize
        );

        // Start render loop
        this.engine.runRenderLoop(() => {
            this.scene.render();
        });

        this.hexMeshFactory = new BabylonHexMeshFactory(this.scene, this.hexSize);
    }

    init(data: {
        playerId: string;
        gameActions: GameActions;
        gameEvents: GameEventEmitter;
        onReady: () => void;
    }) {
        this.playerId = data.playerId;
        this.gameActions = data.gameActions;
        this.gameEvents = data.gameEvents;
        this.hasInitialCameraPosition = false;

        // Create UI Panel
        this.uiPanel = new BabylonUIPanel(this.scene);
        this.uiPanel.setCallbacks({
            onEndTurn: () => {
                this.gameActions!.endTurn();
            },
        });

        // Subscribe to game state updates
        this.boundHandleGameState = this.handleGameState.bind(this);
        this.gameEvents.on('updateGameState', this.boundHandleGameState);

        // Setup input handling
        this.setupInputHandling();

        // Load assets and then call onReady
        this.loadAssets().then(() => {
            data.onReady();
        });
    }

    private async loadAssets(): Promise<void> {
        // Load any necessary assets here
        return Promise.resolve();
    }

    shutdown() {
        if (this.gameEvents && this.boundHandleGameState) {
            this.gameEvents.off('updateGameState', this.boundHandleGameState);
        }

        // Properly dispose of all cached meshes
        this.tileMeshes.forEach(mesh => mesh.dispose());
        this.unitMeshes.forEach(mesh => mesh.dispose());
        this.tileMeshes.clear();
        this.unitMeshes.clear();

        this.engine.dispose();
        this.hasInitialCameraPosition = false;
    }

    public renderMap(tiles: { type: TileType; position: Position }[], units: Unit[] = []): void {
        // Track which meshes are still in use
        const usedTileMeshes = new Set<string>();
        const usedUnitMeshes = new Set<string>();

        // Update tiles
        tiles.forEach(tile => {
            const tileKey = `tile_${tile.position.x}_${tile.position.y}`;
            let hexContainer = this.tileMeshes.get(tileKey);
            const worldPos = this.view.hexToWorld(tile.position);

            if (!hexContainer) {
                // Create new mesh only if it doesn't exist
                hexContainer = this.hexMeshFactory.createHexMesh(tile.type, tile.position);
                this.tileMeshes.set(tileKey, hexContainer);
            }

            // Update position
            hexContainer.position = new Vector3(worldPos.x, 0, worldPos.y);
            hexContainer.setEnabled(true);
            usedTileMeshes.add(tileKey);
        });

        // Update units
        units.forEach(unit => {
            const unitKey = `unit_${unit.id}`;
            let unitMesh = this.unitMeshes.get(unitKey);
            const worldPos = this.view.hexToWorld(unit.position);

            if (!unitMesh) {
                // Create new mesh only if it doesn't exist
                unitMesh = this.hexMeshFactory.createUnitMesh(unit, this.playerId);
                this.unitMeshes.set(unitKey, unitMesh);
            }

            // Update position - ensure unit is positioned correctly
            unitMesh.position = new Vector3(worldPos.x, 0, worldPos.y); // Changed from 0.5 to 0 for base height

            // Reset rotation and scaling to defaults (in case they were changed)
            unitMesh.rotation = Vector3.Zero();
            unitMesh.scaling = Vector3.One();

            unitMesh.setEnabled(true);
            usedUnitMeshes.add(unitKey);
        });

        // Hide unused meshes
        this.tileMeshes.forEach((mesh, key) => {
            if (!usedTileMeshes.has(key)) {
                mesh.setEnabled(false);
            }
        });

        this.unitMeshes.forEach((mesh, key) => {
            if (!usedUnitMeshes.has(key)) {
                mesh.setEnabled(false);
            }
        });

        // After rendering all tiles and units, center the camera if this is the first render
        if (!this.hasInitialCameraPosition) {
            this.centerCameraOnVisibleTiles(tiles);
            this.hasInitialCameraPosition = true;
        }
    }

    private setupInputHandling() {
        this.scene.onPointerDown = (evt) => {
            const pickResult = this.scene.pick(
                this.scene.pointerX,
                this.scene.pointerY
            );
            if (pickResult.hit) {
                // Convert 3D position to hex coordinates using view
                const hexPos = this.view.worldToHex(
                    pickResult.pickedPoint!.x,
                    pickResult.pickedPoint!.z  // Use z for y in 2D coordinates
                );
                this.handleHexClick(hexPos);
            }
        };
    }

    private handleHexClick(hexPos: Position) {
        if (!this.currentGameState) return;

        const clickedUnit = this.getVisibleUnits().find(u =>
            u.position.x === hexPos.x && u.position.y === hexPos.y
        );
        console.info('Clicked unit', clickedUnit);

        if (clickedUnit) {
            if (clickedUnit.playerId === this.playerId) {
                // Select own unit
                this.selectedUnit = clickedUnit;
                this.highlightSelectedUnit(clickedUnit);
                if (clickedUnit.movementPoints > 0) {
                    this.showAuxInfo(clickedUnit);
                }
            } else if (this.selectedUnit && this.selectedUnit.movementPoints > 0) {
                // Check if target is within attack range
                const distance = getHexDistance(this.selectedUnit.position, clickedUnit.position);
                const canAttack = this.canAttackTarget(this.selectedUnit, clickedUnit, distance);

                if (canAttack) {
                    this.gameActions!.attackUnit(this.selectedUnit.id, clickedUnit.id);
                }
            }
        } else if (this.selectedUnit && this.selectedUnit.movementPoints > 0) {
            // Try to move the selected unit
            const mapData = this.currentGameState.visibleTiles.reduce((acc: TileType[][], tile) => {
                if (!acc[tile.position.y]) acc[tile.position.y] = [];
                acc[tile.position.y][tile.position.x] = tile.type;
                return acc;
            }, []);

            const movementHexes = this.hexGrid.getReachableAndVisibleHexes(
                this.selectedUnit.position,
                this.selectedUnit.movementPoints,
                { width: this.currentGameState.mapSize, height: this.currentGameState.mapSize },
                mapData
            );

            const canMoveTo = movementHexes.some(hex =>
                hex.x === hexPos.x && hex.y === hexPos.y
            );

            if (canMoveTo) {
                this.gameActions!.moveUnit(this.selectedUnit.id, hexPos);
            }
        }
    }

    private handleGameState(state: GameState) {
        this.currentGameState = state;
        
        // Update unit health bars
        state.visibleUnits.forEach(unit => {
            const unitMesh = this.unitMeshes.get(`unit_${unit.id}`);
            if (unitMesh) {
                this.hexMeshFactory.updateUnitHealth(unitMesh, unit.currentHp, unit.maxHp);
            }
        });

        this.renderMap(state.visibleTiles, state.visibleUnits);

        // Update highlight position if there's a selected unit
        if (this.selectedUnit) {
            const updatedUnit = state.visibleUnits.find(u => u.id === this.selectedUnit!.id);
            if (updatedUnit) {
                this.selectedUnit = updatedUnit; // Update the selected unit reference
                this.highlightSelectedUnit(updatedUnit);

                // Recalculate movement range after unit has moved
                if (updatedUnit.movementPoints > 0) {
                    this.showMovementRange(updatedUnit);
                } else {
                    this.clearHighlights(); // Clear highlights if no movement points left
                }
            } else {
                // Unit is no longer visible or was removed
                this.clearSelection();
            }
        }

        this.uiPanel!.updateTurnInfo(state.currentPlayerId, state.playerId, state.turnNumber);
        this.uiPanel!.updatePlayerList(state);
    }

    private getVisibleUnits(): Unit[] {
        return this.currentGameState?.visibleUnits || [];
    }

    private showMovementRange(unit: Unit) {
        console.info('Showing movement range for unit', unit);
        if (!this.currentGameState) return;

        this.clearHighlights();

        // Only show movement range if unit has movement points
        if (unit.movementPoints <= 0) {
            return;
        }

        const mapData = this.currentGameState.visibleTiles.reduce((acc: TileType[][], tile) => {
            if (!acc[tile.position.y]) acc[tile.position.y] = [];
            acc[tile.position.y][tile.position.x] = tile.type;
            return acc;
        }, []);

        const movementHexes = this.hexGrid.getReachableAndVisibleHexes(
            unit.position,
            unit.movementPoints,
            { width: this.currentGameState.mapSize, height: this.currentGameState.mapSize },
            mapData
        );
        console.info('Showing movementHexes', movementHexes);

        const highlightHexes = movementHexes.filter(hex =>
            !(hex.x === unit.position.x && hex.y === unit.position.y)
        );

        highlightHexes.forEach(hexPos => {
            const worldPos = this.view.hexToWorld(hexPos);
            const highlight = this.createHexHighlight(worldPos);
            this.highlightedHexes.push(highlight);
        });
    }

    private createHexHighlight(worldPos: Vector2): TransformNode {
        const material = new StandardMaterial("highlightMat", this.scene);
        material.diffuseColor = new Color3(1, 1, 0);
        material.alpha = 0.3;

        const highlight = MeshBuilder.CreateCylinder("highlight", {
            height: 0.1,
            diameter: this.hexSize * 2,
            tessellation: 6
        }, this.scene);

        highlight.material = material;
        highlight.position = new Vector3(worldPos.x, 0.1, worldPos.y);

        return highlight;
    }

    private clearHighlights(): void {
        this.highlightedHexes.forEach(hex => hex.dispose());
        this.highlightedHexes = [];
    }

    private clearSelection(): void {
        this.selectedUnit = null;
        this.clearHighlights();
        if (this.selectedUnitMesh) {
            this.selectedUnitMesh.setEnabled(false); // Hide instead of dispose
        }
        this.uiPanel!.updateUnitInfo(null);
    }

    private highlightSelectedUnit(unit: Unit): void {
        const worldPos = this.view.hexToWorld(unit.position);
        const targetPosition = new Vector3(worldPos.x, 0, worldPos.y);

        // Center camera on unit position
        this.centerCameraOnPosition(targetPosition);

        // Create highlight mesh if it doesn't exist
        if (!this.selectedUnitMesh) {
            this.createSelectionHighlight();
        }

        // Update highlight position and ensure it's visible
        this.selectedUnitMesh!.position = new Vector3(worldPos.x, 0.05, worldPos.y);
        this.selectedUnitMesh!.setEnabled(true);

        // Update UI
        this.uiPanel!.updateUnitInfo(unit);
    }

    // Separate method to create the highlight mesh
    private createSelectionHighlight(): void {
        // Create highlight material
        const highlightMaterial = new StandardMaterial("selectedUnitMat", this.scene);
        highlightMaterial.diffuseColor = new Color3(1, 1, 0);
        highlightMaterial.alpha = 0.5;
        highlightMaterial.emissiveColor = new Color3(0.5, 0.5, 0);

        // Create highlight mesh
        this.selectedUnitMesh = MeshBuilder.CreateCylinder("selectedUnit", {
            height: 0.15,
            diameter: this.hexSize * 1.5,
            tessellation: 6
        }, this.scene);

        this.selectedUnitMesh.material = highlightMaterial;
    }

    private centerCameraOnPosition(position: Vector3, duration: number = 2000): void {
        // Get current camera target and screen dimensions
        const startTarget = this.camera.target.clone();
        const screenWidth = this.engine.getRenderWidth();
        const screenHeight = this.engine.getRenderHeight();

        // Create viewport for projection
        const viewport = new Viewport(0, 0, screenWidth, screenHeight);

        // Convert world position to screen coordinates
        const screenPos = Vector3.Project(
            position,
            Matrix.Identity(),
            this.scene.getTransformMatrix(),
            viewport
        );

        // Calculate how far off center the target is as a percentage
        const centerOffsetX = Math.abs((screenPos.x - screenWidth / 2) / screenWidth);
        const centerOffsetY = Math.abs((screenPos.y - screenHeight / 2) / screenHeight);

        // Only move camera if target is beyond 25% of screen size from center
        if (centerOffsetX > 0.25 || centerOffsetY > 0.25) {
            const endTarget = position;
            let startTime: number | null = null;

            const animate = (currentTime: number) => {
                if (!startTime) startTime = currentTime;
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Using a smoother easing function
                const easeProgress = progress < 0.5
                    ? 4 * progress * progress * progress
                    : 1 - Math.pow(-2 * progress + 2, 3) / 2;

                // Interpolate position
                const newX = startTarget.x + (endTarget.x - startTarget.x) * easeProgress;
                const newY = startTarget.y + (endTarget.y - startTarget.y) * easeProgress;
                const newZ = startTarget.z + (endTarget.z - startTarget.z) * easeProgress;

                this.camera.target = new Vector3(newX, newY, newZ);

                if (progress < 1) {
                    requestAnimationFrame(animate);
                }
            };

            requestAnimationFrame(animate);
        }
    }

    private centerCameraOnVisibleTiles(tiles: { position: Position }[]): void {
        if (tiles.length === 0) return;

        // Calculate bounds of visible tiles
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        tiles.forEach(tile => {
            const worldPos = this.view.hexToWorld(tile.position);
            minX = Math.min(minX, worldPos.x);
            maxX = Math.max(maxX, worldPos.x);
            minY = Math.min(minY, worldPos.y);
            maxY = Math.max(maxY, worldPos.y);
        });

        // Calculate center point
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // Calculate required camera distance based on map size
        const mapWidth = maxX - minX;
        const mapHeight = maxY - minY;
        const requiredDistance = Math.max(mapWidth, mapHeight) * 1.2; // 1.2 for some padding

        // Update camera position
        this.camera.target = new Vector3(centerX, 0, centerY);
        this.camera.radius = requiredDistance;
        this.camera.alpha = Math.PI / 4; // 45 degrees
        this.camera.beta = Math.PI / 3;  // 60 degrees
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
        if (!this.currentGameState || unit.movementPoints === 0) return;

        // Get all enemy units
        const enemyUnits = this.currentGameState.visibleUnits.filter(u =>
            u.playerId !== unit.playerId
        );

        // Check each enemy unit if it's in attack range
        enemyUnits.forEach(enemyUnit => {
            const distance = getHexDistance(unit.position, enemyUnit.position);
            if (this.canAttackTarget(unit, enemyUnit, distance)) {
                const worldPos = this.view.hexToWorld(enemyUnit.position);
                const highlight = this.createAttackHighlight(worldPos);
                this.highlightedHexes.push(highlight);
            }
        });
    }

    private createAttackHighlight(worldPos: Vector2): TransformNode {
        const material = new StandardMaterial("attackHighlightMat", this.scene);
        material.diffuseColor = new Color3(1, 0, 0); // Red color
        material.alpha = 0.3;
        material.emissiveColor = new Color3(0.5, 0, 0); // Red glow

        const highlight = MeshBuilder.CreateCylinder("attackHighlight", {
            height: 0.1,
            diameter: this.hexSize * 2,
            tessellation: 6
        }, this.scene);

        highlight.material = material;
        highlight.position = new Vector3(worldPos.x, 0.1, worldPos.y);

        return highlight;
    }

    private showAuxInfo(unit: Unit): void {
        this.clearHighlights();
        this.showMovementRange(unit);
        this.showAttackRange(unit);
    }
}