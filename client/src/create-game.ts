import { generateGameId } from './utils';
import { RestApiClient } from './api-client';

const api = new RestApiClient();

// Check URL for 3D parameter
const use3D = new URLSearchParams(window.location.search).has('3d');

interface GameConfig {
    gameId: string;
    addAiPlayer: boolean;
    boardSize: number;
    timeLimit: number;  // in minutes
    maxPlayers: number;
}

async function initializeForm() {
    const player = await api.getPlayer();
    if (!player) {
        window.location.href = 'index.html'; // Redirect if not logged in
        return;
    }

    const form = document.getElementById('createGameForm') as HTMLFormElement;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const config: GameConfig = {
            gameId: generateGameId(),
            addAiPlayer: formData.get('addAiPlayer') === 'on',
            boardSize: parseInt(formData.get('boardSize') as string) || 19,
            timeLimit: parseInt(formData.get('timeLimit') as string) || 0,
            maxPlayers: parseInt(formData.get('maxPlayers') as string) || 2
        };

        try {
            await api.createGame(
                config.gameId, 
                config.addAiPlayer,
            );
            window.location.href = `game.html?gameId=${config.gameId}${use3D ? '&3d' : ''}`;
        } catch (error) {
            console.error('Failed to create game:', error);
            const errorElement = document.getElementById('errorMessage');
            if (errorElement) {
                errorElement.textContent = 'Failed to create game. Please try again.';
                errorElement.style.display = 'block';
            }
        }
    });

    // Add cancel button handler
    document.getElementById('cancelButton')?.addEventListener('click', () => {
        window.location.href = `index.html${use3D ? '?3d' : ''}`;
    });
}

// Initialize the form when the page loads
initializeForm(); 