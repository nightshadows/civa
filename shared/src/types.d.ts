export declare enum TileType {
    GRASS = "GRASS",
    FOREST = "FOREST",
    HILLS = "HILLS",
    WATER = "WATER"
}
export declare enum UnitType {
    WARRIOR = "WARRIOR",
    ARCHER = "ARCHER"
}
export interface Position {
    x: number;
    y: number;
}
export interface Tile {
    type: TileType;
    position: Position;
}
export interface Unit {
    id: string;
    type: UnitType;
    position: Position;
    playerId: string;
    movementPoints: number;
    visionRange: number;
}
export interface GameState {
    currentPlayerId: string;
    visibleTiles: Tile[];
    visibleUnits: Unit[];
}
export interface GameAction {
    type: 'MOVE_UNIT' | 'END_TURN';
    payload: any;
}
