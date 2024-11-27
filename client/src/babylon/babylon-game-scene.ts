import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, Material, MeshBuilder, StandardMaterial, Color3, TransformNode, Vector2, DynamicTexture, Mesh } from '@babylonjs/core';
import { TileType, Position, GameState, UnitType, Unit } from '@shared/types';
import { BabylonHexGrid } from './babylon-hex-grid';
import { BabylonUIPanel } from './babylon-ui-panel';
import { GameEventEmitter } from '../events';
import { GameActions } from 'src/engine-setup';
import { BabylonView } from './babylon-view';

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

    constructor(private canvas: HTMLCanvasElement) {
        this.hexSize = 1; // Babylon uses different scale
        this.hexGrid = new BabylonHexGrid(this.hexSize);
        
        // Create engine and scene
        this.engine = new Engine(canvas, true);
        this.scene = new Scene(this.engine);
        
        // Store camera reference
        this.camera = new ArcRotateCamera("camera", 0, Math.PI / 3, 20, Vector3.Zero(), this.scene);
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
    }

    init(data: { 
        playerId: string;
        gameActions: {
            moveUnit: (unitId: string, destination: Position) => void;
            fortifyUnit: (unitId: string) => void;
            endTurn: () => void;
        };
        gameEvents: GameEventEmitter;
        onReady: () => void;
    }) {
        this.playerId = data.playerId;
        this.gameActions = data.gameActions;
        this.gameEvents = data.gameEvents;
        
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
        this.engine.dispose();
    }

    private createHexMesh(type: TileType, position: Position): TransformNode {
        const container = new TransformNode("hexContainer", this.scene);
        
        // Create hex mesh
        const hexMaterial = new StandardMaterial("hexMat", this.scene);
        
        // Set material color based on tile type
        switch (type) {
            case TileType.GRASS:
                hexMaterial.diffuseColor = new Color3(0.4, 0.8, 0.4);
                break;
            case TileType.FOREST:
                hexMaterial.diffuseColor = new Color3(0.2, 0.6, 0.2);
                break;
            case TileType.HILLS:
                hexMaterial.diffuseColor = new Color3(0.6, 0.4, 0.2);
                break;
            case TileType.WATER:
                hexMaterial.diffuseColor = new Color3(0.2, 0.4, 0.8);
                break;
        }

        const hex = MeshBuilder.CreateCylinder("hex", {
            height: 0.1,
            diameter: this.hexSize * 2,
            tessellation: 6
        }, this.scene);
        
        hex.material = hexMaterial;
        hex.parent = container;

        // Create text plane
        const textPlane = MeshBuilder.CreatePlane("textPlane", {
            width: 2,
            height: 1,
        }, this.scene);
        textPlane.parent = container;
        textPlane.position.y = 0.1;
        textPlane.rotation.x = Math.PI / 2;

        // Create texture with transparency
        const textTexture = new DynamicTexture(
            `textTexture_${position.x}_${position.y}`, 
            { width: 1024, height: 512 },
            this.scene,
            true
        );
        
        const textMaterial = new StandardMaterial(`textMaterial_${position.x}_${position.y}`, this.scene);
        textMaterial.diffuseTexture = textTexture;
        textMaterial.specularColor = new Color3(0, 0, 0);
        textMaterial.backFaceCulling = false;
        textMaterial.emissiveColor = new Color3(1, 1, 1);
        
        // Enable transparency
        textMaterial.useAlphaFromDiffuseTexture = true;
        textMaterial.diffuseTexture.hasAlpha = true;
        textMaterial.transparencyMode = Material.MATERIAL_ALPHABLEND;
        
        textPlane.material = textMaterial;

        // Draw text on transparent background
        const ctx = textTexture.getContext();
        ctx.clearRect(0, 0, 1024, 512); // Clear with transparency
        ctx.fillStyle = "black";
        ctx.font = "bold 240px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${position.x},${position.y}`, 512, 256);
        textTexture.update();

        // Adjust plane scaling
        textPlane.scaling.x = 1;
        textPlane.scaling.y = 1;

        // Use view to convert hex position to world position
        const worldPos = this.view.hexToWorld(position);
        container.position = new Vector3(worldPos.x, 0, worldPos.y);

        return container;
    }

    private createUnitMesh(unit: Unit): TransformNode {
        const unitMaterial = new StandardMaterial("unitMat", this.scene);
        unitMaterial.diffuseColor = unit.playerId === this.playerId ? 
            new Color3(0, 1, 0) : new Color3(1, 0, 0);

        const unitMesh = MeshBuilder.CreateBox("unit", {
            height: 0.5,
            width: 0.3,
            depth: 0.3
        }, this.scene);
        
        unitMesh.material = unitMaterial;
        
        return unitMesh;
    }

    public renderMap(tiles: { type: TileType; position: Position }[], units: Unit[] = []): void {
        // Clear existing meshes and TransformNodes
        this.scene.meshes.slice().forEach(mesh => {
            if (mesh.name !== "camera") {
                mesh.dispose();
            }
        });
        
        this.scene.transformNodes.slice().forEach(node => {
            node.dispose();
        });

        // Create tiles
        tiles.forEach(tile => {
            const hexContainer = this.createHexMesh(tile.type, tile.position);
            const worldPos = this.view.hexToWorld(tile.position);
            hexContainer.position = new Vector3(worldPos.x, 0, worldPos.y);
        });

        // Create units
        units.forEach(unit => {
            const unitMesh = this.createUnitMesh(unit);
            const worldPos = this.view.hexToWorld(unit.position);
            unitMesh.position = new Vector3(worldPos.x, 0.5, worldPos.y);
        });
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

        const clickedUnit = this.currentGameState.visibleUnits.find(unit => 
            unit.position.x === hexPos.x && unit.position.y === hexPos.y
        );

        if (clickedUnit) {
            if (clickedUnit.playerId === this.playerId) {
                if (this.selectedUnit?.id === clickedUnit.id) {
                    this.clearSelection();
                } else {
                    this.selectedUnit = clickedUnit;
                    this.highlightSelectedUnit(clickedUnit);
                    this.showMovementRange(clickedUnit);
                }
            }
        } else if (this.selectedUnit) {
            const mapData = this.currentGameState.visibleTiles.reduce((acc: TileType[][], tile) => {
                if (!acc[tile.position.y]) acc[tile.position.y] = [];
                acc[tile.position.y][tile.position.x] = tile.type;
                return acc;
            }, []);

            const movementHexes = this.hexGrid.getHexesInRange(
                this.selectedUnit.position,
                this.selectedUnit.movementPoints,
                this.currentGameState.mapSize,
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
        
        const mapData = this.currentGameState.visibleTiles.reduce((acc: TileType[][], tile) => {
            if (!acc[tile.position.y]) acc[tile.position.y] = [];
            acc[tile.position.y][tile.position.x] = tile.type;
            return acc;
        }, []);

        const movementHexes = this.hexGrid.getHexesInRange(
            unit.position,
            unit.movementPoints,
            this.currentGameState.mapSize,
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
            this.selectedUnitMesh.dispose();
            this.selectedUnitMesh = null;
        }
        this.uiPanel.updateUnitInfo(null);
    }

    private highlightSelectedUnit(unit: Unit): void {
        // Clear any existing selection highlight
        if (this.selectedUnitMesh) {
            this.selectedUnitMesh.dispose();
        }

        const worldPos = this.view.hexToWorld(unit.position);
        
        // Center camera on unit position
        const targetPosition = new Vector3(worldPos.x, 0, worldPos.y);
        this.centerCameraOnPosition(targetPosition);

        // Create highlight mesh (existing code)
        const highlightMaterial = new StandardMaterial("selectedUnitMat", this.scene);
        highlightMaterial.diffuseColor = new Color3(1, 1, 0);
        highlightMaterial.alpha = 0.5;
        highlightMaterial.emissiveColor = new Color3(0.5, 0.5, 0);

        this.selectedUnitMesh = MeshBuilder.CreateCylinder("selectedUnit", {
            height: 0.15,
            diameter: this.hexSize * 1.5,
            tessellation: 6
        }, this.scene);

        this.selectedUnitMesh.material = highlightMaterial;
        this.selectedUnitMesh.position = new Vector3(worldPos.x, 0.05, worldPos.y);

        this.uiPanel.updateUnitInfo(unit);
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
} 