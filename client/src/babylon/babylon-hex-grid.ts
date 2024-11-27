import { Position } from '@shared/types';
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
        // Inverse conversion
        const q = (-x / (this.hexSize * 1.5));
        const column = Math.round(q);
        const oddColumnOffset = Math.abs(column) % 2 === 1 ? this.hexSize * Math.sqrt(3) * 0.5 : 0;
        const r = ((y - oddColumnOffset) / (this.hexSize * Math.sqrt(3)));
        
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
} 