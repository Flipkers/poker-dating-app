const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage
const waitingPlayers = new Map(); // socketId -> player info
const activeSessions = new Map(); // sessionId -> session info

// Socket.IO Connection Handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Handle user joining waiting pool
    socket.on('joinWaiting', (userData) => {
        try {
            console.log('User joining waiting pool:', userData);
            
            // Add user to waiting pool
            waitingPlayers.set(socket.id, {
                ...userData,
                joinedAt: Date.now()
            });

            // Broadcast updated waiting count
            io.emit('waitingCount', waitingPlayers.size);

            // Notify user they're in queue
            socket.emit('queueStatus', {
                position: waitingPlayers.size,
                message: 'You are in the waiting queue'
            });

            // Try to find a match
            findMatch(socket);
        } catch (error) {
            console.error('Error joining waiting pool:', error);
            socket.emit('error', { message: 'Failed to join waiting pool' });
        }
    });

    // Handle user leaving waiting pool
    socket.on('leaveWaiting', () => {
        waitingPlayers.delete(socket.id);
        io.emit('waitingCount', waitingPlayers.size);
        socket.emit('queueStatus', {
            position: 0,
            message: 'You have left the waiting queue'
        });
    });

    // Handle submitting a card
    socket.on('submitCard', (data) => {
        try {
            const { sessionId, card } = data;
            const session = activeSessions.get(sessionId);
            
            if (!session) {
                socket.emit('error', { message: 'Session not found' });
                return;
            }

            // Check if it's the player's turn
            if (session.turn !== socket.id) {
                socket.emit('error', { message: 'Not your turn' });
                return;
            }

            // Add card to history
            session.history.push({
                from: socket.id,
                card,
                response: null,
                timestamp: Date.now()
            });

            // Switch turn
            session.turn = session.players.find(id => id !== socket.id);

            // Notify both players
            session.players.forEach(playerId => {
                io.to(playerId).emit('gameUpdate', {
                    sessionId,
                    session: {
                        turn: session.turn,
                        history: session.history,
                        compatibility: session.compatibility
                    }
                });
            });
        } catch (error) {
            console.error('Error submitting card:', error);
            socket.emit('error', { message: 'Failed to submit card' });
        }
    });

    // Handle responding to a card
    socket.on('respondCard', (data) => {
        try {
            const { sessionId, response } = data;
            const session = activeSessions.get(sessionId);
            
            if (!session) {
                socket.emit('error', { message: 'Session not found' });
                return;
            }

            const lastCard = session.history[session.history.length - 1];
            if (!lastCard || lastCard.response !== null || lastCard.from === socket.id) {
                socket.emit('error', { message: 'Invalid response' });
                return;
            }

            // Record response
            lastCard.response = {
                by: socket.id,
                value: response,
                timestamp: Date.now()
            };

            // Update compatibility based on response
            switch (response) {
                case 'like':
                    session.compatibility += 25;
                    break;
                case 'compromise':
                    session.compatibility += 10;
                    break;
                // dislike doesn't affect compatibility
            }

            // Switch turn back to the card sender
            session.turn = lastCard.from;

            // Notify both players
            session.players.forEach(playerId => {
                io.to(playerId).emit('gameUpdate', {
                    sessionId,
                    session: {
                        turn: session.turn,
                        history: session.history,
                        compatibility: session.compatibility
                    }
                });
            });

            // Check if game should progress to next stage
            if (session.compatibility >= 100) {
                session.stage++;
                session.compatibility = 0;
                session.players.forEach(playerId => {
                    io.to(playerId).emit('stageComplete', {
                        sessionId,
                        stage: session.stage
                    });
                });
            }
        } catch (error) {
            console.error('Error responding to card:', error);
            socket.emit('error', { message: 'Failed to respond to card' });
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        // Remove from waiting pool if present
        waitingPlayers.delete(socket.id);
        io.emit('waitingCount', waitingPlayers.size);

        // Handle active sessions
        for (const [sessionId, session] of activeSessions) {
            if (session.players.includes(socket.id)) {
                // Notify other player about disconnection
                const otherPlayer = session.players.find(id => id !== socket.id);
                if (otherPlayer) {
                    io.to(otherPlayer).emit('playerDisconnected', {
                        sessionId,
                        message: 'Other player disconnected'
                    });
                }
                activeSessions.delete(sessionId);
            }
        }
    });
});

// Match finding logic
function findMatch(socket) {
    const currentPlayer = waitingPlayers.get(socket.id);
    if (!currentPlayer) return;

    console.log('Finding match for player:', currentPlayer.name);
    console.log('Current waiting players:', waitingPlayers.size);

    // Sort waiting players by join time (FIFO)
    const sortedPlayers = Array.from(waitingPlayers.entries())
        .sort((a, b) => a[1].joinedAt - b[1].joinedAt);

    // Find another player (not the current player)
    const otherPlayer = sortedPlayers.find(([otherId, player]) => 
        otherId !== socket.id && player.uniqueId !== currentPlayer.uniqueId
    );

    if (otherPlayer) {
        const [otherSocketId, otherPlayerData] = otherPlayer;
        console.log('Match found between:', currentPlayer.name, 'and', otherPlayerData.name);

        // Create a new session
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const session = {
            id: sessionId,
            players: [socket.id, otherSocketId],
            turn: socket.id, // First player starts
            stage: 1,
            compatibility: 0,
            history: [],
            startedAt: Date.now()
        };

        // Store session
        activeSessions.set(sessionId, session);

        // Remove both players from waiting pool
        waitingPlayers.delete(socket.id);
        waitingPlayers.delete(otherSocketId);

        // Notify both players
        [socket.id, otherSocketId].forEach(playerId => {
            io.to(playerId).emit('matchFound', {
                sessionId,
                opponent: playerId === socket.id ? otherPlayerData : currentPlayer,
                session
            });
        });

        // Update waiting count
        io.emit('waitingCount', waitingPlayers.size);

        console.log('Match created:', sessionId);
        console.log('Remaining players in queue:', waitingPlayers.size);
    } else {
        console.log('No match found for player:', currentPlayer.name);
    }
}

// Routes
app.get('/api/status', (req, res) => {
    res.json({
        waitingPlayers: waitingPlayers.size,
        activeSessions: activeSessions.size
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 