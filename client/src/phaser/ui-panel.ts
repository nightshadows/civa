import { GameState, Unit, GameAction } from '@shared/types';

export class UIPanel {
    private scene: Phaser.Scene;
    private background!: Phaser.GameObjects.Rectangle;
    private unitInfoTexts: Phaser.GameObjects.Text[] = [];
    private turnInfo!: Phaser.GameObjects.Text;
    private fortifyButton!: Phaser.GameObjects.Rectangle;
    private fortifyText!: Phaser.GameObjects.Text;
    private levelUpButton!: Phaser.GameObjects.Rectangle;
    private levelUpText!: Phaser.GameObjects.Text;
    private endTurnButton!: Phaser.GameObjects.Rectangle;
    private endTurnText!: Phaser.GameObjects.Text;
    private playerList!: Phaser.GameObjects.Text;
    private turnNumberText!: Phaser.GameObjects.Text;
    private height: number;
    private menuButton!: Phaser.GameObjects.Rectangle;
    private menuText!: Phaser.GameObjects.Text;
    private moveHistoryText: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene, height: number) {
        this.scene = scene;
        this.height = height;
        this.createPanel();
    }

    private createPanel() {
        const gameHeight = this.scene.game.canvas.height;

        // Panel background at bottom of screen
        this.background = this.scene.add.rectangle(
            0,
            gameHeight - this.height,
            this.scene.game.canvas.width,
            this.height,
            0x222222
        )
        .setOrigin(0, 0)
        .setDepth(100);

        // Position all UI elements relative to the panel
        const baseY = gameHeight - this.height + 20;

        // Turn info text
        this.turnInfo = this.scene.add.text(700, baseY, '', {
            color: '#ffffff',
            fontSize: '14px',
            align: 'right',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        }).setDepth(101);

        // Create array of text objects for unit info
        for (let i = 0; i < 5; i++) {
            const text = this.scene.add.text(20, baseY + i * 16, '', {
                color: '#ffffff',
                fontSize: '12px',
                fontFamily: 'Arial'
            }).setDepth(101);
            this.unitInfoTexts.push(text);
        }

        // Player list
        this.playerList = this.scene.add.text(200, baseY, '', {
            color: '#ffffff',
            fontSize: '12px',
            fontFamily: 'Arial',
            backgroundColor: '#333333',
            padding: { x: 8, y: 4 }
        }).setDepth(101);

        // Add turn number text
        this.turnNumberText = this.scene.add.text(700, baseY + 40, '', {
            color: '#ffffff',
            fontSize: '12px',
            fontFamily: 'Arial'
        }).setDepth(101);

        this.createButtons();

        // Create a mask for the move history text
        const moveHistoryMask = this.scene.add.graphics()
            .fillStyle(0xffffff)
            .fillRect(10, baseY + 80, this.scene.game.canvas.width - 20, 60);

        // Create move history text with mask
        this.moveHistoryText = this.scene.add.text(10, baseY + 80, '', {
            fontSize: '12px',
            color: '#ffffff',
            wordWrap: { width: this.scene.game.canvas.width - 40 }
        })
        .setDepth(101)
        .setMask(new Phaser.Display.Masks.GeometryMask(this.scene, moveHistoryMask));

        // Add scrolling interaction
        this.moveHistoryText.setInteractive();
        let isDragging = false;
        let startY = 0;

        this.moveHistoryText.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            isDragging = true;
            startY = pointer.y - this.moveHistoryText.y;
        });

        this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (!isDragging) return;

            const newY = pointer.y - startY;
            const maxScroll = -(this.moveHistoryText.height - 60);

            this.moveHistoryText.y = Phaser.Math.Clamp(
                newY,
                baseY + 80 + maxScroll,
                baseY + 80
            );
        });

        this.scene.input.on('pointerup', () => {
            isDragging = false;
        });
    }

    private createButtons() {
        const baseY = this.scene.game.canvas.height - this.height + 80;

        // Fortify button
        this.fortifyButton = this.scene.add.rectangle(400, baseY, 100, 30, 0x666666)
            .setInteractive()
            .setDepth(101);
        this.fortifyText = this.scene.add.text(400, baseY, 'Fortify', {
            color: '#ffffff',
            fontSize: '12px',
            fontFamily: 'Arial'
        })
        .setOrigin(0.5)
        .setDepth(102);

        // Level Up button
        this.levelUpButton = this.scene.add.rectangle(520, baseY, 100, 30, 0x666666)
            .setInteractive()
            .setDepth(101);
        this.levelUpText = this.scene.add.text(520, baseY, 'Level Up', {
            color: '#ffffff',
            fontSize: '12px',
            fontFamily: 'Arial'
        })
        .setOrigin(0.5)
        .setDepth(102);

        // End Turn button
        this.endTurnButton = this.scene.add.rectangle(640, baseY, 100, 30, 0x666666)
            .setInteractive()
            .setDepth(101);
        this.endTurnText = this.scene.add.text(640, baseY, 'End Turn', {
            color: '#ffffff',
            fontSize: '12px',
            fontFamily: 'Arial'
        })
        .setOrigin(0.5)
        .setDepth(102);

        // Menu button (positioned below End Turn button)
        this.menuButton = this.scene.add.rectangle(640, baseY + 40, 100, 30, 0x666666)
            .setInteractive()
            .setDepth(101);
        this.menuText = this.scene.add.text(640, baseY + 40, 'Menu', {
            color: '#ffffff',
            fontSize: '12px',
            fontFamily: 'Arial'
        })
        .setOrigin(0.5)
        .setDepth(102);

        // Add click handlers
        this.fortifyButton.on('pointerdown', () => this.onFortifyClick());
        this.levelUpButton.on('pointerdown', () => this.onLevelUpClick());
        this.endTurnButton.on('pointerdown', () => this.onEndTurnClick());
        this.menuButton.on('pointerdown', () => this.onMenuClick());
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
        this.unitInfoTexts[4].setText(`Movement: ${unit.movementPoints}  Vision: ${unit.visionRange}`).setColor('#f00fff');

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

    private onMenuClick() {
        window.location.href = '/';
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

    public updateMoveHistory(history: GameAction[]): void {
        const lastMoves = history.slice(-3).reverse().map(action => {
            const time = new Date(action.timestamp).toLocaleTimeString();
            switch (action.type) {
                case 'MOVE_UNIT':
                    return `[${time}] Player ${action.playerId} moved unit from (${action.payload?.from?.x},${action.payload?.from?.y}) to (${action.payload?.to?.x},${action.payload?.to?.y})`;

                case 'ATTACK_UNIT':
                    return `[${time}] Player ${action.playerId} attacked unit ${action.payload?.targetId} dealing ${action.payload?.damageDealt} damage` +
                           (action.payload?.damageTaken ? ` and receiving ${action.payload.damageTaken} damage` : '');

                case 'UNIT_DIED':
                    return `[${time}] ${action.playerId}'s unit ${action.payload?.unitId} was destroyed at (${action.payload?.to?.x},${action.payload?.to?.y})`;

                case 'FORTIFY_UNIT':
                    return `[${time}] Player ${action.playerId} fortified unit ${action.payload?.unitId}`;

                case 'END_TURN':
                    return `[${time}] Player ${action.playerId} ended their turn`;

                default:
                    return `[${time}] Unknown action: ${action.type}`;
            }
        });

        this.moveHistoryText.setText('Recent moves:\n' + lastMoves.join('\n'));
    }
}