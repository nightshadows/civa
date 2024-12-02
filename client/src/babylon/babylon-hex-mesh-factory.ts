import { Scene, StandardMaterial, Color3, MeshBuilder, TransformNode, Vector3, Material, DynamicTexture, FresnelParameters, Animation, Mesh } from '@babylonjs/core';
import { TileType, Position, Unit, UnitType } from '@shared/types';

export class BabylonHexMeshFactory {
    constructor(
        private scene: Scene,
        private hexSize: number
    ) {}

    createHexMesh(type: TileType, position: Position): TransformNode {
        const container = new TransformNode("hexContainer", this.scene);

        switch (type) {
            case TileType.HILLS:
                this.createHillsHex(container);
                break;
            case TileType.WATER:
                this.createWaterHex(container);
                break;
            case TileType.GRASS:
                this.createGrassHex(container);
                break;
            case TileType.FOREST:
                this.createForestHex(container);
                break;
        }

        this.addCoordinateText(container, position);
        return container;
    }

    private createHillsHex(container: TransformNode): void {
        // Base hill material
        const hillMaterial = new StandardMaterial("hillMat", this.scene);
        hillMaterial.diffuseColor = new Color3(0.6, 0.4, 0.2);
        hillMaterial.specularColor = new Color3(0.2, 0.2, 0.2);

        // Base hex
        const baseHex = MeshBuilder.CreateCylinder("baseHex", {
            height: 0.1,
            diameter: this.hexSize * 2,
            tessellation: 6
        }, this.scene);
        baseHex.material = hillMaterial;
        baseHex.parent = container;

        // Create multiple elevation layers for hills
        const elevations = [
            { scale: 0.8, height: 0.2, y: 0.15 },
            { scale: 0.6, height: 0.15, y: 0.325 },
            { scale: 0.4, height: 0.1, y: 0.45 }
        ];

        elevations.forEach(({ scale, height, y }) => {
            const hillLayer = MeshBuilder.CreateCylinder("hillLayer", {
                height: height,
                diameter: this.hexSize * 2 * scale,
                tessellation: 6
            }, this.scene);

            hillLayer.material = hillMaterial;
            hillLayer.parent = container;
            hillLayer.position.y = y;
        });

        // Add random rocks for detail
        const rockMaterial = new StandardMaterial("rockMat", this.scene);
        rockMaterial.diffuseColor = new Color3(0.4, 0.3, 0.2);

        for (let i = 0; i < 5; i++) {
            const angle = (Math.random() * Math.PI * 2);
            const radius = (Math.random() * 0.5 + 0.2) * this.hexSize;
            const scale = Math.random() * 0.2 + 0.1;

            const rock = MeshBuilder.CreatePolyhedron("rock", {
                type: 1, // icosahedron
                size: scale
            }, this.scene);

            rock.material = rockMaterial;
            rock.parent = container;
            rock.position = new Vector3(
                Math.cos(angle) * radius,
                0.3 + Math.random() * 0.2,
                Math.sin(angle) * radius
            );
            rock.rotation = new Vector3(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            rock.scaling = new Vector3(
                1 + Math.random() * 0.4,
                1 + Math.random() * 0.4,
                1 + Math.random() * 0.4
            );
        }
    }

    private createWaterHex(container: TransformNode): void {
        const hexMaterial = new StandardMaterial("waterMat", this.scene);

        // Water-specific material properties
        hexMaterial.diffuseColor = new Color3(0.2, 0.4, 0.8);
        hexMaterial.specularColor = new Color3(0.2, 0.2, 0.4);
        hexMaterial.specularPower = 32;
        hexMaterial.alpha = 0.8;

        // Add fresnel effect for water shine
        // @ts-ignore ts mismatch
        hexMaterial.useFresnelEffect = true;
        hexMaterial.reflectionFresnelParameters = new FresnelParameters();
        hexMaterial.reflectionFresnelParameters.bias = 0.1;
        hexMaterial.reflectionFresnelParameters.power = 2;
        hexMaterial.reflectionFresnelParameters.leftColor = Color3.White();
        hexMaterial.reflectionFresnelParameters.rightColor = Color3.Black();

        // Add water waves animation
        const waterAnimation = new Animation(
            "waterAnimation",
            "position.y",
            30,
            Animation.ANIMATIONTYPE_FLOAT,
            Animation.ANIMATIONLOOPMODE_CYCLE
        );

        const keys = [];
        keys.push({ frame: 0, value: 0 });
        keys.push({ frame: 15, value: 0.05 });
        keys.push({ frame: 30, value: 0 });
        waterAnimation.setKeys(keys);

        const hex = MeshBuilder.CreateCylinder("hex", {
            height: 0.1,
            diameter: this.hexSize * 2,
            tessellation: 6
        }, this.scene);

        hex.material = hexMaterial;
        hex.parent = container;
        hex.animations.push(waterAnimation);
        this.scene.beginAnimation(hex, 0, 30, true);
    }

    private createGrassHex(container: TransformNode): void {
        // Base grass material
        const grassMaterial = new StandardMaterial("grassMat", this.scene);
        grassMaterial.diffuseColor = new Color3(0.4, 0.8, 0.4);
        grassMaterial.specularColor = new Color3(0.1, 0.1, 0.1);

        // Base hex
        const baseHex = MeshBuilder.CreateCylinder("baseHex", {
            height: 0.1,
            diameter: this.hexSize * 2,
            tessellation: 6
        }, this.scene);
        baseHex.material = grassMaterial;
        baseHex.parent = container;

        // Add grass blades
        const bladeMaterial = new StandardMaterial("bladeMat", this.scene);
        bladeMaterial.diffuseColor = new Color3(0.3, 0.7, 0.3);

        for (let i = 0; i < 30; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 0.8 * this.hexSize;
            const height = Math.random() * 0.2 + 0.1;
            const tilt = Math.random() * Math.PI / 6;

            const blade = MeshBuilder.CreateBox("blade", {
                height: height,
                width: 0.02,
                depth: 0.02
            }, this.scene);

            blade.material = bladeMaterial;
            blade.parent = container;
            blade.position = new Vector3(
                Math.cos(angle) * radius,
                height / 2,
                Math.sin(angle) * radius
            );
            blade.rotation = new Vector3(
                tilt * Math.cos(angle),
                Math.random() * Math.PI,
                tilt * Math.sin(angle)
            );
        }
    }

    private createForestHex(container: TransformNode): void {
        // Base forest material
        const groundMaterial = new StandardMaterial("groundMat", this.scene);
        groundMaterial.diffuseColor = new Color3(0.3, 0.5, 0.3);

        // Base hex
        const baseHex = MeshBuilder.CreateCylinder("baseHex", {
            height: 0.1,
            diameter: this.hexSize * 2,
            tessellation: 6
        }, this.scene);
        baseHex.material = groundMaterial;
        baseHex.parent = container;

        // Create trees
        const trunkMaterial = new StandardMaterial("trunkMat", this.scene);
        trunkMaterial.diffuseColor = new Color3(0.4, 0.3, 0.2);

        const leafMaterial = new StandardMaterial("leafMat", this.scene);
        leafMaterial.diffuseColor = new Color3(0.2, 0.5, 0.2);

        // Add multiple trees
        for (let i = 0; i < 5; i++) {
            const treeContainer = new TransformNode("tree", this.scene);
            treeContainer.parent = container;

            // Random position within hex
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 0.6 * this.hexSize;
            treeContainer.position = new Vector3(
                Math.cos(angle) * radius,
                0,
                Math.sin(angle) * radius
            );

            // Tree trunk
            const trunk = MeshBuilder.CreateCylinder("trunk", {
                height: 0.6,
                diameter: 0.1,
                tessellation: 8
            }, this.scene);
            trunk.material = trunkMaterial;
            trunk.parent = treeContainer;
            trunk.position.y = 0.3;

            // Tree leaves (multiple layers for fuller look)
            const leafLayers = [
                { y: 0.4, scale: 1.0 },
                { y: 0.5, scale: 0.8 },
                { y: 0.6, scale: 0.6 }
            ];

            leafLayers.forEach(({ y, scale }) => {
                const leaves = MeshBuilder.CreateCylinder("leaves", {
                    height: 0.2,
                    diameter: 0.4,
                    tessellation: 6
                }, this.scene);
                leaves.material = leafMaterial;
                leaves.parent = treeContainer;
                leaves.position.y = y;
                leaves.scaling.x = scale;
                leaves.scaling.z = scale;
            });

            // Random rotation for variety
            treeContainer.rotation.y = Math.random() * Math.PI * 2;
            treeContainer.scaling = new Vector3(
                0.8 + Math.random() * 0.4,
                0.8 + Math.random() * 0.4,
                0.8 + Math.random() * 0.4
            );
        }
    }

    private addCoordinateText(container: TransformNode, position: Position): void {
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
        const ctx = textTexture.getContext() as CanvasRenderingContext2D;
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
    }

    public createUnitMesh(unit: Unit, playerId?: string): TransformNode {
        const container = new TransformNode("unitContainer", this.scene);
        
        // Add glowing border
        const borderMaterial = new StandardMaterial("borderMat", this.scene);
        borderMaterial.emissiveColor = unit.playerId === playerId ? 
            new Color3(0.2, 1, 0.2) :  // Green glow for friendly
            new Color3(1, 0.2, 0.2);   // Red glow for enemy
        borderMaterial.alpha = 0.6;

        const border = MeshBuilder.CreateCylinder("border", {
            height: 0.15,
            diameter: this.hexSize * 2.1, // Slightly larger than hex
            tessellation: 6
        }, this.scene);
        border.material = borderMaterial;
        border.parent = container;
        border.position.y = 0.05;

        const isPlayerUnit = unit.playerId === playerId;

        // Common materials
        const metalMaterial = new StandardMaterial("metalMat", this.scene);
        metalMaterial.diffuseColor = new Color3(0.7, 0.7, 0.8);
        metalMaterial.specularColor = new Color3(0.8, 0.8, 0.8);
        metalMaterial.specularPower = 32;

        const leatherMaterial = new StandardMaterial("leatherMat", this.scene);
        leatherMaterial.diffuseColor = new Color3(0.4, 0.3, 0.2);

        const teamMaterial = new StandardMaterial("teamMat", this.scene);
        teamMaterial.diffuseColor = isPlayerUnit ?
            new Color3(0.2, 0.5, 0.2) : // Green for player
            new Color3(0.7, 0.2, 0.2);  // Red for enemy

        if (unit.type === UnitType.WARRIOR) {
            // Body
            const body = MeshBuilder.CreateCylinder("body", {
                height: 0.6,
                diameter: 0.3,
                tessellation: 8
            }, this.scene);
            body.material = teamMaterial;
            body.parent = container;
            body.position.y = 0.3;

            // Helmet (Spartan style)
            const helmet = MeshBuilder.CreateCylinder("helmet", {
                height: 0.25,
                diameterTop: 0.2,
                diameterBottom: 0.25,
                tessellation: 8
            }, this.scene);
            helmet.material = metalMaterial;
            helmet.parent = container;
            helmet.position.y = 0.7;

            // Helmet crest
            const crest = MeshBuilder.CreateBox("crest", {
                height: 0.05,
                width: 0.3,
                depth: 0.1
            }, this.scene);
            crest.material = teamMaterial;
            crest.parent = container;
            crest.position.y = 0.85;

            // Shield
            const shield = MeshBuilder.CreateCylinder("shield", {
                height: 0.05,
                diameter: 0.4,
                tessellation: 12
            }, this.scene);
            shield.material = metalMaterial;
            shield.parent = container;
            shield.position.y = 0.3;
            shield.position.x = -0.2;
            shield.rotation.z = Math.PI / 2;

            // Sword
            const sword = MeshBuilder.CreateBox("sword", {
                height: 0.5,
                width: 0.08,
                depth: 0.02
            }, this.scene);
            sword.material = metalMaterial;
            sword.parent = container;
            sword.position.y = 0.3;
            sword.position.x = 0.25;
            sword.rotation.z = -Math.PI / 6;

            // Sword handle
            const handle = MeshBuilder.CreateBox("handle", {
                height: 0.15,
                width: 0.02,
                depth: 0.02
            }, this.scene);
            handle.material = leatherMaterial;
            handle.parent = sword;
            handle.position.y = -0.3;

        } else if (unit.type === UnitType.ARCHER) {
            // Body
            const body = MeshBuilder.CreateCylinder("body", {
                height: 0.6,
                diameter: 0.25,
                tessellation: 8
            }, this.scene);
            body.material = teamMaterial;
            body.parent = container;
            body.position.y = 0.3;

            // Hood
            const hood = MeshBuilder.CreateSphere("hood", {
                diameter: 0.25,
                segments: 8
            }, this.scene);
            hood.material = leatherMaterial;
            hood.parent = container;
            hood.position.y = 0.65;
            hood.scaling.y = 0.8;

            // Bow
            const bowCurve = MeshBuilder.CreateTorus("bow", {
                diameter: 0.5,
                thickness: 0.02,
                tessellation: 16,
                // @ts-ignore ts mismatch
                arc: 0.7
            }, this.scene);
            bowCurve.material = leatherMaterial;
            bowCurve.parent = container;
            bowCurve.position.y = 0.3;
            bowCurve.position.x = 0.25;
            bowCurve.rotation.y = Math.PI / 2;

            // Bowstring
            const bowstring = MeshBuilder.CreateCylinder("string", {
                height: 0.45,
                diameter: 0.01
            }, this.scene);
            bowstring.material = metalMaterial;
            bowstring.parent = container;
            bowstring.position.y = 0.3;
            bowstring.position.x = 0.25;

            // Quiver
            const quiver = MeshBuilder.CreateCylinder("quiver", {
                height: 0.4,
                diameter: 0.1,
                tessellation: 8
            }, this.scene);
            quiver.material = leatherMaterial;
            quiver.parent = container;
            quiver.position.y = 0.3;
            quiver.position.x = -0.15;
            quiver.rotation.z = Math.PI / 6;

            // Arrows in quiver
            for (let i = 0; i < 3; i++) {
                const arrow = MeshBuilder.CreateCylinder("arrow", {
                    height: 0.4,
                    diameter: 0.02
                }, this.scene);
                arrow.material = metalMaterial;
                arrow.parent = quiver;
                arrow.position.x = 0.02 * i;
                arrow.position.y = 0.1;
            }
        } else if (unit.type === UnitType.SETTLER) {
            // Body (peasant with simple clothes)
            const body = MeshBuilder.CreateCylinder("body", {
                height: 0.6,
                diameter: 0.3,
                tessellation: 8
            }, this.scene);
            body.material = teamMaterial;
            body.parent = container;
            body.position.y = 0.3;

            // Head with simple hat
            const head = MeshBuilder.CreateSphere("head", {
                diameter: 0.2,
                segments: 8
            }, this.scene);
            head.material = teamMaterial;
            head.parent = container;
            head.position.y = 0.7;
            head.scaling.y = 0.8; // Slightly squashed sphere

            // Simple hat
            const hat = MeshBuilder.CreateCylinder("hat", {
                height: 0.1,
                diameterTop: 0.1,
                diameterBottom: 0.2,
                tessellation: 8
            }, this.scene);
            hat.material = leatherMaterial;
            hat.parent = container;
            hat.position.y = 0.8;

            // Cart (main body)
            const cart = MeshBuilder.CreateBox("cart", {
                height: 0.25,
                width: 0.5,
                depth: 0.35
            }, this.scene);
            cart.material = leatherMaterial;
            cart.parent = container;
            cart.position.y = 0.2;
            cart.position.x = -0.3;

            // Cart wheels (2 on each side)
            [-0.15, 0.15].forEach(zOffset => {
                const wheel = MeshBuilder.CreateCylinder("wheel", {
                    height: 0.05,
                    diameter: 0.2,
                    tessellation: 12
                }, this.scene);
                wheel.material = metalMaterial;
                wheel.parent = cart;
                wheel.rotation.z = Math.PI / 2;
                wheel.position.z = zOffset;
                wheel.position.y = -0.1;
            });

            // Supplies in cart (simplified as boxes)
            const supplies = [
                { x: 0, y: 0.15, z: 0, w: 0.3, h: 0.1, d: 0.25 },  // Bottom layer
                { x: 0, y: 0.25, z: 0, w: 0.2, h: 0.1, d: 0.15 }   // Top layer
            ];

            supplies.forEach((supply, index) => {
                const box = MeshBuilder.CreateBox(`supply${index}`, {
                    height: supply.h,
                    width: supply.w,
                    depth: supply.d
                }, this.scene);
                box.material = leatherMaterial;
                box.parent = cart;
                box.position.set(supply.x, supply.y, supply.z);
            });

            // Tools (simplified as a shovel)
            const shovelHandle = MeshBuilder.CreateCylinder("shovelHandle", {
                height: 0.4,
                diameter: 0.03,
                tessellation: 6
            }, this.scene);
            shovelHandle.material = leatherMaterial;
            shovelHandle.parent = cart;
            shovelHandle.position.set(0.2, 0.2, 0);
            shovelHandle.rotation.z = Math.PI / 4;

            const shovelHead = MeshBuilder.CreateBox("shovelHead", {
                height: 0.15,
                width: 0.03,
                depth: 0.1
            }, this.scene);
            shovelHead.material = metalMaterial;
            shovelHead.parent = shovelHandle;
            shovelHead.position.y = 0.2;
            shovelHead.rotation.z = -Math.PI / 4;
        }

        // Create a separate container for the health bar that will always face camera
        const healthBarContainer = new TransformNode("healthBarContainer", this.scene);
        healthBarContainer.parent = container;
        healthBarContainer.position.y = 1.2;

        const healthBarWidth = 0.4;
        const healthBarHeight = 0.05;
        const healthPercent = unit.currentHp / unit.maxHp;

        // Background (red)
        const healthBg = MeshBuilder.CreatePlane("healthBg", {
            width: healthBarWidth,
            height: healthBarHeight
        }, this.scene);
        const bgMat = new StandardMaterial("healthBgMat", this.scene);
        bgMat.diffuseColor = new Color3(1, 0, 0);
        bgMat.backFaceCulling = false;
        healthBg.material = bgMat;
        healthBg.parent = healthBarContainer;

        // Fill (green)
        const healthFill = MeshBuilder.CreatePlane("healthFill", {
            width: healthBarWidth * healthPercent,
            height: healthBarHeight
        }, this.scene);
        const fillMat = new StandardMaterial("healthFillMat", this.scene);
        fillMat.diffuseColor = new Color3(0, 1, 0);
        fillMat.backFaceCulling = false;
        healthFill.material = fillMat;
        healthFill.parent = healthBarContainer;
        healthFill.position.z = 0.01; // Slightly in front

        // Make health bar always face camera
        this.scene.onBeforeRenderObservable.add(() => {
            if (healthBarContainer.isEnabled()) {
                const camera = this.scene.activeCamera!;
                if (camera) {
                    const pos = healthBarContainer.getAbsolutePosition();
                    const cameraPosition = camera.position;
                    
                    // Calculate direction to camera
                    const direction = cameraPosition.subtract(pos).normalize();
                    
                    // Calculate rotation to face camera
                    const alpha = Math.atan2(direction.x, direction.z);
                    healthBarContainer.rotation.y = alpha;
                }
            }
        });

        return container;
    }

    updateUnitHealth(unitNode: TransformNode, currentHp: number, maxHp: number): void {
        // Find the health bar container first
        const healthBarContainer = unitNode.getChildren().find(child => 
            child.name === "healthBarContainer"
        );

        if (healthBarContainer) {
            // Find the health fill plane within the container
            const healthFill = healthBarContainer.getChildren().find(child => 
                child.name === "healthFill"
            );

            if (healthFill && healthFill instanceof Mesh) {
                const healthPercent = currentHp / maxHp;
                healthFill.scaling.x = healthPercent;
                // Adjust position to keep the bar aligned to the left
                // healthFill.position.x = (0.4 * (healthPercent - 1)) / 2;
            }
        }
    }
}