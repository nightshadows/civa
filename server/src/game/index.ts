import { TileType, Position, Unit, GameState, UnitType, Tile, GameAction } from '../../../shared/src/types';
import { getStartingUnits, createUnit, resetUnitMovement, isMeleeUnit, canAttackTarget } from './units';
import { getMovementCost } from '../../../shared/src/terrain';
import { AIPlayer } from './ai-player';
import { PlayerConfig, PlayerType } from './player-types';
import { getHexDistance } from '../../../shared/src/hex-utils';

export class Game {
    public map: TileType[][];
    public units: Unit[];
    private players: string[];
    private currentPlayerIndex: number;
    private mapSize: number;
    private readonly MAX_PLAYERS = 2;
    private _gameId: string;
    private turnNumber: number = 1;
    private aiPlayers: Map<string, AIPlayer> = new Map();
    private moveHistory: GameAction[] = [];

    constructor(mapSize: number, players: PlayerConfig[], gameId: string, fixedMap?: TileType[][]) {
        this.mapSize = mapSize;
        this._gameId = gameId;
        this.currentPlayerIndex = 0;
        this.map = fixedMap || this.generateMap();
        this.units = [];
        this.moveHistory = [];

        // Store player IDs
        this.players = players.map(p => p.id);

        // Initialize units and AI players
        players.forEach((player, index) => {
            // Initialize units
            const playerUnits = this.initializeUnitsForPlayer(player.id, index);
            this.units.push(...playerUnits);

            // Initialize AI if needed
            if (player.type === PlayerType.AI) {
                this.aiPlayers.set(player.id, new AIPlayer(gameId, player.id));
            }
        });
    }

    public canAddPlayer(): boolean {
        return this.players.length < this.MAX_PLAYERS;
    }

    public addPlayer(player: PlayerConfig): boolean {
        if (this.players.length >= 2 || this.hasPlayer(player.id)) {
            return false;
        }
        this.players.push(player.id);
        const playerUnits = this.initializeUnitsForPlayer(player.id, this.players.length - 1);
        this.units.push(...playerUnits);

        // Initialize AI if needed
        if (player.type === PlayerType.AI) {
            this.aiPlayers.set(player.id, new AIPlayer(this._gameId, player.id));
        }

        return true;
    }

    private initializeUnitsForPlayer(playerId: string, playerIndex: number): Unit[] {
        const isPositionOccupied = (pos: Position): boolean => {
            return this.units.some(unit =>
                unit.position.x === pos.x &&
                unit.position.y === pos.y
            );
        };

        const findValidSpawnPosition = (baseX: number, baseY: number): Position => {
            const visited = new Set<string>();
            const queue: Position[] = [{ x: baseX, y: baseY }];

            while (queue.length > 0) {
                const current = queue.shift()!;
                const posKey = `${current.x},${current.y}`;

                if (visited.has(posKey)) continue;
                visited.add(posKey);

                // Check if current position is valid and not occupied
                if (this.isWithinMapBounds(current) &&
                    getMovementCost(this.map[current.y][current.x]) !== null &&
                    !isPositionOccupied(current)) {
                    return current;
                }

                const neighbors = this.getNeighbors(current);
                for (const neighbor of neighbors) {
                    if (!visited.has(`${neighbor.x},${neighbor.y}`)) {
                        queue.push(neighbor);
                    }
                }
            }
            throw new Error('No valid spawn position found');
        };

        const baseX = playerIndex === 0 ? 5 : this.mapSize - 5;
        const baseY = playerIndex === 0 ? 5 : this.mapSize - 5;

        const units: Unit[] = [];

        // Create and place warrior
        const warriorPos = findValidSpawnPosition(baseX, baseY);
        const warrior = createUnit(UnitType.WARRIOR, playerId, warriorPos);
        units.push(warrior);
        this.units.push(warrior);  // Add to game units immediately

        // Create and place archer
        const archerPos = findValidSpawnPosition(warriorPos.x, warriorPos.y);
        const archer = createUnit(UnitType.ARCHER, playerId, archerPos);
        units.push(archer);

        // Remove warrior from game units (it will be added back with archer when returned)
        this.units.pop();

        return units;
    }

    private generateMap(): TileType[][] {
        const map: TileType[][] = [];

        // Initialize map with grass
        for (let y = 0; y < this.mapSize; y++) {
            map[y] = [];
            for (let x = 0; x < this.mapSize; x++) {
                map[y][x] = TileType.GRASS;
            }
        }

        // Helper function to count specific tile type
        const countTileType = (type: TileType): number => {
            let count = 0;
            for (let y = 0; y < this.mapSize; y++) {
                for (let x = 0; x < this.mapSize; x++) {
                    if (map[y][x] === type) count++;
                }
            }
            return count;
        };

        // Helper function to place connected tile groups
        const placeConnectedTiles = (tileType: TileType, minGroupSize: number): boolean => {
            const startX = Math.floor(Math.random() * this.mapSize);
            const startY = Math.floor(Math.random() * this.mapSize);

            if (map[startY][startX] !== TileType.GRASS) {
                return false;
            }

            // Try to grow a group from this position
            const group: Position[] = [{ x: startX, y: startY }];
            const frontier: Position[] = [];

            // Add initial neighbors
            const directions = startX % 2 === 1
                ? [[-1,0], [-1,1], [0,1], [0,-1], [1,0], [1,1]]
                : [[-1,-1], [-1,0], [0,1], [0,-1], [1,-1], [1,0]];

            for (const [dx, dy] of directions) {
                const newX = startX + dx;
                const newY = startY + dy;
                if (newX >= 0 && newX < this.mapSize &&
                    newY >= 0 && newY < this.mapSize &&
                    map[newY][newX] === TileType.GRASS) {
                    frontier.push({ x: newX, y: newY });
                }
            }

            // Try to grow the group
            while (group.length < minGroupSize && frontier.length > 0) {
                const randomIndex = Math.floor(Math.random() * frontier.length);
                const next = frontier.splice(randomIndex, 1)[0];

                if (map[next.y][next.x] === TileType.GRASS) {
                    group.push(next);

                    // Add new neighbors to frontier
                    for (const [dx, dy] of directions) {
                        const newX = next.x + dx;
                        const newY = next.y + dy;
                        if (newX >= 0 && newX < this.mapSize &&
                            newY >= 0 && newY < this.mapSize &&
                            map[newY][newX] === TileType.GRASS &&
                            !group.some(p => p.x === newX && p.y === newY) &&
                            !frontier.some(p => p.x === newX && p.y === newY)) {
                            frontier.push({ x: newX, y: newY });
                        }
                    }
                }
            }

            if (group.length >= minGroupSize) {
                group.forEach(pos => map[pos.y][pos.x] = tileType);
                return true;
            }

            return false;
        };

        // Place water (20-40% of map)
        const targetWaterPercentage = 20 + Math.random() * 20;
        let attempts = 0;
        while ((countTileType(TileType.WATER) / (this.mapSize * this.mapSize)) * 100 < targetWaterPercentage && attempts < 1000) {
            if (!placeConnectedTiles(TileType.WATER, 3)) {
                attempts++;
            }
        }

        // Place hills (10-20% of map)
        const targetHillsPercentage = 10 + Math.random() * 10;
        attempts = 0;
        while ((countTileType(TileType.HILLS) / (this.mapSize * this.mapSize)) * 100 < targetHillsPercentage && attempts < 1000) {
            if (!placeConnectedTiles(TileType.HILLS, 3)) {
                attempts++;
            }
        }

        // Place forests (10-15% of map)
        const targetForestPercentage = 10 + Math.random() * 5;
        attempts = 0;
        while ((countTileType(TileType.FOREST) / (this.mapSize * this.mapSize)) * 100 < targetForestPercentage && attempts < 1000) {
            if (!placeConnectedTiles(TileType.FOREST, 2)) {
                attempts++;
            }
        }

        return map;
    }

    public getVisibleState(playerId: string): GameState {
        const visibleTiles = this.getVisibleTilesForPlayer(playerId);
        const visibleTilePositions = new Set(
            visibleTiles.map(tile => `${tile.position.x},${tile.position.y}`)
        );

        const visibleUnits = this.units.filter(unit => {
            if (unit.playerId === playerId) return true;
            const unitPos = `${unit.position.x},${unit.position.y}`;
            return visibleTilePositions.has(unitPos);
        });

        return {
            playerId,
            currentPlayerId: this.players[this.currentPlayerIndex],
            players: this.players,
            visibleTiles,
            visibleUnits,
            mapSize: this.mapSize,
            turnNumber: this.turnNumber,
            moveHistory: this.moveHistory
        };
    }

    public isPlayerTurn(playerId: string): boolean {
        return this.players[this.currentPlayerIndex] === playerId;
    }

    public endTurn(): void {
        const currentPlayerId = this.players[this.currentPlayerIndex];
        this.addToHistory({
            type: 'END_TURN',
            playerId: currentPlayerId
        });

        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;

        if (this.currentPlayerIndex === 0) {
            this.turnNumber++;
        }

        // Reset movement points for new player's units
        this.units
            .filter(unit => unit.playerId === currentPlayerId)
            .forEach(resetUnitMovement);

        // If it's an AI's turn, let them play immediately
        const aiPlayer = this.aiPlayers.get(currentPlayerId);
        if (aiPlayer) {
            aiPlayer.takeTurn(this);
        }
    }

    private findPath(start: Position, destination: Position, maxMovement: number): Position[] | null {
        const queue: Array<{ pos: Position; path: Position[]; cost: number }> = [{
            pos: start,
            path: [],
            cost: 0
        }];
        const visited = new Set<string>();

        while (queue.length > 0) {
            const current = queue.shift()!;
            const posKey = `${current.pos.x},${current.pos.y}`;

            if (visited.has(posKey)) continue;
            visited.add(posKey);

            if (current.pos.x === destination.x && current.pos.y === destination.y) {
                return current.path;
            }

            const neighbors = this.getNeighbors(current.pos);
            for (const neighbor of neighbors) {
                if (!this.isWithinMapBounds(neighbor)) continue;

                const terrainCost = getMovementCost(this.map[neighbor.y][neighbor.x]);
                if (terrainCost === null) continue; // Skip impassable terrain

                const newCost = current.cost + terrainCost;
                if (newCost <= maxMovement) {
                    queue.push({
                        pos: neighbor,
                        path: [...current.path, neighbor],
                        cost: newCost
                    });
                }
            }
        }

        return null;
    }

    public moveUnit(unitId: string, destination: Position): { success: boolean, error?: string } {
        const unit = this.units.find(u => u.id === unitId);
        if (!unit) return { success: false, error: 'Unit not found' };
        if (!this.isWithinMapBounds(destination)) return { success: false, error: 'Destination out of bounds' };
        if (!this.isPlayerTurn(unit.playerId)) return { success: false, error: 'Not player turn' };
        if (unit.movementPoints <= 0) return { success: false, error: 'Insufficient movement points' };

        // Check if destination terrain is passable
        const destTerrainCost = getMovementCost(this.map[destination.y][destination.x]);
        if (destTerrainCost === null) return { success: false, error: 'Impassable terrain' };

        // Check if destination is occupied
        if (this.units.some(u => u.position.x === destination.x && u.position.y === destination.y)) {
            return { success: false, error: 'Destination occupied' };
        }

        // Find path considering terrain costs
        const originalPosition = unit.position;
        const path = this.findPath(unit.position, destination, unit.movementPoints);
        if (!path) return { success: false, error: 'No valid path' };
        // Calculate total movement cost along the path
        const movementCost = path.reduce((cost, pos) => {
            const terrainCost = getMovementCost(this.map[pos.y][pos.x]);
            return cost + (terrainCost || 0);
        }, 0);

        // Check if unit has enough movement points
        if (unit.movementPoints < movementCost) return { success: false, error: 'Insufficient movement points' };

        unit.position = destination;
        unit.movementPoints -= movementCost;
        this.addToHistory({
            type: 'MOVE_UNIT',
            playerId: unit.playerId,
            payload: { unitId, from: originalPosition, to: destination }
        });
        return { success: true };
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

    public getNeighbors(hex: Position): Position[] {
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

    public getHexesInRange(center: Position, movementPoints: number): Position[] {
        const visited = new Set<string>();
        const result: Position[] = [];
        const posToKey = (pos: Position) => `${pos.x},${pos.y}`;
        const queue: Array<{ pos: Position, moves: number }> = [
            { pos: center, moves: movementPoints }
        ];

        while (queue.length > 0) {
            const current = queue.shift()!;
            const currentKey = posToKey(current.pos);

            if (visited.has(currentKey)) continue;
            visited.add(currentKey);

            if (current.pos !== center) {
                result.push(current.pos);
            }

            if (current.moves > 0) {
                const neighbors = this.getNeighbors(current.pos);
                for (const neighbor of neighbors) {
                    const neighborKey = posToKey(neighbor);
                    if (!visited.has(neighborKey)) {
                        queue.push({
                            pos: neighbor,
                            moves: current.moves - 1
                        });
                    }
                }
            }
        }

        return result;
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

        // First, add tiles where units are standing
        playerUnits.forEach(unit => {
            visibleTiles.add(`${unit.position.x},${unit.position.y}`);
        });

        // Then add tiles in vision range
        playerUnits.forEach(unit => {
            const tilesInRange = this.getHexesInRange(unit.position, unit.visionRange);
            tilesInRange.forEach(pos => {
                if (this.isWithinMapBounds(pos)) {
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

    public toJSON() {
        const playerConfigs = this.players.map(playerId => ({
            id: playerId,
            type: this.aiPlayers.has(playerId) ? PlayerType.AI : PlayerType.HUMAN
        }));

        return {
            map: this.map,
            units: this.units,
            players: playerConfigs,
            currentPlayerIndex: this.currentPlayerIndex,
            mapSize: this.mapSize,
            turnNumber: this.turnNumber,
            gameId: this._gameId,
            moveHistory: this.moveHistory
        };
    }

    public static fromJSON(data: any): Game {
        const playerConfigs = data.players.map((player: any) => ({
            id: player.id || player, // Handle both new and old format
            type: player.type || PlayerType.HUMAN // Default to HUMAN for old format
        }));

        const game = new Game(
            data.mapSize,
            playerConfigs,
            data.gameId,
            data.map
        );
        game.units = data.units;
        game.currentPlayerIndex = data.currentPlayerIndex;
        game.turnNumber = data.turnNumber;
        game.moveHistory = data.moveHistory || [];
        return game;
    }

    public hasPlayer(playerId: string): boolean {
        return this.players.includes(playerId);
    }

    public getPlayers(): PlayerConfig[] {
        return this.players.map(playerId => ({
            id: playerId,
            type: this.aiPlayers.has(playerId) ? PlayerType.AI : PlayerType.HUMAN
        }));
    }

    private addToHistory(action: Omit<GameAction, 'timestamp'>) {
        const historyItem: GameAction = {
            ...action,
            timestamp: Date.now()
        };
        this.moveHistory.push(historyItem);
    }

    public attackUnit(attackerId: string, targetId: string): { success: boolean; error?: string } {
        const attacker = this.units.find(u => u.id === attackerId);
        const target = this.units.find(u => u.id === targetId);

        if (!attacker || !target) {
            return { success: false, error: 'Unit not found' };
        }

        if (!this.isPlayerTurn(attacker.playerId)) {
            return { success: false, error: 'Not player turn' };
        }

        if (attacker.movementPoints <= 0) {
            return { success: false, error: 'No movement points' };
        }

        if (attacker.playerId === target.playerId) {
            return { success: false, error: 'Cannot attack own unit' };
        }

        // Calculate distance between units
        const distance = getHexDistance(attacker.position, target.position);

        // Check if attack is valid based on unit type and range
        if (!canAttackTarget(attacker, target, distance)) {
            return { success: false, error: 'Target out of range' };
        }

        // Calculate and apply damage based on combat type
        if (isMeleeUnit(attacker)) {
            // Melee combat: both units deal and receive damage
            const damageToTarget = Math.max(0, attacker.attack - target.defense);
            const counterDamage = Math.max(0, target.defense - attacker.defense);

            target.currentHp = Math.max(0, target.currentHp - damageToTarget);
            attacker.currentHp = Math.max(0, attacker.currentHp - counterDamage);
        } else {
            // Ranged combat: only attacker deals damage
            const damageToTarget = Math.max(0, attacker.attack - target.defense);
            target.currentHp = Math.max(0, target.currentHp - damageToTarget);
        }

        // Consume movement points
        attacker.movementPoints = 0;

        // Add to history
        this.addToHistory({
            type: 'ATTACK_UNIT',
            playerId: attacker.playerId,
            payload: {
                unitId: attackerId,
                targetId: targetId
            }
        });

        // Remove dead units
        this.removeDeadUnits();

        return { success: true };
    }

    private removeDeadUnits(): void {
        this.units = this.units.filter(unit => unit.currentHp > 0);
    }
}
