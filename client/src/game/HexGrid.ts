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

    // Get all hex coordinates within range of a position
    getHexesInRange(center: Position, range: number): Position[] {
        const hexes: Position[] = [];
        
        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                const newPos = { 
                    x: center.x + dx, 
                    y: center.y + dy 
                };
                
                // Calculate Manhattan distance for hex grid
                const distance = Math.abs(dx) + Math.abs(dy);
                if (distance <= range) {
                    hexes.push(newPos);
                }
            }
        }
        
        return hexes;
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