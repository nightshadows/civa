import { Game } from './index';

export class AIPlayer {
    private gameId: string;
    private playerId: string;

    constructor(gameId: string, playerId: string) {
        this.gameId = gameId;
        this.playerId = playerId;
    }

    public takeTurn(game: Game): void {
        console.log(`AI player ${this.playerId} taking turn in game ${this.gameId}`);

        // Simple AI: Just end turn for now
        // We can add more sophisticated behavior later
        try {
            game.endTurn();
            console.log(`AI player ${this.playerId} ended their turn`);
        } catch (error) {
            console.error(`Error during AI turn:`, error);
        }
    }
}