import { Position } from './types';

/**
 * Calculate the distance between two hex tiles using cube coordinates
 */
export function getHexDistance(pos1: Position, pos2: Position): number {
    // use the modified bfs to find the distance
    // search from the pos where x coordiante is not greater than other
    // while searching, the x coordinate can not decrease
    // while searching, the y coordinate can not become lower than minY - 1 or greater than maxY + 1

    if (pos1.x === pos2.x && pos1.y === pos2.y) {
        return 0;
    }

    if (pos1.x > pos2.x) {
        [pos1, pos2] = [pos2, pos1];
    }

    const minY = Math.min(pos1.y, pos2.y) - 1;
    const maxY = Math.max(pos1.y, pos2.y) + 1;

    const visited = new Set<string>();
    const queue: Array<{ pos: Position, distance: number }> = [
        { pos: pos1, distance: 0 }
    ];

    while (queue.length > 0) {
        const current = queue.shift()!;
        if (current.pos.x === pos2.x && current.pos.y === pos2.y) {
            return current.distance;
        }

        const neighbors = getNeighbors(current.pos);
        for (const neighbor of neighbors) {
            if (neighbor.x < current.pos.x) continue;
            if (neighbor.y < minY || neighbor.y > maxY) continue;
            const neighborKey = `${neighbor.x},${neighbor.y}`;
            if (visited.has(neighborKey)) continue;
            visited.add(neighborKey);
            queue.push({ pos: neighbor, distance: current.distance + 1 });
        }
    }

    return Infinity;
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
