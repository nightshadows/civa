import express from 'express';
import { Server } from 'socket.io';
import { Game } from './game/Game';
import path from 'path';
import cors from 'cors';

const app = express();

// Enable CORS
app.use(cors());

// Serve static files from the client's public directory
app.use(express.static(path.join(__dirname, '../../client/public')));

const server = app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});

const io = new Server(server, {
    cors: {
        origin: "http://localhost:8080",
        methods: ["GET", "POST"]
    }
});

const games = new Map<string, Game>();

io.on('connection', (socket) => {
    console.log('Client connected');

    let playerId: string;
    let gameId: string;

    socket.on('join_game', (data: { gameId: string, playerId: string }) => {
        console.log('Player joining game:', data);
        playerId = data.playerId;
        gameId = data.gameId;

        // Create or join game logic here
        if (!games.has(gameId)) {
            games.set(gameId, new Game(48, [playerId]));
        }

        const game = games.get(gameId)!;

        // Send initial state
        socket.emit('game_state', game.getVisibleState(playerId));
    });

    socket.on('action', (action) => {
        const game = games.get(gameId);
        if (!game) return;

        if (!game.isPlayerTurn(playerId)) {
            socket.emit('error', 'Not your turn');
            return;
        }

        // Handle action and update game state
        // Broadcast updates to relevant players
    });
});