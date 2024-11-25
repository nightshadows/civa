import { Position } from '@shared/types';
import { getMovementCost } from '@shared/terrain';

export class HexGrid {
    private readonly hexSize: number;

    constructor(hexSize: number) {
        this.hexSize = hexSize;
    }

    // Get the distance between two hex coordinates using cube coordinates
    getHexDistance(a: Position, b: Position): number {
        const ac = this.offsetToCube(a);
        const bc = this.offsetToCube(b);

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

    // Get the direct neighbors of a hex
    getNeighbors(hex: Position): Position[] {
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

    // Get all hexes reachable within given movement points
    getHexesInRange(center: Position, movementPoints: number, mapSize: number, map: TileType[][]): Position[] {
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

            const neighbors = this.getNeighbors(current.pos);
            for (const neighbor of neighbors) {
                if (neighbor.x < 0 || neighbor.x >= mapSize ||
                    neighbor.y < 0 || neighbor.y >= mapSize) continue;

                const terrainCost = getMovementCost(map[neighbor.y][neighbor.x]);
                if (terrainCost === null) continue; // Skip impassable terrain

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