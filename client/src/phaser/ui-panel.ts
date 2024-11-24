import { Unit } from '@shared/types';

export class UIPanel {
    private scene: Phaser.Scene;
    private background: Phaser.GameObjects.Rectangle;
    private unitInfo: Phaser.GameObjects.Text;
    private turnInfo: Phaser.GameObjects.Text;
    private fortifyButton: Phaser.GameObjects.Rectangle;
    private fortifyText: Phaser.GameObjects.Text;
    private levelUpButton: Phaser.GameObjects.Rectangle;
    private levelUpText: Phaser.GameObjects.Text;
    private endTurnButton: Phaser.GameObjects.Rectangle;
    private endTurnText: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.createPanel();
    }

    private createPanel() {
        // Panel background
        this.background = this.scene.add.rectangle(0, 600, 800, 100, 0x333333)
            .setOrigin(0, 0);

        // Turn info text
        this.turnInfo = this.scene.add.text(700, 620, '', {
            color: '#ffffff',
            fontSize: '16px',
            align: 'right'
        });

        // Unit info area
        this.unitInfo = this.scene.add.text(20, 620, '', {
            color: '#ffffff',
            fontSize: '16px'
        });

        // Buttons
        this.createButtons();
    }

    private createButtons() {
        // Fortify button
        this.fortifyButton = this.scene.add.rectangle(400, 625, 100, 50, 0x666666)
            .setInteractive();
        this.fortifyText = this.scene.add.text(400, 625, 'Fortify', {
            color: '#ffffff'
        }).setOrigin(0.5);

        // Level Up button
        this.levelUpButton = this.scene.add.rectangle(520, 625, 100, 50, 0x666666)
            .setInteractive();
        this.levelUpText = this.scene.add.text(520, 625, 'Level Up', {
            color: '#ffffff'
        }).setOrigin(0.5);

        // End Turn button
        this.endTurnButton = this.scene.add.rectangle(640, 625, 100, 50, 0x666666)
            .setInteractive();
        this.endTurnText = this.scene.add.text(640, 625, 'End Turn', {
            color: '#ffffff'
        }).setOrigin(0.5);

        // Add click handlers
        this.fortifyButton.on('pointerdown', () => this.onFortifyClick());
        this.levelUpButton.on('pointerdown', () => this.onLevelUpClick());
        this.endTurnButton.on('pointerdown', () => this.onEndTurnClick());
    }

    public updateUnitInfo(unit: Unit | null) {
        if (!unit) {
            this.unitInfo.setText('');
            this.fortifyButton.setFillStyle(0x666666);
            this.levelUpButton.setFillStyle(0x666666);
            return;
        }

        this.unitInfo.setText(
            `${unit.type}\nMovement: ${unit.movementPoints}\nVision: ${unit.visionRange}`
        );

        // Update button states
        this.fortifyButton.setFillStyle(unit.movementPoints > 0 ? 0x44aa44 : 0x666666);
        // For now, level up is always disabled as we haven't implemented experience
        this.levelUpButton.setFillStyle(0x666666);
    }

    public updateTurnInfo(currentPlayerId: string, myPlayerId: string) {
        const isMyTurn = currentPlayerId === myPlayerId;
        this.turnInfo.setText(isMyTurn ? 'Your Turn' : 'Enemy Turn');
        this.turnInfo.setColor(isMyTurn ? '#44ff44' : '#ff4444');
        this.endTurnButton.setFillStyle(isMyTurn ? 0x44aa44 : 0x666666);
    }

    private onFortifyClick() {
        // Dispatch event to be handled by GameScene
        this.scene.events.emit('fortify_unit');
    }

    private onLevelUpClick() {
        this.scene.events.emit('level_up_unit');
    }

    private onEndTurnClick() {
        this.scene.events.emit('end_turn');
    }
}