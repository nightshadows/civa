import { Position, TileType } from '@shared/types';
import { getMovementCost } from '@shared/terrain';
import { getHexDistance, getNeighbors } from '@shared/hex-utils';

export abstract class BaseHexGrid {
    constructor(protected readonly hexSize: number) {}

    getReachableAndVisibleHexes(center: Position, movementPoints: number, mapSize: { width: number, height: number }, mapData: TileType[][]): Position[] {
        const visited = new Set<string>();
        const result: Position[] = [];
        const queue: Array<{ pos: Position; cost: number }> = [
            { pos: center, cost: 0 }
        ];

        while (queue.length > 0) {
            const current = queue.shift()!;
            const posKey = `${current.pos.x},${current.pos.y}`;

            if (visited.has(posKey)) continue;
            visited.add(posKey);

            result.push(current.pos);

            const neighbors = getNeighbors(current.pos);
            for (const neighbor of neighbors) {
                if (neighbor.x < 0 || neighbor.x >= mapSize.width ||
                    neighbor.y < 0 || neighbor.y >= mapSize.height) continue;

                const terrainType = mapData[neighbor.y]?.[neighbor.x];
                const terrainCost = getMovementCost(terrainType);
                if (terrainCost === null) continue; // Skip impassable or invisible terrain

                const newCost = current.cost + terrainCost;
                if (newCost <= movementPoints) {
                    queue.push({
                        pos: neighbor,
                        cost: newCost
                    });
                }
            }
        }

        return result;
    }
}