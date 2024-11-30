import { Position } from './types';

/**
 * Convert offset coordinates to cube coordinates
 */
export function offsetToCube(hex: Position): { x: number; y: number; z: number } {
    const x = hex.x;
    const z = hex.y - (hex.x + (hex.x & 1)) / 2;
    const y = -x - z;
    return { x, y, z };
}

/**
 * Calculate the distance between two hex tiles using cube coordinates
 */
export function getHexDistance(pos1: Position, pos2: Position): number {
    // Convert to cube coordinates first
    const cube1 = offsetToCube(pos1);
    const cube2 = offsetToCube(pos2);

    // Calculate cube distance
    return Math.max(
        Math.abs(cube1.x - cube2.x),
        Math.abs(cube1.y - cube2.y),
        Math.abs(cube1.z - cube2.z)
    );
}

/**
 * Get the neighbors of a hex tile
 */
export function getNeighbors(hex: Position): Position[] {
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

/**
 * Get the hexes in range of a hex tile
 * This just treats all hexes as passable terrain, it doesnt check for map bounds
 */
export function getHexesInRange(center: Position, movementPoints: number): Position[] {
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
            const neighbors = getNeighbors(current.pos);
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
