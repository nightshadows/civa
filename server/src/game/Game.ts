import { TileType, Position, Unit, GameState, UnitType, Tile } from '../../../shared/src/types';

export class Game {
    private map: TileType[][];
    private units: Unit[];
    private players: string[];
    private currentPlayerIndex: number;
    private mapSize: number;
    private readonly MAX_PLAYERS = 2;

    constructor(mapSize: number, players: string[]) {
        this.mapSize = mapSize;
        this.players = players;
        this.currentPlayerIndex = 0;
        this.map = this.generateMap();
        this.units = this.initializeUnits();
    }

    public canAddPlayer(): boolean {
        return this.players.length < this.MAX_PLAYERS;
    }

    public addPlayer(playerId: string): void {
        if (!this.canAddPlayer()) {
            throw new Error('Game is full');
        }
        this.players.push(playerId);
        // Initialize units for the new player
        const newUnits = this.initializeUnitsForPlayer(playerId, this.players.length - 1);
        this.units.push(...newUnits);
    }

    private initializeUnitsForPlayer(playerId: string, playerIndex: number): Unit[] {
        const units: Unit[] = [];
        const baseX = playerIndex === 0 ? 5 : this.mapSize - 5;
        const baseY = playerIndex === 0 ? 5 : this.mapSize - 5;

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

        return units;
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
            const baseX = index === 0 ? 6 : this.mapSize - 5;
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
                position: { x: baseX + 1, y: baseY },
                playerId,
                movementPoints: 2,
                visionRange: 3
            });
        });
        return units;
    }

    public getVisibleState(playerId: string): GameState {
        // For now, return all tiles and units (we'll implement fog of war later)
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
            playerId,
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

    public moveUnit(unitId: string, destination: Position): boolean {
        const unit = this.units.find(u => u.id === unitId);
        if (!unit) {
            console.log('Move failed: Unit not found', { unitId });
            return false;
        }

        // Check if it's the unit owner's turn
        if (!this.isPlayerTurn(unit.playerId)) {
            console.log('Move failed: Not player\'s turn', { 
                unitId, 
                playerId: unit.playerId 
            });
            return false;
        }

        // Check if unit has movement points
        if (unit.movementPoints <= 0) {
            console.log('Move failed: No movement points remaining', { 
                unitId, 
                movementPoints: unit.movementPoints 
            });
            return false;
        }

        // Calculate distance to ensure it's within movement range
        const distance = this.getHexDistance(unit.position, destination);
        if (distance > unit.movementPoints) {
            console.log('Move failed: Destination out of range', { 
                unitId, 
                distance,
                movementPoints: unit.movementPoints 
            });
            return false;
        }

        const oldPosition = { ...unit.position };
        // Update unit position and reduce movement points
        unit.position = destination;
        unit.movementPoints -= distance;

        console.log('Unit moved successfully:', {
            unitId,
            from: oldPosition,
            to: destination,
            distance,
            remainingMovementPoints: unit.movementPoints
        });

        return true;
    }

    private getHexDistance(a: Position, b: Position): number {
        return Math.max(
            Math.abs(a.x - b.x),
            Math.abs(a.y - b.y),
            Math.abs((a.x + a.y) - (b.x + b.y))
        );
    }
}