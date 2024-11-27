import { Vector2 } from '@babylonjs/core';
import { BaseHexGrid } from '../hex-grid';

export class BabylonHexGrid extends BaseHexGrid {
    constructor(hexSize: number) {
        super(hexSize);
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