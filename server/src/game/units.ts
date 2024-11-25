import { Position, Unit, UnitType } from '../../../shared/src/types';

interface UnitTemplate {
    type: UnitType;
    movementPoints: number;
    visionRange: number;
    maxHp: number;
    baseAttack: number;
    baseDefense: number;
    expNeededBase: number;
}

const UNIT_TEMPLATES: Record<UnitType, UnitTemplate> = {
    [UnitType.WARRIOR]: {
        type: UnitType.WARRIOR,
        movementPoints: 2,
        visionRange: 4,
        maxHp: 100,
        baseAttack: 15,
        baseDefense: 10,
        expNeededBase: 100
    },
    [UnitType.ARCHER]: {
        type: UnitType.ARCHER,
        movementPoints: 2,
        visionRange: 4,
        maxHp: 75,
        baseAttack: 20,
        baseDefense: 5,
        expNeededBase: 100
    }
};

export function createUnit(type: UnitType, playerId: string, position: Position): Unit {
    const template = UNIT_TEMPLATES[type];
    return {
        id: `${type.toLowerCase()}-${playerId}`,
        type: template.type,
        position,
        playerId,
        movementPoints: template.movementPoints,
        visionRange: template.visionRange,
        currentHp: template.maxHp,
        maxHp: template.maxHp,
        currentExp: 0,
        expNeeded: template.expNeededBase,
        level: 1,
        attack: template.baseAttack,
        defense: template.baseDefense
    };
}

export function resetUnitMovement(unit: Unit): void {
    const template = UNIT_TEMPLATES[unit.type];
    unit.movementPoints = template.movementPoints;
}

export function getStartingUnits(playerId: string, basePosition: Position): Unit[] {
    return [
        createUnit(UnitType.WARRIOR, playerId, basePosition),
        createUnit(UnitType.ARCHER, playerId, {
            x: basePosition.x,
            y: basePosition.y + 1
        })
    ];
}