import { Position } from '@shared/types';

export class HexGrid {
    constructor() {}

    // Get the distance between two hex coordinates
    getHexDistance(a: Position, b: Position): number {
        return Math.max(
            Math.abs(a.x - b.x),
            Math.abs(a.y - b.y),
            Math.abs((a.x + a.y) - (b.x + b.y))
        );
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
        const visited = new Set<string>();
        const result: Position[] = [];
        const posToKey = (pos: Position) => `${pos.x},${pos.y}`;
        const queue: Array<{ pos: Position, moves: number }> = [
            { pos: center, moves: movementPoints }
        ];

        const isWithinBounds = (pos: Position) =>
            pos.x >= 0 && pos.x < mapSize && pos.y >= 0 && pos.y < mapSize;

        while (queue.length > 0) {
            const current = queue.shift()!;
            const currentKey = posToKey(current.pos);

            if (visited.has(currentKey)) continue;
            if (!isWithinBounds(current.pos)) continue;

            visited.add(currentKey);
            if (current.pos !== center) {
                result.push(current.pos);
            }

            if (current.moves > 0) {
                const neighbors = this.getNeighbors(current.pos);
                for (const neighbor of neighbors) {
                    const neighborKey = posToKey(neighbor);
                    if (!visited.has(neighborKey) && isWithinBounds(neighbor)) {
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
}