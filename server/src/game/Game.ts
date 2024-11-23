import { TileType, Position, Unit, GameState, UnitType, Tile } from '../../../shared/src/types';

export class Game {
    private map: TileType[][];
    private units: Unit[];
    private players: string[];
    private currentPlayerIndex: number;
    private mapSize: number;

    constructor(mapSize: number, players: string[]) {
        this.mapSize = mapSize;
        this.players = players;
        this.currentPlayerIndex = 0;
        this.map = this.generateMap();
        this.units = this.initializeUnits();
    }

    private generateMap(): TileType[][] {
        // Simple random map generation
        const map: TileType[][] = [];
        for (let y = 0; y < this.mapSize; y++) {
            map[y] = [];
            for (let x = 0; x < this.mapSize; x++) {
                const rand = Math.random();
                if (rand < 0.6) map[y][x] = TileType.GRASS;
                else if (rand < 0.75) map[y][x] = TileType.FOREST;
                else if (rand < 0.9) map[y][x] = TileType.HILLS;
                else map[y][x] = TileType.WATER;
            }
        }
        return map;
    }

    private initializeUnits(): Unit[] {
        const units: Unit[] = [];
        this.players.forEach((playerId, index) => {
            // Place units at opposite corners for now
            const baseX = index === 0 ? 5 : this.mapSize - 5;
            const baseY = index === 0 ? 5 : this.mapSize - 5;

            units.push({
                id: `warrior-${playerId}`,
                type: UnitType.WARRIOR,
                position: { x: baseX, y: baseY },
                playerId,
                movementPoints: 2,
                visionRange: 2
            });

            units.push({
                id: `archer-${playerId}`,
                type: UnitType.ARCHER,
                position: { x: baseX, y: baseY + 1 },
                playerId,
                movementPoints: 2,
                visionRange: 3
            });
        });
        return units;
    }

    public getVisibleState(playerId: string): GameState {
        // For now, return all tiles (we'll implement fog of war later)
        const visibleTiles: Tile[] = [];
        for (let y = 0; y < this.mapSize; y++) {
            for (let x = 0; x < this.mapSize; x++) {
                visibleTiles.push({
                    type: this.map[y][x],
                    position: { x, y }
                });
            }
        }

        return {
            currentPlayerId: this.players[this.currentPlayerIndex],
            visibleTiles,
            visibleUnits: this.units
        };
    }

    public isPlayerTurn(playerId: string): boolean {
        return this.players[this.currentPlayerIndex] === playerId;
    }

    public endTurn() {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        // Reset movement points for new player's units
        this.units
            .filter(unit => unit.playerId === this.players[this.currentPlayerIndex])
            .forEach(unit => unit.movementPoints = 2);
    }
}