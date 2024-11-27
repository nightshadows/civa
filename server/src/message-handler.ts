export type GameAction = {
  type: 'MOVE_UNIT' | 'END_TURN';
  payload?: {
    unitId?: string;
    destination?: any;  // Replace 'any' with your actual destination type
  };
};

export type GameMessage = {
  type: 'join_game' | 'action' | 'game_state' | 'error';
  gameId?: string;
  playerId?: string;
  action?: GameAction;
  state?: any;  // Replace 'any' with your actual game state type
  message?: string;
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