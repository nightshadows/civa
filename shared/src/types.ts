export enum TileType {
    GRASS = 'GRASS',
    FOREST = 'FOREST',
    HILLS = 'HILLS',
    WATER = 'WATER',
}

export enum UnitType {
    WARRIOR = 'WARRIOR',
    ARCHER = 'ARCHER',
    SETTLER = 'SETTLER'
}

export enum CombatType {
    MELEE = 'MELEE',
    RANGED = 'RANGED',
    NONE = 'NONE'
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
    combatType: CombatType;
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
    range?: number;
}

export interface CombatStats {
    attack: number;
    defense: number;
    range?: number;
}

export interface GameState {
    playerId: string;
    currentPlayerId: string;
    players: string[];
    visibleTiles: { type: TileType; position: Position }[];
    visibleUnits: Unit[];
    mapSize: number;
    turnNumber: number;
    moveHistory: GameAction[];
    maxPlayers: number;
}

export interface GameAction {
    type: 'MOVE_UNIT' | 'END_TURN' | 'FORTIFY_UNIT' | 'ATTACK_UNIT' | 'UNIT_DIED' | 'SETTLE_CITY';
    playerId: string;
    timestamp: number;
    payload?: {
        unitId?: string;
        targetId?: string;
        from?: Position;
        to?: Position;
        damageDealt?: number;
        damageTaken?: number;
    };
}