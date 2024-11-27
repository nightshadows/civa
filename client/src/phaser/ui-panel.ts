import { Unit } from '@shared/types';

export class UIPanel {
    private scene: Phaser.Scene;
    private background: Phaser.GameObjects.Rectangle;
    private unitInfoTexts: Phaser.GameObjects.Text[] = [];
    private turnInfo: Phaser.GameObjects.Text;
    private fortifyButton: Phaser.GameObjects.Rectangle;
    private fortifyText: Phaser.GameObjects.Text;
    private levelUpButton: Phaser.GameObjects.Rectangle;
    private levelUpText: Phaser.GameObjects.Text;
    private endTurnButton: Phaser.GameObjects.Rectangle;
    private endTurnText: Phaser.GameObjects.Text;
    private playerList: Phaser.GameObjects.Text;
    private turnNumberText: Phaser.GameObjects.Text;
    private height: number;

    constructor(scene: Phaser.Scene, height: number) {
        this.scene = scene;
        this.height = height;
        this.createPanel();
    }

    private createPanel() {
        const gameHeight = this.scene.game.canvas.height;
        
        // Panel background at bottom of screen with high depth
        this.background = this.scene.add.rectangle(
            0,
            gameHeight - this.height,
            this.scene.game.canvas.width,
            this.height,
            0x222222
        )
        .setOrigin(0, 0)
        .setDepth(100); // Set UI panel to higher depth

        // Position all UI elements relative to the panel
        const baseY = gameHeight - this.height + 20;
        
        // Turn info text
        this.turnInfo = this.scene.add.text(700, baseY, '', {
            color: '#ffffff',
            fontSize: '14px',
            align: 'right',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        });

        // Create array of text objects for unit info
        for (let i = 0; i < 5; i++) {
            const text = this.scene.add.text(20, baseY + i * 16, '', {
                color: '#ffffff',
                fontSize: '12px',
                fontFamily: 'Arial'
            });
            this.unitInfoTexts.push(text);
        }

        // Player list
        this.playerList = this.scene.add.text(200, baseY, '', {
            color: '#ffffff',
            fontSize: '12px',
            fontFamily: 'Arial',
            backgroundColor: '#333333',
            padding: { x: 8, y: 4 }
        });

        // Add turn number text
        this.turnNumberText = this.scene.add.text(700, baseY + 40, '', {
            color: '#ffffff',
            fontSize: '12px',
            fontFamily: 'Arial'
        });

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

        // Set depth for all button elements
        [this.fortifyButton, this.fortifyText, 
         this.levelUpButton, this.levelUpText,
         this.endTurnButton, this.endTurnText]
            .forEach(element => {
                if (element) element.setDepth(100);
            });
    }

    public updateUnitInfo(unit: Unit | null) {
        if (!unit) {
            this.unitInfoTexts.forEach(text => text.setText(''));
            this.fortifyButton.setFillStyle(0x666666);
            this.levelUpButton.setFillStyle(0x666666);
            return;
        }

        const healthPercent = Math.round((unit.currentHp / unit.maxHp) * 100);
        const expPercent = Math.round((unit.currentExp / unit.expNeeded) * 100);
        const healthColor = healthPercent > 66 ? '#44ff44' : healthPercent > 33 ? '#ffff44' : '#ff4444';

        // Update each line with appropriate colors
        this.unitInfoTexts[0].setText(`${unit.type} (Level ${unit.level})`).setColor('#ff4444');
        this.unitInfoTexts[1].setText(`HP: ${unit.currentHp}/${unit.maxHp} (${healthPercent}%)`).setColor(healthColor);
        this.unitInfoTexts[2].setText(`ATK: ${unit.attack}  DEF: ${unit.defense}`).setColor('#999999');
        this.unitInfoTexts[3].setText(`EXP: ${unit.currentExp}/${unit.expNeeded} (${expPercent}%)`).setColor('#999999');
        this.unitInfoTexts[4].setText(`Movement: ${unit.movementPoints}  Vision: ${unit.visionRange}`).setColor('#ffffff');

        // Update button states
        this.fortifyButton.setFillStyle(unit.movementPoints > 0 ? 0x44aa44 : 0x666666);
        this.levelUpButton.setFillStyle(unit.currentExp >= unit.expNeeded ? 0x44aa44 : 0x666666);
    }

    public updateTurnInfo(currentPlayerId: string, myPlayerId: string, turnNumber: number) {
        const isMyTurn = currentPlayerId === myPlayerId;
        this.turnInfo.setText(isMyTurn ? 'Your Turn' : 'Enemy Turn');
        this.turnInfo.setColor(isMyTurn ? '#44ff44' : '#ff4444');
        this.endTurnButton.setFillStyle(isMyTurn ? 0x44aa44 : 0x666666);
        this.turnNumberText.setText(`Turn ${turnNumber}`);
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

    public updatePlayerList(gameState: GameState) {
        const players = gameState.players.map(id => {
            const isCurrentPlayer = id === gameState.currentPlayerId;
            const isMe = id === gameState.playerId;
            return `${isMe ? 'You' : id }${isCurrentPlayer ? ' (*)' : ''}`;
        });

        this.playerList.setText(
            'Players:\n' + players.join('\n')
        );
    }
}