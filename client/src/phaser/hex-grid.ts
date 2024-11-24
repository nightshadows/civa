import { Position } from '@shared/types';

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
    getHexesInRange(center: Position, movementPoints: number, mapSize: number): Position[] {
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

            if (current.distance <= movementPoints) {
                // Don't add the center position to results
                if (current.distance > 0) {
                    results.push(current.pos);
                }

                // Get neighbors using cube coordinates for accurate hex distance
                const neighbors = this.getNeighbors(current.pos);
                for (const neighbor of neighbors) {
                    // Check map bounds
                    if (neighbor.x >= 0 && neighbor.x < mapSize && 
                        neighbor.y >= 0 && neighbor.y < mapSize) {
                        if (!visited.has(`${neighbor.x},${neighbor.y}`)) {
                            queue.push({
                                pos: neighbor,
                                distance: current.distance + 1
                            });
                        }
                    }
                }
            }
        }

        return results;
    }
}