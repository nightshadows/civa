import { GameEventEmitter } from './engine-setup';
import { config } from './config';
import { getOrCreatePlayerId, generateGameId } from './utils';

// Check URL for 3D parameter
const use3D = new URLSearchParams(window.location.search).has('3d');

const wsUrl = config.wsUrl;
const socket = new WebSocket(wsUrl);
const playerId = getOrCreatePlayerId();
const gameEvents = new GameEventEmitter();

// Update games list UI
const updateGamesList = (games: string[]) => {
    const container = document.getElementById('gamesContainer');
    if (!container) return;

    container.innerHTML = games.map(gameId => `
        <div class="game-item">
            <span>Game: ${gameId}</span>
            <div class="button-group">
                <button class="join-button" data-gameid="${gameId}">Join Game</button>
                <button class="delete-button" data-gameid="${gameId}" title="Delete Game">
                    <svg width="16" height="16" viewBox="0 0 16 16">
                        <path fill="currentColor" d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                        <path fill="currentColor" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');

    // Add click handlers for join buttons
    container.querySelectorAll('.join-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const gameId = (e.target as HTMLElement).getAttribute('data-gameid');
            if (gameId) {
                window.location.href = `game.html?gameId=${gameId}${use3D ? '&3d' : ''}`;
            }
        });
    });

    // Add click handlers for delete buttons
    container.querySelectorAll('.delete-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const gameId = (e.target as HTMLElement).closest('.delete-button')?.getAttribute('data-gameid');
            if (gameId) {
                socket.send(JSON.stringify({
                    type: 'delete_game',
                    gameId,
                    playerId
                }));
            }
        });
    });
};

// Create game button handler
document.getElementById('createGame')?.addEventListener('click', () => {
    const newGameId = generateGameId();
    window.location.href = `game.html?gameId=${newGameId}${use3D ? '&3d' : ''}`;
});

// Socket connection handler
socket.addEventListener('open', () => {
    socket.send(JSON.stringify({
        type: 'list_games',
        playerId
    }));
});

// Socket event handling
socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'games_list') {
        console.log('Available games:', data.games);
        updateGamesList(data.games);
    } else if (data.type === 'game_deleted') {
        updateGamesList(data.games);
    } else if (data.type === 'error') {
        console.error('Error:', data.message);
    }
});
