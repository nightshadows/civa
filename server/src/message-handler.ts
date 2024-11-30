import { Position } from "../../shared/src/types";
import { Game } from "./game";
import { PlayerType, PlayerConfig } from "./game/player-types";
import { WebSocketManager } from "./websocket/websocket-manager";

export type GameAction = {
  type: 'MOVE_UNIT' | 'END_TURN' | 'FORTIFY_UNIT' | 'ATTACK_UNIT';
  payload?: {
    unitId?: string;
    targetId?: string;
    destination?: Position;
  };
};

export type GameMessage = {
  type: 'join_game' | 'action' | 'game_state' | 'error';
  gameId?: string;
  playerId?: string;
  action?: GameAction;
  state?: any;  // Replace 'any' with your actual game state type
  message?: string;
  games?: string[];  // Add this for the games list response
};

export function createErrorMessage(message: string): GameMessage {
  return {
    type: 'error',
    message
  };
}

export function createGameStateMessage(state: any): GameMessage {
  return {
    type: 'game_state',
    state
  };
}

export function handleGameAction(
  game: Game,
  playerId: string,
  action: GameAction
): { success: boolean; error?: string } {
  console.log('Handling action:', action, 'for player:', playerId);
  if (!game.isPlayerTurn(playerId)) {
    return { success: false, error: 'Not your turn' };
  }

  switch (action.type) {
    case 'MOVE_UNIT':
      if (!action.payload?.unitId || !action.payload?.destination) {
        return { success: false, error: 'Invalid payload' };
      }
      return game.moveUnit(action.payload.unitId, action.payload.destination);

    case 'ATTACK_UNIT':
      if (!action.payload?.unitId || !action.payload?.targetId) {
        return { success: false, error: 'Invalid payload' };
      }
      return game.attackUnit(action.payload.unitId, action.payload.targetId);

    case 'FORTIFY_UNIT':
      if (!action.payload?.unitId) {
        return { success: false, error: 'Invalid payload' };
      }
      return { success: game.fortifyUnit(action.payload.unitId) };

    case 'END_TURN':
      game.endTurn();
      return { success: true };

    default:
      return { success: false, error: 'Invalid action type' };
  }
}

export interface GameWebSocket {
  send(data: string): void;
  readyState: number;
}

export interface GameWebSocketServer {
  clients: Set<GameWebSocket>;
}

export interface GameManager {
  games: Map<string, Game>;
  playerSessions: Map<string, string>;  // playerId -> gameId
}

export function broadcastGameState(
  game: Game,
  wsManager: WebSocketManager
) {
  console.log(`[broadcastGameState] Starting broadcast for game ${game.gameId}`);
  const players = game.getPlayers();
  console.log(`[broadcastGameState] Total players: ${players.length}`);

  let broadcastCount = 0;
  let skippedCount = 0;

  players.forEach(player => {
    const ws = wsManager.getSocketFromPlayer(player.id);
    if (ws?.readyState === 1) { // WebSocket.OPEN
      const playerState = game.getVisibleState(player.id);
      console.log(`[broadcastGameState] Sending state to player ${player.id}:`, {
        turnNumber: playerState.turnNumber,
        currentPlayer: playerState.currentPlayerId,
        visibleUnits: playerState.visibleUnits.length,
        moveHistoryLength: playerState.moveHistory.length
      });

      ws.send(JSON.stringify(createGameStateMessage(playerState)));
      broadcastCount++;
    } else {
      console.log(`[broadcastGameState] Skipping player ${player.id} - socket not open (state: ${ws?.readyState})`);
      skippedCount++;
    }
  });

  console.log(`[broadcastGameState] Broadcast complete:`, {
    successful: broadcastCount,
    skipped: skippedCount,
    total: players.length
  });
}

export function handleJoinGame(
  data: GameMessage,
  gameManager: GameManager
): { game: Game | null; error?: string } {
  let gameId = data.gameId!;
  const playerId = data.playerId!;

  // Clear any existing player session
  const oldGameId = gameManager.playerSessions.get(playerId);
  if (oldGameId && oldGameId !== gameId) {
    console.log(`Player ${playerId} switching from game ${oldGameId} to ${gameId}`);
  }

  const game = gameManager.games.get(gameId)!;
  if (!game.hasPlayer(playerId)) {
    if (game.canAddPlayer()) {
      game.addPlayer({ id: playerId, type: PlayerType.HUMAN });
      gameManager.playerSessions.set(playerId, gameId);
      console.log(`Added player ${playerId} to game ${gameId}`);
    } else {
      return { game: null, error: 'Game is full' };
    }
  } else {
    gameManager.playerSessions.set(playerId, gameId);
    console.log(`Updated session for player ${playerId} in game ${gameId}`);
  }

  return { game };
}

export function handleGameMessage(
  data: GameMessage,
  ws: GameWebSocket,
  wsManager: WebSocketManager,
  gameManager: GameManager
): { game?: Game | null; error?: string } {
  switch (data.type) {
    case 'join_game': {
      const result = handleJoinGame(data, gameManager);
      if (result.error) {
        ws.send(JSON.stringify(createErrorMessage(result.error)));
        return { error: result.error };
      }
      if (result.game) {
        broadcastGameState(result.game, wsManager);
        return { game: result.game };
      }
      break;
    }

    case 'action': {
      const playerId = data.playerId!;
      const gameId = gameManager.playerSessions.get(playerId);
      console.log('Action from player:', playerId, 'in game:', gameId);

      if (!gameId) {
        console.error('No game session found for player:', playerId);
        ws.send(JSON.stringify(createErrorMessage('No active game session')));
        return { error: 'No game session' };
      }

      const game = gameManager.games.get(gameId);
      if (!game) {
        console.error('Game not found:', gameId);
        return { error: 'Game not found' };
      }

      const result = handleGameAction(game, playerId, data.action!);
      if (result.success) {
        broadcastGameState(game, wsManager);
        return { game };
      } else {
        ws.send(JSON.stringify(createErrorMessage(result.error!)));
        return { error: result.error };
      }
    }

    default:
      return { error: 'Unknown message type' };
  }
  return {};
}

export function getPlayerIdFromWs(ws: GameWebSocket, sessions: Map<string, GameWebSocket>): string | null {
  for (const [playerId, socket] of sessions.entries()) {
    if (socket === ws) return playerId;
  }
  return null;
}

