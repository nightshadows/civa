import { describe, test, expect, beforeEach } from 'vitest';
import { Game } from '../game';
import { GameState, Position, TileType, Unit } from '../../../shared/src/types';
import { getMovementCost } from '../../../shared/src/terrain';

describe('Game', () => {
    const player1Id = 'player1';
    const player2Id = 'player2';
    const mapSize = 5;
    
    // Simple fixed map for testing:
    // 0 = GRASS (passable)
    // 1 = FOREST (passable but costly)
    // 2 = HILLS (passable but costly)
    // 9 = WATER (impassable)
    const fixedMap: TileType[][] = [
        [0, 0, 0, 0, 0],
        [0, 1, 2, 9, 0],
        [0, 0, 0, 0, 0],
        [0, 9, 1, 2, 0],
        [0, 0, 0, 0, 0],
    ].map(row => row.map(cell => 
        cell === 0 ? TileType.GRASS :
        cell === 1 ? TileType.FOREST :
        cell === 2 ? TileType.HILLS :
        TileType.WATER
    ));

    let game: Game;

    beforeEach(() => {
        game = new Game(mapSize, [player1Id], 'test-game', fixedMap);
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
            const validMove = findValidMove(game, unit);
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

            const validMove = findValidMove(game, unit);
            expect(validMove).toBeDefined();

            if (!validMove) return;

            const moveResult = game.moveUnit(unit.id, validMove);
            expect(moveResult.success).toBe(true);

            const movedUnit = game.getVisibleState(player1Id)
                .visibleUnits.find(u => u.id === unit.id);
            expect(movedUnit?.position).toEqual(validMove);
        });

        test('should not allow unit movement onto impassable terrain', () => {
            const state = game.getVisibleState(player1Id);
            const unit = state.visibleUnits.find(u => u.playerId === player1Id);
            expect(unit).toBeDefined();

            if (!unit) return;

            // Find an impassable tile adjacent to the unit
            const impassableTile = game.getNeighbors(unit.position).find(pos => {
                if (pos.x < 0 || pos.x >= game.map[0].length || 
                    pos.y < 0 || pos.y >= game.map.length) {
                    return false;
                }
                const isImpassable = getMovementCost(game.map[pos.y][pos.x]) === null;
                return isImpassable;
            });

            expect(impassableTile).toBeDefined();

            if (!impassableTile) return;

            // Attempt to move the unit onto the impassable tile
            const moveResult = game.moveUnit(unit.id, impassableTile);
            expect(moveResult.success).toBe(false);
            expect(moveResult.error).toBe('Impassable terrain');
        });
    });
});

// Helper function to find a valid move for a unit
function findValidMove(game: Game, unit: Unit): Position | undefined {
    return game.getHexesInRange(unit.position, 1).find(pos => {
        // Check if position is within map bounds
        if (pos.x < 0 || pos.x >= game.map[0].length || 
            pos.y < 0 || pos.y >= game.map.length) {
            return false;
        }
        
        const isPassable = getMovementCost(game.map[pos.y][pos.x]) !== null;
        const isOccupied = game.units.some(u => u.position.x === pos.x && u.position.y === pos.y);
        return isPassable && !isOccupied;
    });
} 