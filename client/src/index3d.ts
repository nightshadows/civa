import * as BABYLON from '@babylonjs/core';
import "@babylonjs/loaders/glTF";
import * as GUI from '@babylonjs/gui';
var canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
let engine: BABYLON.Engine;
let scene: BABYLON.Scene;

let createDefaultEngine = function () {
    return new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, disableWebGL2Support: false });
};

async function startRenderLoop() {
    let scene = await createScene();
    engine.runRenderLoop(function () {
        if (scene && scene.activeCamera) {
            scene.render();
        }
    });
}

var initFunction = async function () {
    var asyncEngineCreation = async function () {
        try {
            return createDefaultEngine();
        } catch (e) {
            console.log("the available createEngine function failed. Creating the default engine instead");
            return createDefaultEngine();
        }
    }

    engine = await asyncEngineCreation();
    if (!engine) {
        throw 'engine should not be null.';
    }
    await startRenderLoop();
};

initFunction();
// .then(() => {
//     scene.then(returnedScene => { sceneToRender = returnedScene; });

// });

// Resize
window.addEventListener("resize", function () {
    engine.resize();
});

// var  = function() { return new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true,  disableWebGL2Support: false}); };

async function createScene() {

    // This creates a basic Babylon Scene object (non-mesh)
    var scene = new BABYLON.Scene(engine);

    var camera = new BABYLON.ArcRotateCamera("camera", BABYLON.Tools.ToRadians(90), BABYLON.Tools.ToRadians(45), 10, BABYLON.Vector3.Zero(), scene);

    camera.lowerRadiusLimit = 5;

    // This attaches the camera to the canvas
    camera.attachControl(canvas, true);

    // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
    var light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

    // Default intensity is 1. Let's dim the light a small amount
    light.intensity = 0.7;

    //load an asset container for the hex tile
    const hexTileImport = await BABYLON.SceneLoader.LoadAssetContainerAsync("https://assets.babylonjs.com/meshes/", "hexTile.glb", scene);

    //The math and properties for creating the hex grid.
    let gridSize = 2;
    let hexLength = 1;
    let hexWidthDistance = Math.sqrt(3) * hexLength;
    let hexHeightDistance = (2 * hexLength);
    let rowlengthAddition = 0;

    //Create and load a node material for the top water surface.    
    let waterMaterialTop: BABYLON.NodeMaterial;
    let waterMaterialBottom: BABYLON.NodeMaterial;

    BABYLON.NodeMaterial.ParseFromSnippetAsync("TD23TV#21", scene).then(nodeMaterial => {
        waterMaterialTop = nodeMaterial;
        waterMaterialTop.name = "waterMaterialTop"
        BABYLON.NodeMaterial.ParseFromSnippetAsync("BS6C1U#1", scene).then(nodeMaterial => {
            waterMaterialBottom = nodeMaterial;
            waterMaterialBottom.name = "waterMaterialBottom";

            createHexGrid(gridSize, hexWidthDistance, hexHeightDistance, rowlengthAddition, hexTileImport, waterMaterialTop, camera, scene);
        });
    });

    //Factor is the width and height of the texure you'd like to create, must be a factor of 2.
    let factor = 512;

    //Resolution is the number of actual grid points that you'll have. width x height. Then add 1 to make it an odd number of grid points.
    let resolution = (2 * factor) + 1;
    let multiplier = 1;

    //create a flat texture for non-island tiles
    let flatArray = new Uint8Array(factor * 4);;
    for (let i = 0; i < flatArray.length; i++) {
        flatArray[i] = 0;
    }
    let flatNoiseTexture = BABYLON.RawTexture.CreateRGBTexture(flatArray, factor * 2, factor * 2, scene, false, false, BABYLON.Texture.NEAREST_SAMPLINGMODE);
    flatNoiseTexture.name = "flatNoiseTexture";

    //handling of hex tile picking
    scene.onPointerDown = function (evt, pickResult) {
        if (pickResult.pickedMesh) {
            let animGroups = scene.animationGroups;
            for (let i = 0; i < animGroups.length; i++) {
                if (animGroups[i].targetedAnimations[0].target === pickResult.pickedMesh.parent) {
                    let siblingMeshes = pickResult.pickedMesh.parent?.getChildMeshes() || [];
                    for (let j = 0; j < siblingMeshes.length; j++) {
                        if (siblingMeshes[j].name === "bottom") {
                            siblingMeshes[j].material = waterMaterialBottom;
                        }
                    }

                    animGroups[i].play();
                }
            }

            let noiseTexture = flatNoiseTexture;

            //set all meshes in this hex tile to no longer be pickable
            let siblingMeshes = pickResult.pickedMesh.parent?.getChildMeshes() || [];
            for (let i = 0; i < siblingMeshes.length; i++) {
                siblingMeshes[i].isPickable = false;
            }

            //randomly determine if this hex tile has an island or not and process the island components
            if (Math.random() > 0.5) {
                let noiseArray = diamondSquare(resolution, multiplier);

                let scaledArray = scaleNoise(noiseArray);

                //This creates a texture, pixel by pixel using the influenced random values from the noiseArray.
                noiseTexture = BABYLON.RawTexture.CreateRGBTexture(scaledArray, factor * 2, factor * 2, scene, false, false, BABYLON.Texture.NEAREST_SAMPLINGMODE);
                noiseTexture.name = "noiseTexture";
            }
            BABYLON.NodeMaterial.ParseFromSnippetAsync(("UM4R4N#2"), scene).then(nodeMaterial => {
                nodeMaterial.name = "terrainMaterial" + pickResult.pickedMesh?.parent?.parent?.name.slice(7);
                for (let i = 0; i < siblingMeshes.length; i++) {
                    if (siblingMeshes[i].name === "terrain") {
                        siblingMeshes[i].visibility = 1;
                        siblingMeshes[i].material = nodeMaterial;
                        siblingMeshes[i].hasVertexAlpha = false;
                    }
                }
                let block = nodeMaterial.getBlockByPredicate((b) => b.name === "noiseTexture1") as BABYLON.TextureBlock;
                block.texture = noiseTexture;
                block = nodeMaterial.getBlockByPredicate((b) => b.name === "noiseTexture2") as BABYLON.TextureBlock;
                block.texture = noiseTexture;
                block.texture.wAng = BABYLON.Tools.ToRadians(Math.min(360, Math.max(0, (Math.random() * 360))));
                block.texture.uScale = 0.75;
                block.texture.vScale = 0.75;
            });
        }
    };

    // GUI
    var advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

    var panel = new GUI.StackPanel();
    panel.width = "300px";
    panel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    panel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    advancedTexture.addControl(panel);

    let guiButton = GUI.Button.CreateSimpleButton("guiButton", "Rebuild Hex Grid: Size 2");
    guiButton.width = "300px"
    guiButton.height = "40px";
    guiButton.color = "white";
    guiButton.cornerRadius = 10;
    guiButton.background = "blue";
    guiButton.onPointerUpObservable.add(function () {
        let sceneMeshes = scene.meshes.slice(0);
        for (let mesh of sceneMeshes) {
            mesh.dispose();
        }
        let sceneTextures = scene.textures.slice(0);
        for (let texture of sceneTextures) {
            if (texture.name === "noiseTexture") {
                texture.dispose();
            }
        }
        createHexGrid(gridSize, hexWidthDistance, hexHeightDistance, rowlengthAddition, hexTileImport, waterMaterialTop, camera, scene);
    });

    var slider = new GUI.Slider();
    slider.minimum = 1;
    slider.maximum = 10
    slider.value = 2;
    slider.height = "20px";
    slider.width = "200px";
    slider.onValueChangedObservable.add(function (value) {
        gridSize = Math.round(value);
        if (guiButton.textBlock) {
            guiButton.textBlock.text = "Rebuild Hex Grid: Size " + gridSize;
        }
    });
    panel.addControl(slider);
    panel.addControl(guiButton);

    return scene;

};

function createHexGrid(gridSize: number, hexWidthDistance: number, hexHeightDistance: number, rowlengthAddition: number, hexTileImport: BABYLON.AssetContainer, waterMaterialTop: BABYLON.NodeMaterial, camera: BABYLON.ArcRotateCamera, scene: BABYLON.Scene) {
    let gridStart = new BABYLON.Vector3((hexWidthDistance / 2) * (gridSize - 1), 0, (-hexHeightDistance * 0.75) * (gridSize - 1));
    for (let i = 0; i < (gridSize * 2) - 1; i++) {
        for (let y = 0; y < gridSize + rowlengthAddition; y++) {
            let hexTile = hexTileImport.instantiateModelsToScene();
            let hexTileRoot = hexTile.rootNodes[0] as BABYLON.Mesh;
            hexTileRoot.name = "hexTile" + i + y;
            hexTileRoot.position.copyFrom(gridStart);
            hexTileRoot.position.x -= hexWidthDistance * y;

            let hexChildren = hexTileRoot.getDescendants() as BABYLON.Mesh[];
            for (let k = 0; k < hexChildren.length; k++) {
                hexChildren[k].name = hexChildren[k].name.slice(9);
                if (hexChildren[k].name === "terrain") {
                    hexChildren[k].visibility = 0;
                }
            }

            let hexTileChildMeshes = hexTileRoot.getChildMeshes();
            for (let j = 0; j < hexTileChildMeshes.length; j++) {
                if (hexTileChildMeshes[j].name === "top") {
                    hexTileChildMeshes[j].material = waterMaterialTop;
                    hexTileChildMeshes[j].hasVertexAlpha = false;
                }
            }

            let hexTileAnimGroup = hexTile.animationGroups[0];
            hexTileAnimGroup.name = "AnimGroup" + hexTileRoot.name;
        };

        if (i >= gridSize - 1) {
            rowlengthAddition -= 1;
            gridStart.x -= hexWidthDistance / 2;
            gridStart.z += hexHeightDistance * 0.75;
        }
        else {
            rowlengthAddition += 1;
            gridStart.x += hexWidthDistance / 2;
            gridStart.z += hexHeightDistance * 0.75;
        }
    };
    camera.radius = gridSize * 5;
    camera.upperRadiusLimit = camera.radius + 5;

    let allAnimGroups = scene.animationGroups;
    for (let i = 0; i < allAnimGroups.length; i++) {
        allAnimGroups[i].reset();
    }
}

//This is the main method that builds a randomly influenced noise data array by running the "diamond-square algorithm." https://en.wikipedia.org/wiki/Diamond-square_algorithm
function diamondSquare(resolution: number, multiplier: number): Uint8Array {
    let gridSize = resolution - 1;
    let rows = [];
    let columns = [];
    let subdivisions = 1;

    //initialize the grid
    for (let y = 0; y < resolution; y++) {
        for (let x = 0; x < resolution; x++) {
            columns[x] = 0;
        }
        rows[y] = columns;
        columns = [];
    }

    //set corner values
    rows[0][0] = Math.random() / multiplier;
    rows[0][gridSize] = Math.random() / multiplier;
    rows[gridSize][0] = Math.random() / multiplier;
    rows[gridSize][gridSize] = Math.random() / multiplier;

    let loopBreak = 0;
    while (loopBreak != 1) {
        subdivisions = subdivisions * 2;
        let distance = gridSize / subdivisions;

        //diamond step
        for (let rowNumber = distance; rowNumber < resolution; rowNumber += (distance * 2)) {
            for (let columnNumber = distance; columnNumber < resolution; columnNumber += (distance * 2)) {
                rows[rowNumber][columnNumber] = diamond(rows, distance, rowNumber, columnNumber, subdivisions, multiplier);
            }
        }

        //square step
        for (let rowNumber = 0; rowNumber < resolution; rowNumber += distance) {
            for (let columnNumber = 0; columnNumber < resolution; columnNumber += distance) {
                if (rows[rowNumber][columnNumber] == 0) {
                    rows[rowNumber][columnNumber] = square(rows, distance, rowNumber, columnNumber, subdivisions, multiplier);
                }
            }
        }

        loopBreak = 1;
        for (let y = 0; y < resolution; y++) {
            for (let x = 0; x < resolution; x++) {
                if (rows[y][x] == 0) {
                    loopBreak = 0;
                }
            }
        }
    }
    //Create a Uint8Array, convert nested row/column array to Uint8Array, multiply by 255 for color.
    let dataArray = new Uint8Array((resolution - 1) * (resolution - 1) * 3);
    let rowCounter = 0;
    let columnCounter = 0;
    let adjustedNoiseValue = 0;
    for (let i = 0; i < dataArray.length; i += 3) {
        adjustedNoiseValue = rows[rowCounter][columnCounter] * 255;
        adjustedNoiseValue = Math.min(255, Math.max(0, adjustedNoiseValue));
        dataArray[i] = adjustedNoiseValue;
        dataArray[i + 1] = adjustedNoiseValue;
        dataArray[i + 2] = adjustedNoiseValue;
        columnCounter++;
        if (columnCounter == resolution - 1) {
            columnCounter = 0;
            rowCounter++;
        }
    };

    return dataArray;
}

function diamond(rows: number[][], distance: number, rowNumber: number, columnNumber: number, subdivisions: number, multiplier: number) {

    let diamondAverageArray = [];
    if (rows[rowNumber - distance][columnNumber - distance] != null) {
        diamondAverageArray.push(rows[rowNumber - distance][columnNumber - distance]);
    }
    if (rows[rowNumber - distance][columnNumber + distance] != null) {
        diamondAverageArray.push(rows[rowNumber - distance][columnNumber + distance]);
    }
    if (rows[rowNumber + distance][columnNumber - distance] != null) {
        diamondAverageArray.push(rows[rowNumber + distance][columnNumber - distance]);
    }
    if (rows[rowNumber + distance][columnNumber + distance] != null) {
        diamondAverageArray.push(rows[rowNumber + distance][columnNumber + distance]);
    }
    let diamondValue = 0;
    for (let i = 0; i < diamondAverageArray.length; i++) {
        diamondValue += diamondAverageArray[i];
    }

    diamondValue = (diamondValue / diamondAverageArray.length) + ((Math.random() - 0.5) / multiplier) / subdivisions;

    return diamondValue;
}

function square(rows: number[][], distance: number, rowNumber: number, columnNumber: number, subdivisions: number, multiplier: number) {

    let squareAverageArray = [];
    if (rows[rowNumber - distance] != null && rows[rowNumber - distance][columnNumber] != null) {
        squareAverageArray.push(rows[rowNumber - distance][columnNumber]);
    }
    if (rows[rowNumber][columnNumber + distance] != null) {
        squareAverageArray.push(rows[rowNumber][columnNumber + distance]);
    }
    if (rows[rowNumber + distance] != null && rows[rowNumber + distance][columnNumber] != null) {
        squareAverageArray.push(rows[rowNumber + distance][columnNumber]);
    }
    if (rows[rowNumber][columnNumber - distance] != null) {
        squareAverageArray.push(rows[rowNumber][columnNumber - distance]);
    }
    let squareValue = 0;
    for (let i = 0; i < squareAverageArray.length; i++) {
        squareValue += squareAverageArray[i];
    }

    squareValue = (squareValue / squareAverageArray.length) + ((Math.random() - 0.5) / multiplier) / subdivisions;

    return squareValue;
}

function scaleNoise(noiseArray: Uint8Array) {
    //Scale the noise to always produce an island
    let max = 0;
    let min = 255;
    let desiredMin = 80;
    let desiredMax = 110;
    let scaledNoiseArray = new Uint8Array(noiseArray.length);

    for (let i = 0; i < noiseArray.length; i++) {
        if (noiseArray[i] > max) {
            max = noiseArray[i];
        }
        if (noiseArray[i] < min) {
            min = noiseArray[i];
        }
    }

    for (let i = 0; i < noiseArray.length; i++) {
        let adjustedValue = desiredMax * (noiseArray[i] - min) / (max - min) + desiredMin;
        scaledNoiseArray[i] = adjustedValue;
    }

    return scaledNoiseArray;
}