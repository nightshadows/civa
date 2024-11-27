import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, Material, MeshBuilder, StandardMaterial, Color3, TransformNode, Vector2, DynamicTexture, Mesh, FresnelParameters, Animation } from '@babylonjs/core';
import { TileType, Position, GameState, UnitType, Unit } from '@shared/types';
import { BabylonHexGrid } from './babylon-hex-grid';
import { BabylonUIPanel } from './babylon-ui-panel';
import { GameActions, GameEventEmitter } from 'src/engine-setup';
import { BabylonView } from './babylon-view';
import { BabylonHexMeshFactory } from './babylon-hex-mesh-factory';

export class BabylonGameScene {
    private scene: Scene;
    private engine: Engine;
    private hexSize: number;
    private playerId?: string;
    private selectedUnit: Unit | null = null;
    private highlightedHexes: TransformNode[] = [];
    private hexGrid: BabylonHexGrid;
    private selectedUnitMesh: TransformNode | null = null;
    private uiPanel: BabylonUIPanel;
    private gameActions: GameActions;
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
        
        // Set camera limits
        this.camera.lowerRadiusLimit = 5;
        this.camera.upperRadiusLimit = 100;
        this.camera.lowerBetaLimit = 0.1;
        this.camera.upperBetaLimit = Math.PI / 2;
        
        this.camera.attachControl(canvas, true);

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
                this.gameActions.endTurn();
            },
            onFortifyUnit: () => {
                if (this.selectedUnit) {
                    this.gameActions.fortifyUnit(this.selectedUnit.id);
                }
            },
            onLevelUpUnit: () => {
                // Implement level up logic when needed
                console.log('Level up not implemented yet');
            }
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
        console.info('Hex clicked', hexPos);
        if (!this.currentGameState) return;

        const clickedUnit = this.getVisibleUnits().find(u =>
            u.position.x === hexPos.x && u.position.y === hexPos.y
        );

        if (clickedUnit) {
            if (clickedUnit.playerId === this.playerId) {
                // Select the clicked unit
                this.selectedUnit = clickedUnit;
                this.highlightSelectedUnit(clickedUnit);
                if (clickedUnit.movementPoints > 0) {
                    this.showMovementRange(clickedUnit);
                }
            }
        } else if (this.selectedUnit && this.selectedUnit.movementPoints > 0) {
            // Try to move the selected unit
            const mapData = this.currentGameState.visibleTiles.reduce((acc: TileType[][], tile) => {
                if (!acc[tile.position.y]) acc[tile.position.y] = [];
                acc[tile.position.y][tile.position.x] = tile.type;
                return acc;
            }, []);

            const movementHexes = this.hexGrid.getHexesInRange(
                this.selectedUnit.position,
                this.selectedUnit.movementPoints,
                { width: this.currentGameState.mapSize, height: this.currentGameState.mapSize },
                mapData
            );

            const canMoveTo = movementHexes.some(hex =>
                hex.x === hexPos.x && hex.y === hexPos.y
            );

            if (canMoveTo) {
                this.gameActions.moveUnit(this.selectedUnit.id, hexPos);
            }
        }
    }

    private handleGameState(state: GameState) {
        this.currentGameState = state;
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

        this.uiPanel.updateTurnInfo(state.currentPlayerId, state.playerId, state.turnNumber);
        this.uiPanel.updatePlayerList(state);
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

        const movementHexes = this.hexGrid.getHexesInRange(
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
        this.uiPanel.updateUnitInfo(null);
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
        this.uiPanel.updateUnitInfo(unit);
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

    private centerCameraOnPosition(position: Vector3, duration: number = 1000): void {
        // Get current camera target
        const startTarget = this.camera.target.clone();
        const endTarget = position;
        // Animation frame
        let startTime: number | null = null;

        const animate = (currentTime: number) => {
            if (!startTime) startTime = currentTime;
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Smooth easing
            const easeProgress = 1 - Math.pow(1 - progress, 3);

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
} 