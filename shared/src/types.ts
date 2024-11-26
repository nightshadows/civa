export enum TileType {
    GRASS = 'GRASS',
    FOREST = 'FOREST',
    HILLS = 'HILLS',
    WATER = 'WATER',
}

export enum UnitType {
    WARRIOR = 'WARRIOR',
    ARCHER = 'ARCHER',
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
    currentHp: number;
    maxHp: number;
    currentExp: number;
    expNeeded: number;
    level: number;
    attack: number;
    defense: number;
}

export interface GameState {
    playerId: string;
    currentPlayerId: string;
    players: string[];
    visibleTiles: { type: TileType; position: Position }[];
    visibleUnits: Unit[];
    mapSize: number;
    turnNumber: number;
}

export interface GameAction {
    type: 'MOVE_UNIT' | 'END_TURN';
    payload: MoveUnitPayload | null;
}

export interface MoveUnitPayload {
    unitId: string;
    destination: Position;
}