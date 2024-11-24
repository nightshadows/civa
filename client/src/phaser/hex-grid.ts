import { Position } from '@shared/types';

export class HexGrid {
    private hexSize: number;

    constructor(hexSize: number) {
        this.hexSize = hexSize;
    }

    // Convert hex coordinates to pixel coordinates
    hexToPixel(hex: Position): { x: number, y: number } {
        const width = this.hexSize * 2;
        const height = Math.sqrt(3) * this.hexSize;

        return {
            x: hex.x * width * 0.75,
            y: hex.y * height + (hex.x % 2) * height/2
        };
    }

    // Get the distance between two hex coordinates
    getHexDistance(a: Position, b: Position): number {
        // Using axial coordinates distance formula
        return Math.max(
            Math.abs(a.x - b.x),
            Math.abs(a.y - b.y),
            Math.abs((a.x + a.y) - (b.x + b.y))
        );
    }

    // Get the direct neighbors of a hex
    getNeighbors(hex: Position): Position[] {
        // Different directions based on whether the column (x) is even or odd
        const directions = hex.x % 2 === 1
            ? [
                { x: -1, y: 0 },     // top left
                { x: -1, y: +1 },   // top right
                { x: 0, y: +1 },     // right
                { x: 0, y: -1 },     // left
                { x: 1, y: 0 },     // bottom left
                { x: 1, y: +1 }    // bottom right
            ]
            : [
                { x: -1, y: -1 },   // top left
                { x: -1, y: 0 },     // top right
                { x: 0, y: +1 },     // right
                { x: 0, y: -1 },     // left
                { x: +1, y: -1 },   // bottom left
                { x: +1, y: 0 }      // bottom right
            ];

        return directions.map(dir => ({
            x: hex.x + dir.x,
            y: hex.y + dir.y
        }));
    }

    // Get all hexes reachable within given movement points
    getHexesInRange(center: Position, movementPoints: number): Position[] {
        const visited = new Set<string>();
        const result: Position[] = [];

        // Helper function to create a unique key for a position
        const posToKey = (pos: Position) => `${pos.x},${pos.y}`;

        // Queue entries contain position and remaining movement points
        const queue: Array<{ pos: Position, moves: number }> = [
            { pos: center, moves: movementPoints }
        ];

        while (queue.length > 0) {
            const current = queue.shift()!;
            const currentKey = posToKey(current.pos);

            // Skip if we've already visited this hex
            if (visited.has(currentKey)) continue;

            // Mark as visited and add to result
            visited.add(currentKey);
            if (current.pos !== center) {  // Don't add the center hex
                result.push(current.pos);
            }

            // If we have moves remaining, add neighbors to queue
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

    // Convert pixel coordinates to hex coordinates (approximate)
    pixelToHex(x: number, y: number): Position {
        const width = this.hexSize * 2;
        const height = Math.sqrt(3) * this.hexSize;

        // Rough approximation - you might want to improve this for better accuracy
        const col = Math.round(x / (width * 0.75));
        const row = Math.round((y - (col % 2) * height/2) / height);

        return { x: col, y: row };
    }
}