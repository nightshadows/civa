import { Game } from "./game";
import { PlayerType, PlayerConfig } from "./game/player-types";

export type GameAction = {
  type: 'MOVE_UNIT' | 'END_TURN';
  payload?: {
    unitId?: string;
    destination?: any;  // Replace 'any' with your actual destination type
  };
};

export type GameMessage = {
  type: 'join_game' | 'action' | 'game_state' | 'error' | 'list_games' | 'games_list' | 'create_game';
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

export function createGamesListMessage(games: string[]): GameMessage {
  return {
    type: 'games_list',
    games
  };
}

export function handleGameAction(
  game: any,  // Replace 'any' with your Game type
  playerId: string,
  action: GameAction
): { success: boolean; error?: string } {
  console.log('Handling action:', action, 'for player:', playerId);
  if (!game.isPlayerTurn(playerId)) {
    return { success: false, error: 'Not your turn' };
  }

  if (action.type === 'MOVE_UNIT' && action.payload) {
    const success = game.moveUnit(
      action.payload.unitId,
      action.payload.destination
    );
    return {
      success,
      error: success ? undefined : 'Invalid move'
    };
  } else if (action.type === 'END_TURN') {
    game.endTurn();
    return { success: true };
  }

  return { success: false, error: 'Invalid action type' };
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
  sessions: Map<string, GameWebSocket>  // Always playerId -> WebSocket
) {
  sessions.forEach((ws, playerId) => {
    if (ws.readyState === 1) { // WebSocket.OPEN
      const playerState = game.getVisibleState(playerId);
      ws.send(JSON.stringify(createGameStateMessage(playerState)));
    }
  });
}

export function handleJoinGame(
  data: GameMessage,
  ws: GameWebSocket,
  sessions: Map<string, GameWebSocket>,
  gameManager: GameManager
): { game: Game | null; error?: string } {
  let gameId = data.gameId;
  const playerId = data.playerId!;

  // If no gameId specified, get the last created game
  if (!gameId) {
    const gameIds = Array.from(gameManager.games.keys());
    if (gameIds.length > 0) {
      gameId = gameIds[gameIds.length - 1];
    } else {
      gameId = 'default';
    }
  }

  // Update session
  sessions.set(playerId, ws);

  // Clear any existing player session
  const oldGameId = gameManager.playerSessions.get(playerId);
  if (oldGameId && oldGameId !== gameId) {
    console.log(`Player ${playerId} switching from game ${oldGameId} to ${gameId}`);
  }

  // Handle joining game
  if (!gameManager.games.has(gameId)) {
    const players: PlayerConfig[] = [
      { id: playerId, type: PlayerType.HUMAN }
    ];
    const newGame = new Game(12, players, gameId);
    gameManager.games.set(gameId, newGame);
    gameManager.playerSessions.set(playerId, gameId);
    console.log(`Created new game ${gameId} for player ${playerId}`);
    return { game: newGame };
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

export function getAvailableGames(
  gameManager: GameManager,
  playerId?: string
): string[] {
  return Array.from(gameManager.games.entries())
    .filter(([_, game]) =>
      game.canAddPlayer() || (playerId && game.hasPlayer(playerId))
    )
    .map(([gameId]) => gameId);
}

export function handleGameMessage(
  data: GameMessage,
  ws: GameWebSocket,
  sessions: Map<string, GameWebSocket>,  // Always playerId -> WebSocket
  gameManager: GameManager
): { game?: Game | null; error?: string } {
  switch (data.type) {
    case 'list_games': {
      console.log('Listing games for player:', data.playerId);
      const availableGames = getAvailableGames(gameManager, data.playerId);
      console.log('Available games:', availableGames);
      ws.send(JSON.stringify(createGamesListMessage(availableGames)));
      return {};
    }

    case 'join_game': {
      const result = handleJoinGame(data, ws, sessions, gameManager);
      if (result.error) {
        ws.send(JSON.stringify(createErrorMessage(result.error)));
        return { error: result.error };
      }
      if (result.game) {
        broadcastGameState(result.game, sessions);
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

      const currentGame = gameManager.games.get(gameId);
      if (!currentGame) {
        console.error('Game not found:', gameId);
        return { error: 'Game not found' };
      }

      const result = handleGameAction(currentGame, playerId, data.action!);
      if (result.success) {
        broadcastGameState(currentGame, sessions);
        return { game: currentGame };
      } else {
        ws.send(JSON.stringify(createErrorMessage(result.error!)));
        return { error: result.error };
      }
    }

    case 'create_game': {
      const result = handleCreateGame(data, ws, sessions, gameManager);
      if (result.error) {
        ws.send(JSON.stringify(createErrorMessage(result.error)));
        return { error: result.error };
      }
      if (result.game) {
        broadcastGameState(result.game, sessions);
        return { game: result.game };
      }
      break;
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

export function handleCreateGame(
    data: GameMessage,
    ws: GameWebSocket,
    sessions: Map<string, GameWebSocket>,
    gameManager: GameManager
): { game: Game | null; error?: string } {
  const playerId = data.playerId!;
  const gameId = data.gameId || 'default';

  // Clear existing game if it exists
  if (gameManager.games.has(gameId)) {
      gameManager.games.delete(gameId);
  }

  // Clear any existing session for this player
  const oldGameId = gameManager.playerSessions.get(playerId);
  if (oldGameId) {
      gameManager.playerSessions.delete(playerId);
  }

  // Create player configurations
  const players: PlayerConfig[] = [
      { id: playerId, type: PlayerType.HUMAN },
      { id: 'ai-player-1', type: PlayerType.AI }
  ];

  // Create new game with configured players
  const newGame = new Game(12, players, gameId);
  gameManager.games.set(gameId, newGame);
  gameManager.playerSessions.set(playerId, gameId);
  sessions.set(playerId, ws);

  console.log(`Created new game ${gameId} with player ${playerId} and AI`);
  return { game: newGame };
}