import { Position, TileType } from '@shared/types';
import { Vector2 } from '@babylonjs/core';

export class BabylonHexGrid {
    constructor(private hexSize: number) {}

    hexToWorld(hex: Position): Vector2 {
        // Using offset coordinates with odd column offset
        const x = this.hexSize * -2 * (hex.x * 0.75);
        
        // Add vertical offset for odd columns
        const oddColumnOffset = Math.abs(hex.x) % 2 === 1 ? this.hexSize * Math.sqrt(3) * 0.5 : 0;
        const y = this.hexSize * (hex.y * Math.sqrt(3)) + oddColumnOffset;
        
        return new Vector2(x, y);
    }

    worldToHex(x: number, y: number): Position {
        // First handle the x-coordinate (column)
        const q = x / (this.hexSize * -2 * 0.75);
        const column = Math.round(q);
        
        // Calculate the odd column offset just like in hexToWorld
        const oddColumnOffset = Math.abs(column) % 2 === 1 ? this.hexSize * Math.sqrt(3) * 0.5 : 0;
        
        // Now handle the y-coordinate, removing the odd column offset
        const r = (y - oddColumnOffset) / (this.hexSize * Math.sqrt(3));
        
        return this.roundHex({ x: q, y: r });
    }

    private roundHex(hex: { x: number, y: number }): Position {
        let q = Math.round(hex.x);
        let r = Math.round(hex.y);
        
        return { x: q, y: r };
    }

    getHexCorners(center: Vector2): Vector2[] {
        const corners: Vector2[] = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            corners.push(new Vector2(
                center.x + this.hexSize * Math.cos(angle),
                center.y + this.hexSize * Math.sin(angle)
            ));
        }
        return corners;
    }

    getHexesInRange(center: Position, movementPoints: number, mapSize: { width: number, height: number }, mapData: TileType[][]): Position[] {
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
                if (neighbor.x < 0 || neighbor.x >= mapSize.width ||
                    neighbor.y < 0 || neighbor.y >= mapSize.height) continue;

                const terrainType = mapData[neighbor.y]?.[neighbor.x];
                const terrainCost = this.getMovementCost(terrainType);
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

    private getMovementCost(tileType: TileType): number | null {
        switch (tileType) {
            case TileType.GRASS:
                return 1;
            case TileType.FOREST:
                return 2;
            case TileType.HILLS:
                return 3;
            case TileType.WATER:
                return null; // Impassable
            default:
                return null;
        }
    }
} 