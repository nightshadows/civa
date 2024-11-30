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