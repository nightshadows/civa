import { Position } from '@shared/types';

export class View {
    private offsetX: number = 0;
    private offsetY: number = 0;
    private zoom: number = 1;
    public hasBeenCentered: boolean = false;

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
    worldToHex(worldX: number, worldY: number): Position {
        // Convert to axial coordinates first
        const q = (2/3 * worldX) / this.hexSize;
        const r = (-1/3 * worldX + Math.sqrt(3)/3 * worldY) / this.hexSize;

        // Round to nearest hex
        const rx = Math.round(q);
        const ry = Math.round(r);
        const rz = Math.round(-q - r);

        // Fix rounding errors
        let qx = rx, ry_out = ry;
        const q_diff = Math.abs(rx - q);
        const r_diff = Math.abs(ry - r);
        const z_diff = Math.abs(rz - (-q - r));

        if (q_diff > r_diff && q_diff > z_diff) {
            qx = -ry_out - rz;
        } else if (r_diff > z_diff) {
            ry_out = -qx - rz;
        }

        let y = Math.floor(ry_out + (qx + (qx & 1)) / 2);
        if (qx % 2 === 1) {
            y -= 1;
        }

        // Convert to offset coordinates
        return {
            x: qx,
            y: y
        };
    }

    // Convert hex coordinates to world coordinates
    hexToWorld(hex: Position): Position {
        const width = this.hexSize * 2;
        const height = Math.sqrt(3) * this.hexSize;
        return {
            x: hex.x * width * 0.75,
            y: hex.y * height + (hex.x % 2) * height/2
        };
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

    // Update the keyboard movement handlers in GameScene to use fromPan
    moveView(deltaX: number, deltaY: number) {
        const currentPos = this.getPosition();
        this.setPosition(
            currentPos.x + deltaX,
            currentPos.y + deltaY,
        );
    }
}