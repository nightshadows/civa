import { generateGameId } from './utils';
import { RestApiClient } from './api-client';

// Check URL for 3D parameter
const use3D = new URLSearchParams(window.location.search).has('3d');
const api = new RestApiClient();

// At the top of the file, after existing variables
const toggle3dCheckbox = document.getElementById('toggle3d') as HTMLInputElement;

// Initialize checkbox state from URL
toggle3dCheckbox.checked = use3D;

// Add event listener for the 3D toggle
toggle3dCheckbox.addEventListener('change', (e) => {
    const is3dMode = (e.target as HTMLInputElement).checked;
    const url = new URL(window.location.href);

    if (is3dMode) {
        url.searchParams.set('3d', '');
    } else {
        url.searchParams.delete('3d');
    }

    window.history.replaceState({}, '', url.toString());

    // Update all game links
    document.querySelectorAll('.join-button').forEach(button => {
        const gameId = button.getAttribute('data-gameid');
        if (gameId) {
            (button as HTMLElement).onclick = () => {
                window.location.href = `game.html?gameId=${gameId}${is3dMode ? '&3d' : ''}`;
            };
        }
    });
});

// Add this function to update the UI based on player state
async function updatePlayerUI() {
    const player = await api.getPlayer();
    const playerNameElement = document.getElementById('playerName');
    const loginLink = document.getElementById('loginLink');
    const logoutButton = document.getElementById('logoutButton');
    const createGameButton = document.getElementById('createGame');

    if (player) {
        // Player is logged in
        if (playerNameElement) {
            playerNameElement.textContent = player.name;
        }
        if (loginLink) {
            loginLink.style.display = 'none';
        }
        if (logoutButton) {
            logoutButton.style.display = 'block';
        }
        if (createGameButton) {
            createGameButton.style.display = 'block';
        }
    } else {
        // Player is not logged in
        if (playerNameElement) {
            playerNameElement.textContent = '';
        }
        if (loginLink) {
            loginLink.style.display = 'block';
        }
        if (logoutButton) {
            logoutButton.style.display = 'none';
        }
        if (createGameButton) {
            createGameButton.style.display = 'none';
        }
    }
}

// Update games list UI
const updateGamesList = async () => {
    try {
        const player = await api.getPlayer();
        if (!player) {
            // If not logged in, show message instead of games list
            const container = document.getElementById('gamesContainer');
            if (container) {
                container.innerHTML = '<p>Please log in to view and join games.</p>';
            }
            return;
        }

        const { games, gameStates } = await api.listGames();
        const container = document.getElementById('gamesContainer');
        if (!container) return;

        container.innerHTML = games.map(gameId => {
            const gameInfo = gameStates[gameId];
            const isPlayerInGame = gameInfo.players.includes(player.id);
            return `
            <div class="game-item">
                <div class="game-info">
                    <span>Game: ${gameId}</span>
                    <span class="player-count">(${gameInfo.currentPlayers}/${gameInfo.maxPlayers} players)</span>
                </div>
                <div class="button-group">
                    ${isPlayerInGame ? `
                    <button class="delete-button" data-gameid="${gameId}" title="Delete Game">
                        <svg width="16" height="16" viewBox="0 0 16 16">
                            <path fill="currentColor" d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                            <path fill="currentColor" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                        </svg>
                    </button>
                    ` : ''}
                    <button class="join-button" data-gameid="${gameId}">Join Game</button>
                </div>
            </div>
        `}).join('');

        // Add click handlers for join buttons
        container.querySelectorAll('.join-button').forEach(button => {
            button.addEventListener('click', async (e) => {
                const gameId = (e.target as HTMLElement).getAttribute('data-gameid');
                if (gameId) {
                    window.location.href = `game.html?gameId=${gameId}${use3D ? '&3d' : ''}`;
                }
            });
        });

        // Add click handlers for delete buttons
        container.querySelectorAll('.delete-button').forEach(button => {
            button.addEventListener('click', async (e) => {
                const gameId = (e.target as HTMLElement).closest('.delete-button')?.getAttribute('data-gameid');
                if (gameId) {
                    await api.deleteGame(gameId);
                    updateGamesList();
                }
            });
        });
    } catch (error) {
        console.error('Failed to update games list:', error);
    }
};

// Modify the create game button handler
document.getElementById('createGame')?.addEventListener('click', () => {
    window.location.href = `create-game.html${use3D ? '?3d' : ''}`;
});

// Update logout button handler
document.getElementById('logoutButton')?.addEventListener('click', async () => {
    try {
        await api.logout();
        window.location.reload();
    } catch (error) {
        console.error('Logout failed:', error);
    }
});

// Initial load
updatePlayerUI();
updateGamesList();
