import { Position } from '@shared/types';
import { Vector2 } from '@babylonjs/core';

export class BabylonHexGrid {
    constructor(private hexSize: number) {}

    hexToWorld(hex: Position): Vector2 {
        // Convert axial coordinates to world (pixel) coordinates
        const x = this.hexSize * (3/2 * hex.x);
        const y = this.hexSize * (Math.sqrt(3) * (hex.y + hex.x/2));
        
        return new Vector2(x, y);
    }

    worldToHex(x: number, y: number): Position {
        // Convert world (pixel) coordinates to axial coordinates
        const q = (2/3 * x) / this.hexSize;
        const r = (-1/3 * x + Math.sqrt(3)/3 * y) / this.hexSize;
        
        return this.roundHex({ x: q, y: r });
    }

    private roundHex(hex: { x: number, y: number }): Position {
        // Convert floating point hex coordinates to integer coordinates
        let q = Math.round(hex.x);
        let r = Math.round(hex.y);
        const s = Math.round(-hex.x - hex.y);

        const q_diff = Math.abs(q - hex.x);
        const r_diff = Math.abs(r - hex.y);
        const s_diff = Math.abs(s - (-hex.x - hex.y));

        if (q_diff > r_diff && q_diff > s_diff) {
            q = -r - s;
        } else if (r_diff > s_diff) {
            r = -q - s;
        }

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