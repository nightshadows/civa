import { Game } from './index';

export class AIPlayer {
    private gameId: string;
    private playerId: string;

    constructor(gameId: string, playerId: string) {
        this.gameId = gameId;
        this.playerId = playerId;
    }

    public takeTurn(game: Game): void {
        // For now, just end the turn immediately
        console.log(`AI player ${this.playerId} ending turn in game ${this.gameId}`);
        game.endTurn();
    }
}