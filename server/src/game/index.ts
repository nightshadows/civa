import { TileType, Position, Unit, GameState, UnitType, Tile } from '../../../shared/src/types';

export class Game {
    private map: TileType[][];
    private units: Unit[];
    private players: string[];
    private currentPlayerIndex: number;
    private mapSize: number;
    private readonly MAX_PLAYERS = 2;
    private _gameId: string;

    constructor(mapSize: number, players: string[], gameId: string) {
        this.mapSize = mapSize;
        this.players = players;
        this._gameId = gameId;
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
        const visibleTiles = this.getVisibleTilesForPlayer(playerId);
        const visibleTilePositions = new Set(
            visibleTiles.map(tile => `${tile.position.x},${tile.position.y}`)
        );
        
        // Filter units to only show:
        // 1. Player's own units (always visible)
        // 2. Enemy units that are in visible tiles
        const visibleUnits = this.units.filter(unit => {
            if (unit.playerId === playerId) {
                return true; // Always show player's own units
            }
            // For enemy units, only show if they're in visible tiles
            const unitPos = `${unit.position.x},${unit.position.y}`;
            return visibleTilePositions.has(unitPos);
        });

        const state = {
            playerId,
            currentPlayerId: this.players[this.currentPlayerIndex],
            visibleTiles,
            visibleUnits,
            mapSize: this.mapSize
        };

        console.log(`Sending state to player ${playerId}:`, {
            currentPlayer: this.players[this.currentPlayerIndex],
            visibleUnitCount: visibleUnits.length,
            totalUnitCount: this.units.length,
            visibleTileCount: visibleTiles.length,
            ownedUnits: visibleUnits.filter(u => u.playerId === playerId).length,
            enemyUnits: visibleUnits.filter(u => u.playerId !== playerId).length
        });

        return state;
    }

    public isPlayerTurn(playerId: string): boolean {
        return this.players[this.currentPlayerIndex] === playerId;
    }

    public endTurn(): void {
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

        // Check if destination is within map bounds
        if (!this.isWithinMapBounds(destination)) {
            console.log('Move failed: Destination out of map bounds', { destination });
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

        // Get all possible movement positions
        const reachableHexes = this.getHexesInRange(unit.position, unit.movementPoints);
        const canMoveTo = reachableHexes.some(hex =>
            hex.x === destination.x && hex.y === destination.y
        );

        if (!canMoveTo) {
            console.log('Move failed: Destination not reachable', {
                unitId,
                destination,
                movementPoints: unit.movementPoints
            });
            return false;
        }

        const distance = this.getHexDistance(unit.position, destination);
        unit.position = destination;
        unit.movementPoints -= distance;

        return true;
    }

    private getHexDistance(a: Position, b: Position): number {
        // Convert to cube coordinates
        const ac = this.offsetToCube(a);
        const bc = this.offsetToCube(b);

        // Calculate cube distance
        return Math.max(
            Math.abs(ac.x - bc.x),
            Math.abs(ac.y - bc.y),
            Math.abs(ac.z - bc.z)
        );
    }

    private offsetToCube(hex: Position): { x: number; y: number; z: number } {
        const x = hex.x;
        const z = hex.y - (hex.x + (hex.x & 1)) / 2;
        const y = -x - z;
        return { x, y, z };
    }

    public fortifyUnit(unitId: string): boolean {
        const unit = this.units.find(u => u.id === unitId);
        if (!unit || unit.movementPoints <= 0) return false;

        unit.movementPoints = 0;
        return true;
    }

    public get gameId(): string {
        return this._gameId;
    }

    private getNeighbors(hex: Position): Position[] {
        const directions = hex.x % 2 === 1
            ? [
                { x: -1, y: 0 },  // top left
                { x: -1, y: +1 }, // top right
                { x: 0, y: +1 },  // right
                { x: 0, y: -1 },  // left
                { x: 1, y: 0 },   // bottom left
                { x: 1, y: +1 }   // bottom right
            ]
            : [
                { x: -1, y: -1 }, // top left
                { x: -1, y: 0 },  // top right
                { x: 0, y: +1 },  // right
                { x: 0, y: -1 },  // left
                { x: +1, y: -1 }, // bottom left
                { x: +1, y: 0 }   // bottom right
            ];

        return directions.map(dir => ({
            x: hex.x + dir.x,
            y: hex.y + dir.y
        }));
    }

    private getHexesInRange(center: Position, range: number): Position[] {
        const results: Position[] = [];
        const visited = new Set<string>();
        const queue: Array<{ pos: Position; distance: number }> = [
            { pos: center, distance: 0 }
        ];

        while (queue.length > 0) {
            const current = queue.shift()!;
            const posKey = `${current.pos.x},${current.pos.y}`;

            if (visited.has(posKey)) continue;
            visited.add(posKey);

            if (current.distance <= range) {
                results.push(current.pos);

                // Get neighbors using cube coordinates for accurate hex distance
                const neighbors = this.getNeighbors(current.pos);
                for (const neighbor of neighbors) {
                    if (!visited.has(`${neighbor.x},${neighbor.y}`)) {
                        queue.push({
                            pos: neighbor,
                            distance: current.distance + 1
                        });
                    }
                }
            }
        }

        return results;
    }

    private isWithinMapBounds(position: Position): boolean {
        return position.x >= 0 &&
               position.x < this.mapSize &&
               position.y >= 0 &&
               position.y < this.mapSize;
    }

    private getVisibleTilesForPlayer(playerId: string): Tile[] {
        const playerUnits = this.units.filter(unit => unit.playerId === playerId);
        const visibleTiles = new Set<string>();
        
        // For each unit, calculate visible tiles based on vision range
        playerUnits.forEach(unit => {
            const tilesInRange = this.getHexesInRange(unit.position, unit.visionRange);
            tilesInRange.forEach(pos => {
                // Only add tiles that are within map bounds
                if (pos.x >= 0 && pos.x < this.mapSize && pos.y >= 0 && pos.y < this.mapSize) {
                    visibleTiles.add(`${pos.x},${pos.y}`);
                }
            });
        });

        // Convert visible positions to Tile objects
        const tiles: Tile[] = [];
        visibleTiles.forEach(posKey => {
            const [x, y] = posKey.split(',').map(Number);
            tiles.push({
                type: this.map[y][x],
                position: { x, y }
            });
        });

        return tiles;
    }
}