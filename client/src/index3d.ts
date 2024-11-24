import {init} from './babylon/game';

// Get or create persistent playerId
const getOrCreatePlayerId = (): string => {
    const storedId = localStorage.getItem('playerId');
    if (storedId) {
        console.log('Using stored playerId:', storedId);
        return storedId;
    }
    return '';  // Return empty string, server will assign new ID if needed
};

const socket = new WebSocket('ws://localhost:3000');
const playerId = getOrCreatePlayerId();

socket.addEventListener('open', () => {
    console.log('Connected to server with playerId:', playerId);
});


init(socket, playerId);