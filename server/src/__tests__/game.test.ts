import { describe, test, expect, beforeEach } from 'vitest';
import { Game } from '../game';
import { GameState, Position, TileType, Unit, UnitType } from '../../../shared/src/types';
import { getMovementCost } from '../../../shared/src/terrain';

describe('Game', () => {
    const player1Id = 'player1';
    const player2Id = 'player2';
    const mapSize = 12;

    let game: Game;

    beforeEach(() => {
        game = new Game(mapSize, [player1Id], 'test-game');
    });

    describe('Player Management', () => {
        test('should initialize with one player', () => {
            const state = game.getVisibleState(player1Id);
            expect(game.canAddPlayer()).toBe(true);
            expect(state.players).toEqual([player1Id]);
        });

        test('should handle second player correctly', () => {
            game.addPlayer(player2Id);
            const state = game.getVisibleState(player2Id);
            
            expect(game.canAddPlayer()).toBe(false);
            expect(state.players).toEqual([player1Id, player2Id]);
        });

        test('should prevent adding third player', () => {
            game.addPlayer(player2Id);
            expect(() => game.addPlayer('player3')).toThrow('Game is full');
        });
    });

    describe('Turn Management', () => {
        beforeEach(() => {
            game.addPlayer(player2Id);
        });

        test('should start with player1 turn', () => {
            expect(game.isPlayerTurn(player1Id)).toBe(true);
            expect(game.isPlayerTurn(player2Id)).toBe(false);
        });

        test('should switch turns correctly', () => {
            game.endTurn();
            expect(game.isPlayerTurn(player2Id)).toBe(true);
            expect(game.isPlayerTurn(player1Id)).toBe(false);
        });

        test('should reset unit movement points on turn start', () => {
            const state = game.getVisibleState(player1Id);
            const unit = state.visibleUnits.find(u => u.playerId === player1Id);
            expect(unit).toBeDefined();

            if (!unit) return;

            const initialPoints = unit.movementPoints;
            const validMove = findValidMove(state, unit);
            expect(validMove).toBeDefined();

            if (!validMove) return;

            const moveResult = game.moveUnit(unit.id, validMove);
            expect(moveResult.success).toBe(true);

            // Complete turn cycle
            game.endTurn();  // to player2
            game.endTurn();  // back to player1

            const finalUnit = game.getVisibleState(player1Id)
                .visibleUnits.find(u => u.id === unit.id);
            expect(finalUnit?.movementPoints).toBe(initialPoints);
        });
    });

    describe('Unit Management', () => {
        test('should not spawn units in the same position', () => {
            game.addPlayer(player2Id);
            const state = game.getVisibleState(player1Id);
            const positions = new Set(
                state.visibleUnits.map(u => `${u.position.x},${u.position.y}`)
            );
            expect(positions.size).toBe(state.visibleUnits.length);
        });

        test('should allow valid unit movement', () => {
            const state = game.getVisibleState(player1Id);
            const unit = state.visibleUnits.find(u => u.playerId === player1Id);
            expect(unit).toBeDefined();

            if (!unit) return;

            const validMove = findValidMove(state, unit);
            expect(validMove).toBeDefined();

            if (!validMove) return;

            const moveResult = game.moveUnit(unit.id, validMove);
            expect(moveResult.success).toBe(true);

            const movedUnit = game.getVisibleState(player1Id)
                .visibleUnits.find(u => u.id === unit.id);
            expect(movedUnit?.position).toEqual(validMove);
        });
    });
});

// Helper function to find a valid move for a unit
function findValidMove(state: GameState, unit: Unit): Position | undefined {
    return state.visibleTiles.find(tile => {
        const isAdjacent = Math.abs(tile.position.x - unit.position.x) <= 1 &&
            Math.abs(tile.position.y - unit.position.y) <= 1 &&
            !(tile.position.x === unit.position.x && tile.position.y === unit.position.y);

        const isPassable = getMovementCost(tile.type) !== null;

        const isOccupied = state.visibleUnits.some(u => 
            u.position.x === tile.position.x && 
            u.position.y === tile.position.y
        );

        return isAdjacent && isPassable && !isOccupied;
    })?.position;
} 