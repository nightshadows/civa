import { Game } from './index';
import { Position, Unit } from '@shared/types';
import { getHexDistance, getNeighbors } from '@shared/hex-utils';
import { getMovementCost } from '@shared/terrain';

export class AIPlayer {
    private gameId: string;
    private playerId: string;

    constructor(gameId: string, playerId: string) {
        this.gameId = gameId;
        this.playerId = playerId;
    }

    public takeTurn(game: Game): void {
        console.log(`AI player ${this.playerId} taking turn in game ${this.gameId}`);

        try {
            // Get game state from AI's perspective
            const gameState = game.getVisibleState(this.playerId);
            const myUnits = gameState.visibleUnits.filter(u => u.playerId === this.playerId);
            const enemyUnits = gameState.visibleUnits.filter(u => u.playerId !== this.playerId);

            // Process each unit that can still move
            for (const unit of myUnits) {
                if (unit.movementPoints <= 0) continue;

                // Find nearest enemy unit
                let nearestEnemy: Unit | null = null;
                let shortestDistance = Infinity;

                for (const enemy of enemyUnits) {
                    const distance = getHexDistance(unit.position, enemy.position);
                    if (distance < shortestDistance) {
                        shortestDistance = distance;
                        nearestEnemy = enemy;
                    }
                }

                if (nearestEnemy) {
                    // If enemy is in attack range, attack it
                    if (this.canAttack(unit, nearestEnemy, shortestDistance)) {
                        game.attackUnit(unit.id, nearestEnemy.id);
                        continue;
                    }

                    // If enemy is visible but not in range, move towards it
                    const path = this.findPathTowards(unit, nearestEnemy.position, gameState.visibleTiles);
                    if (path) {
                        // Move as far along the path as we can with our movement points
                        for (const pos of path) {
                            const moveResult = game.moveUnit(unit.id, pos);
                            if (!moveResult.success) break;
                        }
                    }
                }
            }

            // End turn after all units have moved
            game.endTurn();
            console.log(`AI player ${this.playerId} ended their turn`);
        } catch (error) {
            console.error(`Error during AI turn:`, error);
            game.endTurn(); // End turn even if there's an error
        }
    }

    private canAttack(attacker: Unit, target: Unit, distance: number): boolean {
        if (attacker.movementPoints <= 0) return false;

        if (attacker.combatType === 'MELEE') {
            return distance === 1;
        } else if (attacker.combatType === 'RANGED') {
            return distance <= (attacker.range || 1);
        }
        return false;
    }

    private findPathTowards(unit: Unit, targetPos: Position, tiles: { type: string; position: Position }[]): Position[] {
        // Create a map of passable tiles
        const tileMap = new Map<string, boolean>();
        tiles.forEach(tile => {
            const cost = getMovementCost(tile.type as any);
            tileMap.set(`${tile.position.x},${tile.position.y}`, cost !== null);
        });

        // Simple breadth-first search to find a path
        const queue: Array<{ pos: Position; path: Position[] }> = [
            { pos: unit.position, path: [] }
        ];
        const visited = new Set<string>();

        while (queue.length > 0) {
            const current = queue.shift()!;
            const posKey = `${current.pos.x},${current.pos.y}`;

            if (visited.has(posKey)) continue;
            visited.add(posKey);

            // If we've found a path to the target, return the first step
            if (current.pos.x === targetPos.x && current.pos.y === targetPos.y) {
                return current.path;
            }

            // Check all neighbors
            const neighbors = getNeighbors(current.pos);
            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.x},${neighbor.y}`;
                if (!visited.has(neighborKey) && tileMap.get(neighborKey)) {
                    queue.push({
                        pos: neighbor,
                        path: [...current.path, neighbor]
                    });
                }
            }
        }

        return [];
    }
}