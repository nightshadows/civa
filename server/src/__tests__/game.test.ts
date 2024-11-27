import { describe, test, expect, beforeEach } from 'vitest';
import { Game } from '../game';
import { Position, TileType, UnitType } from '../../../shared/src/types';
import { getMovementCost } from '../../../shared/src/terrain';

describe('Game', () => {
    const player1Id = 'player1';
    const player2Id = 'player2';
    const mapSize = 12;

    describe('Player Management', () => {
        test('should initialize with one player', () => {
            const game = new Game(mapSize, [player1Id], 'test-game');
            expect(game.canAddPlayer()).toBe(true);
            const state = game.getVisibleState(player1Id);
            expect(state.players).toHaveLength(1);
            expect(state.players[0]).toBe(player1Id);
        });

        test('should allow adding a second player', () => {
            const game = new Game(mapSize, [player1Id], 'test-game');
            game.addPlayer(player2Id);
            expect(game.canAddPlayer()).toBe(false);
            const state = game.getVisibleState(player2Id);
            expect(state.players).toHaveLength(2);
            expect(state.players).toContain(player2Id);
        });

        test('should throw error when adding player to full game', () => {
            const game = new Game(mapSize, [player1Id], 'test-game');
            game.addPlayer(player2Id);
            expect(() => game.addPlayer('player3')).toThrow('Game is full');
        });
    });

    describe('Turn Management', () => {
        test('should start with player1 turn', () => {
            const game = new Game(mapSize, [player1Id], 'test-game');
            game.addPlayer(player2Id);
            expect(game.isPlayerTurn(player1Id)).toBe(true);
            expect(game.isPlayerTurn(player2Id)).toBe(false);
        });

        test('should switch turns correctly', () => {
            const game = new Game(mapSize, [player1Id], 'test-game');
            game.addPlayer(player2Id);
            game.endTurn();
            expect(game.isPlayerTurn(player2Id)).toBe(true);
            expect(game.isPlayerTurn(player1Id)).toBe(false);
        });

        test('should reset unit movement points on turn start', () => {
            const game = new Game(mapSize, [player1Id], 'test-game');
            game.addPlayer(player2Id);
            
            const initialState = game.getVisibleState(player1Id);
            const initialUnit = initialState.visibleUnits.find(u => u.playerId === player1Id);
            
            if (!initialUnit) {
                throw new Error('Initial unit not found');
            }

            const initialMovementPoints = initialUnit.movementPoints;
            
            // Find valid neighbors that are:
            // 1. Adjacent
            // 2. Passable terrain
            // 3. Not occupied
            const validNeighbors = initialState.visibleTiles.filter(tile => {
                const isAdjacent = Math.abs(tile.position.x - initialUnit.position.x) <= 1 &&
                    Math.abs(tile.position.y - initialUnit.position.y) <= 1 &&
                    !(tile.position.x === initialUnit.position.x && tile.position.y === initialUnit.position.y);

                const isPassable = getMovementCost(tile.type) !== null;

                const isOccupied = initialState.visibleUnits.some(u => 
                    u.position.x === tile.position.x && 
                    u.position.y === tile.position.y
                );

                return isAdjacent && isPassable && !isOccupied;
            });

            if (validNeighbors.length === 0) {
                throw new Error('No valid neighbors found for movement');
            }

            const moveResult = game.moveUnit(initialUnit.id, validNeighbors[0].position);
            if (!moveResult.success) {
                throw new Error(`Movement failed: ${moveResult.error}`);
            }

            const stateAfterMove = game.getVisibleState(player1Id);
            const unitAfterMove = stateAfterMove.visibleUnits.find(u => u.id === initialUnit.id);
            expect(unitAfterMove?.movementPoints).toBeLessThan(initialMovementPoints);

            game.endTurn(); // to player2
            game.endTurn(); // back to player1

            const finalState = game.getVisibleState(player1Id);
            const finalUnit = finalState.visibleUnits.find(u => u.id === initialUnit.id);
            expect(finalUnit?.movementPoints).toBe(initialMovementPoints);
        });
    });

    describe('Unit Movement', () => {
        test('should allow valid unit movement', () => {
            const game = new Game(mapSize, [player1Id], 'test-game');
            const state = game.getVisibleState(player1Id);
            const unit = state.visibleUnits.find(u => u.playerId === player1Id);
            
            if (!unit) {
                throw new Error('Unit not found');
            }

            // Find valid destination
            const validNeighbors = state.visibleTiles.filter(tile => {
                const isAdjacent = Math.abs(tile.position.x - unit.position.x) <= 1 &&
                    Math.abs(tile.position.y - unit.position.y) <= 1 &&
                    !(tile.position.x === unit.position.x && tile.position.y === unit.position.y);

                const isPassable = getMovementCost(tile.type) !== null;

                const isOccupied = state.visibleUnits.some(u => 
                    u.position.x === tile.position.x && 
                    u.position.y === tile.position.y
                );

                return isAdjacent && isPassable && !isOccupied;
            });

            if (validNeighbors.length === 0) {
                throw new Error('No valid neighbors found for movement');
            }

            const moveResult = game.moveUnit(unit.id, validNeighbors[0].position);
            expect(moveResult.success).toBe(true);

            const newState = game.getVisibleState(player1Id);
            const movedUnit = newState.visibleUnits.find(u => u.id === unit.id);
            expect(movedUnit?.position).toEqual(validNeighbors[0].position);
        });
    });

    describe('Unit Initialization', () => {
        test('should not spawn units in the same position', () => {
            const game = new Game(mapSize, [player1Id], 'test-game');
            game.addPlayer(player2Id);
            
            const state = game.getVisibleState(player1Id);
            const unitPositions = state.visibleUnits.map(unit => `${unit.position.x},${unit.position.y}`);
            const uniquePositions = new Set(unitPositions);

            expect(uniquePositions.size).toBe(unitPositions.length);
        });
    });
}); 