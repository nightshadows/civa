import { describe, test, expect } from 'vitest';
import { createUnit, resetUnitMovement } from '../game/units';
import { UnitType } from '@shared/types';

describe('Unit Management', () => {
    const playerId = 'test-player';
    const position = { x: 0, y: 0 };

    describe('createUnit', () => {
        test('should create warrior with correct stats', () => {
            const warrior = createUnit(UnitType.WARRIOR, playerId, position);
            expect(warrior).toMatchObject({
                type: UnitType.WARRIOR,
                playerId,
                position,
                movementPoints: 2,
                visionRange: 4,
                maxHp: 60,
                currentHp: 60,
                level: 1
            });
        });

        test('should create archer with correct stats', () => {
            const archer = createUnit(UnitType.ARCHER, playerId, position);
            expect(archer).toMatchObject({
                type: UnitType.ARCHER,
                playerId,
                position,
                movementPoints: 2,
                visionRange: 4,
                maxHp: 40,
                currentHp: 40,
                level: 1
            });
        });
    });

    describe('resetUnitMovement', () => {
        test('should reset movement points to base value', () => {
            const warrior = createUnit(UnitType.WARRIOR, playerId, position);
            warrior.movementPoints = 0;
            resetUnitMovement(warrior);
            expect(warrior.movementPoints).toBe(2);
        });
    });
});