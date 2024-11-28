import { Game } from "./game";

export type GameAction = {
  type: 'MOVE_UNIT' | 'END_TURN';
  payload?: {
    unitId?: string;
    destination?: any;  // Replace 'any' with your actual destination type
  };
};

export type GameMessage = {
  type: 'join_game' | 'action' | 'game_state' | 'error' | 'list_games' | 'games_list';
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
  game: any,  // Replace 'any' with your Game type
  playerId: string, 
  action: GameAction
): { success: boolean; error?: string } {
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
export function broadcastGameState(
  game: any, // Replace with your Game type
  clients: Map<GameWebSocket, string> | Map<string, GameWebSocket>,
  isClientToPlayer = false  // true for server.ts, false for worker.ts
) {
  if (isClientToPlayer) {
    // For server.ts (WebSocket -> playerId mapping)
    const wsToPlayer = clients as Map<GameWebSocket, string>;
    wsToPlayer.forEach((playerId, ws) => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        const playerState = game.getVisibleState(playerId);
        ws.send(JSON.stringify(createGameStateMessage(playerState)));
      }
    });
  } else {
    // For worker.ts (playerId -> WebSocket mapping)
    const playerToWs = clients as Map<string, GameWebSocket>;
    playerToWs.forEach((ws, playerId) => {
      const playerState = game.getVisibleState(playerId);
      ws.send(JSON.stringify(createGameStateMessage(playerState)));
    });
  }
}

export interface GameManager {
  games: Map<string, Game>;
  playerSessions: Map<string, string>;
}

export function handleJoinGame(
  data: GameMessage,
  ws: GameWebSocket,
  sessions: Map<string, GameWebSocket> | Map<GameWebSocket, string>,
  isClientToPlayer: boolean,
  gameManager?: GameManager, // Optional: only needed for server.ts
  game?: Game // Optional: only needed for worker.ts
): { game: Game | null; error?: string } {
  const gameId = data.gameId || 'default';
  const playerId = data.playerId!;

  if (isClientToPlayer) {
    // Server.ts path
    const { games, playerSessions } = gameManager!;
    (sessions as Map<GameWebSocket, string>).set(ws, playerId);

    if (!games.has(gameId)) {
      games.set(gameId, new Game(12, [playerId], gameId));
      playerSessions.set(playerId, gameId);
    } else {
      const game = games.get(gameId)!;
      if (!playerSessions.has(playerId)) {
        if (game.canAddPlayer()) {
          game.addPlayer(playerId);
          playerSessions.set(playerId, gameId);
        } else {
          return { game: null, error: 'Game is full' };
        }
      }
    }
    return { game: games.get(playerSessions.get(playerId)!)! };
  } else {
    // Worker.ts path
    (sessions as Map<string, GameWebSocket>).set(playerId, ws);
    
    if (!game) {
      game = new Game(12, [playerId], 'default');
    } else if (game.canAddPlayer()) {
      game.addPlayer(playerId);
    } else {
      return { game: null, error: 'Game is full' };
    }
    return { game };
  }
}

export function createGamesListMessage(games: string[]): GameMessage {
  return {
    type: 'games_list',
    games
  };
}

export function getAvailableGames(
  isClientToPlayer: boolean,
  gameManager?: GameManager,
  game?: Game
): string[] {
  if (isClientToPlayer && gameManager) {
    // Server.ts: Return all games with available slots
    return Array.from(gameManager.games.entries())
      .filter(([_, game]) => game.canAddPlayer())
      .map(([gameId]) => gameId);
  } else if (!isClientToPlayer && game) {
    // Worker.ts: Return current game if it has slots
    return game.canAddPlayer() ? ['default'] : [];
  }
  return [];
}

export function handleGameMessage(
  data: GameMessage,
  ws: GameWebSocket,
  sessions: Map<string, GameWebSocket> | Map<GameWebSocket, string>,
  isClientToPlayer: boolean,
  gameManager?: GameManager,
  game?: Game
): void {
  switch (data.type) {
    case 'join_game': {
      const result = handleJoinGame(data, ws, sessions, isClientToPlayer, gameManager, game);
      if (result.error) {
        ws.send(JSON.stringify(createErrorMessage(result.error)));
        return;
      }
      if (result.game) {
        broadcastGameState(result.game, sessions, isClientToPlayer);
      }
      break;
    }

    case 'action': {
      const playerId = isClientToPlayer 
        ? (sessions as Map<GameWebSocket, string>).get(ws)
        : getPlayerIdFromWs(ws, sessions as Map<string, GameWebSocket>);
      
      const currentGame = isClientToPlayer
        ? gameManager!.games.get(gameManager!.playerSessions.get(playerId!)!)
        : game;

      if (!currentGame || !playerId) return;

      const result = handleGameAction(currentGame, playerId, data.action!);
      if (result.success) {
        broadcastGameState(currentGame, sessions, isClientToPlayer);
      } else {
        ws.send(JSON.stringify(createErrorMessage(result.error!)));
      }
      break;
    }

    case 'list_games': {
      const availableGames = getAvailableGames(isClientToPlayer, gameManager, game);
      ws.send(JSON.stringify(createGamesListMessage(availableGames)));
      break;
    }
  }
}

export function getPlayerIdFromWs(ws: GameWebSocket, sessions: Map<string, GameWebSocket>): string | null {
  for (const [playerId, socket] of sessions.entries()) {
    if (socket === ws) return playerId;
  }
  return null;
}