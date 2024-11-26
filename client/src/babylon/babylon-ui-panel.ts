import { Scene } from '@babylonjs/core';
import { AdvancedDynamicTexture, Rectangle, Control, TextBlock, StackPanel } from '@babylonjs/gui';
import { Unit, GameState } from '@shared/types';

export class BabylonUIPanel {
    private advancedTexture: AdvancedDynamicTexture;
    private unitInfoTexts: TextBlock[] = [];
    private turnInfo: TextBlock;
    private turnNumberText: TextBlock;
    private fortifyButton: Rectangle;
    private levelUpButton: Rectangle;
    private endTurnButton: Rectangle;
    private playerList: TextBlock;
    private mainPanel: StackPanel;
    private onEndTurn?: () => void;
    private onFortifyUnit?: () => void;
    private onLevelUpUnit?: () => void;

    constructor(scene: Scene) {
        this.advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI("UI", true, scene);
        this.createPanel();
        this.setupButtonHandlers();
    }

    private createPanel() {
        // Create main panel container using StackPanel for better organization
        this.mainPanel = new StackPanel();
        this.mainPanel.width = "100%";
        this.mainPanel.height = "100px";
        this.mainPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.mainPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        this.mainPanel.background = "#222222";
        this.advancedTexture.addControl(this.mainPanel);

        // Create turn info container
        const turnInfoContainer = new StackPanel();
        turnInfoContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        turnInfoContainer.height = "40px";
        turnInfoContainer.paddingRight = "20px";

        // Create turn info text
        this.turnInfo = new TextBlock();
        this.turnInfo.text = "";
        this.turnInfo.color = "white";
        this.turnInfo.fontSize = 16;
        this.turnInfo.height = "20px";
        turnInfoContainer.addControl(this.turnInfo);

        // Create turn number text
        this.turnNumberText = new TextBlock();
        this.turnNumberText.text = "";
        this.turnNumberText.color = "white";
        this.turnNumberText.fontSize = 14;
        this.turnNumberText.height = "20px";
        turnInfoContainer.addControl(this.turnNumberText);

        this.mainPanel.addControl(turnInfoContainer);

        // Create unit info container
        const unitInfoContainer = new StackPanel();
        unitInfoContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        unitInfoContainer.paddingLeft = "20px";

        // Create unit info texts
        for (let i = 0; i < 5; i++) {
            const text = new TextBlock();
            text.text = "";
            text.color = "white";
            text.fontSize = 14;
            text.height = "20px";
            text.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
            this.unitInfoTexts.push(text);
            unitInfoContainer.addControl(text);
        }

        this.mainPanel.addControl(unitInfoContainer);

        // Create player list
        this.playerList = new TextBlock();
        this.playerList.text = "";
        this.playerList.color = "white";
        this.playerList.fontSize = 14;
        this.playerList.height = "60px";
        this.playerList.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.playerList.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.playerList.paddingLeft = "200px";
        this.mainPanel.addControl(this.playerList);

        // Create and add buttons
        this.createButtons();
    }

    private createButtons() {
        const buttonContainer = new StackPanel();
        buttonContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        buttonContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        buttonContainer.isVertical = false;
        buttonContainer.height = "40px";
        buttonContainer.paddingRight = "20px";
        buttonContainer.paddingBottom = "10px";

        // Create End Turn button
        this.endTurnButton = new Rectangle("endTurnBtn");
        this.endTurnButton.width = "100px";
        this.endTurnButton.height = "30px";
        this.endTurnButton.background = "#666666";
        this.endTurnButton.cornerRadius = 5;
        this.endTurnButton.thickness = 0;
        
        const endTurnText = new TextBlock();
        endTurnText.text = "End Turn";
        endTurnText.color = "white";
        this.endTurnButton.addControl(endTurnText);
        
        // Create Fortify button
        this.fortifyButton = new Rectangle("fortifyBtn");
        this.fortifyButton.width = "100px";
        this.fortifyButton.height = "30px";
        this.fortifyButton.background = "#666666";
        this.fortifyButton.cornerRadius = 5;
        this.fortifyButton.thickness = 0;
        
        const fortifyText = new TextBlock();
        fortifyText.text = "Fortify";
        fortifyText.color = "white";
        this.fortifyButton.addControl(fortifyText);
        
        // Create Level Up button
        this.levelUpButton = new Rectangle("levelUpBtn");
        this.levelUpButton.width = "100px";
        this.levelUpButton.height = "30px";
        this.levelUpButton.background = "#666666";
        this.levelUpButton.cornerRadius = 5;
        this.levelUpButton.thickness = 0;
        
        const levelUpText = new TextBlock();
        levelUpText.text = "Level Up";
        levelUpText.color = "white";
        this.levelUpButton.addControl(levelUpText);
        
        // Add buttons from left to right
        buttonContainer.addControl(this.fortifyButton);
        buttonContainer.addControl(this.levelUpButton);
        buttonContainer.addControl(this.endTurnButton);
        
        this.advancedTexture.addControl(buttonContainer);
    }

    private setupButtonHandlers() {
        this.endTurnButton.onPointerClickObservable.add(() => {
            if (this.onEndTurn) {
                this.onEndTurn();
            }
        });

        this.fortifyButton.onPointerClickObservable.add(() => {
            if (this.onFortifyUnit) {
                this.onFortifyUnit();
            }
        });

        this.levelUpButton.onPointerClickObservable.add(() => {
            if (this.onLevelUpUnit) {
                this.onLevelUpUnit();
            }
        });
    }

    public setCallbacks(callbacks: {
        onEndTurn: () => void;
        onFortifyUnit: () => void;
        onLevelUpUnit: () => void;
    }) {
        this.onEndTurn = callbacks.onEndTurn;
        this.onFortifyUnit = callbacks.onFortifyUnit;
        this.onLevelUpUnit = callbacks.onLevelUpUnit;
    }

    public updateUnitInfo(unit: Unit | null) {
        if (!unit) {
            this.unitInfoTexts.forEach(text => text.text = "");
            this.fortifyButton.background = "#666666";
            this.levelUpButton.background = "#666666";
            return;
        }

        const healthPercent = Math.round((unit.currentHp / unit.maxHp) * 100);
        const expPercent = Math.round((unit.currentExp / unit.expNeeded) * 100);

        this.unitInfoTexts[0].text = `${unit.type} (Level ${unit.level})`;
        this.unitInfoTexts[0].color = "#ff4444";

        this.unitInfoTexts[1].text = `HP: ${unit.currentHp}/${unit.maxHp} (${healthPercent}%)`;
        this.unitInfoTexts[1].color = healthPercent > 66 ? "#44ff44" : healthPercent > 33 ? "#ffff44" : "#ff4444";

        this.unitInfoTexts[2].text = `ATK: ${unit.attack}  DEF: ${unit.defense}`;
        this.unitInfoTexts[2].color = "#999999";

        this.unitInfoTexts[3].text = `EXP: ${unit.currentExp}/${unit.expNeeded} (${expPercent}%)`;
        this.unitInfoTexts[3].color = "#999999";

        this.unitInfoTexts[4].text = `Movement: ${unit.movementPoints}  Vision: ${unit.visionRange}`;
        this.unitInfoTexts[4].color = "#ffffff";

        // Update button states
        this.fortifyButton.background = unit.movementPoints > 0 ? "#44aa44" : "#666666";
        this.levelUpButton.background = unit.currentExp >= unit.expNeeded ? "#44aa44" : "#666666";
    }

    public updateTurnInfo(currentPlayerId: string, myPlayerId: string, turnNumber: number) {
        const isMyTurn = currentPlayerId === myPlayerId;
        this.turnInfo.text = isMyTurn ? 'Your Turn' : 'Enemy Turn';
        this.turnInfo.color = isMyTurn ? '#44ff44' : '#ff4444';
        this.turnNumberText.text = `Turn ${turnNumber}`;
        this.endTurnButton.background = isMyTurn ? "#44aa44" : "#666666";
    }

    public updatePlayerList(gameState: GameState) {
        const players = gameState.players.map(id => {
            const isCurrentPlayer = id === gameState.currentPlayerId;
            const isMe = id === gameState.playerId;
            return `${isMe ? 'You' : id}${isCurrentPlayer ? ' (*)' : ''}`;
        });

        this.playerList.text = 'Players:\n' + players.join('\n');
    }
} 