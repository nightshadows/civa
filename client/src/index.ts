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
            <button class="join-button" data-gameid="${gameId}">Join Game</button>
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
    }
});

