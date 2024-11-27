import { Position } from '@shared/types';
import { Vector2 } from '@babylonjs/core';

export class BabylonView {
    private offsetX: number = 0;
    private offsetY: number = 0;
    private zoom: number = 1;

    constructor(
        private readonly viewportWidth: number,
        private readonly viewportHeight: number,
        private readonly hexSize: number
    ) {}

    // Convert screen coordinates to hex coordinates
    screenToHex(screenX: number, screenY: number): Position {
        const worldPos = this.screenToWorld(screenX, screenY);
        return this.worldToHex(worldPos.x, worldPos.y);
    }

    // Convert world coordinates to hex coordinates
    worldToHex(x: number, y: number): Position {
        // First handle the x-coordinate (column)
        const q = x / (this.hexSize * -2 * 0.75);
        const column = Math.round(q);
        
        // Calculate the odd column offset
        const oddColumnOffset = Math.abs(column) % 2 === 1 ? this.hexSize * Math.sqrt(3) * 0.5 : 0;
        
        // Now handle the y-coordinate, removing the odd column offset
        const r = (y - oddColumnOffset) / (this.hexSize * Math.sqrt(3));
        
        return this.roundHex({ x: q, y: r });
    }

    // Convert hex coordinates to world coordinates
    hexToWorld(hex: Position): Vector2 {
        const x = this.hexSize * -2 * (hex.x * 0.75);
        const oddColumnOffset = Math.abs(hex.x) % 2 === 1 ? this.hexSize * Math.sqrt(3) * 0.5 : 0;
        const y = this.hexSize * (hex.y * Math.sqrt(3)) + oddColumnOffset;
        
        return new Vector2(x, y);
    }

    // Convert screen coordinates to world coordinates
    screenToWorld(screenX: number, screenY: number): Position {
        return {
            x: (screenX - this.offsetX) / this.zoom,
            y: (screenY - this.offsetY) / this.zoom
        };
    }

    // Convert world coordinates to screen coordinates
    worldToScreen(worldX: number, worldY: number): Position {
        return {
            x: worldX * this.zoom + this.offsetX,
            y: worldY * this.zoom + this.offsetY
        };
    }

    private roundHex(hex: { x: number, y: number }): Position {
        let q = Math.round(hex.x);
        let r = Math.round(hex.y);
        
        return { x: q, y: r };
    }

    // Set initial position
    setPosition(x: number, y: number): void {
        this.offsetX = Math.round(x);
        this.offsetY = Math.round(y);
    }

    // Get current position
    getPosition(): Position {
        return {
            x: this.offsetX,
            y: this.offsetY
        };
    }

    // Center view on a specific world coordinate
    centerOn(worldX: number, worldY: number): void {
        this.offsetX = this.viewportWidth/2 - worldX * this.zoom;
        this.offsetY = this.viewportHeight/2 - worldY * this.zoom;
    }
} 