import { TileType } from './types';

export const TERRAIN_MOVEMENT_COSTS: Record<TileType, number | null> = {
    [TileType.GRASS]: 1,
    [TileType.FOREST]: 2,
    [TileType.WATER]: null,  // null means impassable
    [TileType.HILLS]: null   // null means impassable
};

export function getMovementCost(tileType: TileType): number | null {
    return TERRAIN_MOVEMENT_COSTS[tileType];
}

export function isPassable(tileType: TileType): boolean {
    return TERRAIN_MOVEMENT_COSTS[tileType] !== null;
}