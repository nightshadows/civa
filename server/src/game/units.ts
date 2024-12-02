import { Position, Unit, UnitType, CombatType } from '@shared/types';

interface UnitTemplate {
    type: UnitType;
    combatType: CombatType;
    movementPoints: number;
    visionRange: number;
    maxHp: number;
    baseAttack: number;
    baseDefense: number;
    expNeededBase: number;
    range?: number;
}

const UNIT_TEMPLATES: Record<UnitType, UnitTemplate> = {
    [UnitType.WARRIOR]: {
        type: UnitType.WARRIOR,
        combatType: CombatType.MELEE,
        movementPoints: 2,
        visionRange: 4,
        maxHp: 60,
        baseAttack: 25,
        baseDefense: 10,
        expNeededBase: 100
    },
    [UnitType.ARCHER]: {
        type: UnitType.ARCHER,
        combatType: CombatType.RANGED,
        movementPoints: 2,
        visionRange: 4,
        maxHp: 40,
        baseAttack: 20,
        baseDefense: 5,
        expNeededBase: 100,
        range: 2
    },
    [UnitType.SETTLER]: {
        type: UnitType.SETTLER,
        combatType: CombatType.NONE,
        movementPoints: 2,
        visionRange: 3,
        maxHp: 30,
        baseAttack: 0,
        baseDefense: 5,
        expNeededBase: 1000
    }
};

export function createUnit(type: UnitType, playerId: string, position: Position): Unit {
    const template = UNIT_TEMPLATES[type];
    return {
        id: `${type.toLowerCase()}-${playerId}`,
        type: template.type,
        combatType: template.combatType,
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
        defense: template.baseDefense,
        range: template.range
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
        }),
        createUnit(UnitType.SETTLER, playerId, {
            x: basePosition.x + 1,
            y: basePosition.y + 1
        })
    ];
}

export function isMeleeUnit(unit: Unit): boolean {
    return unit.combatType === CombatType.MELEE;
}

export function isRangedUnit(unit: Unit): boolean {
    return unit.combatType === CombatType.RANGED;
}

export function canAttackTarget(attacker: Unit, defender: Unit, distance: number): boolean {
    if (isMeleeUnit(attacker)) {
        return distance === 1;
    } else if (isRangedUnit(attacker)) {
        return distance <= (attacker.range || 1);
    }
    return false;
}