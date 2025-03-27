const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

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

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/poker-dating', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Models
const User = require('./models/User');
const Match = require('./models/Match');

// Socket.IO Connection Handling
const waitingUsers = new Map();

io.on('connection', (socket) => {
    console.log('New client connected');

    // Handle user joining waiting pool
    socket.on('joinWaiting', async (userData) => {
        try {
            // Use uniqueId for user identification
            const user = await User.findOneAndUpdate(
                { uniqueId: userData.uniqueId },
                userData,
                { upsert: true, new: true }
            );
            
            waitingUsers.set(socket.id, user);

            // Broadcast updated waiting count
            io.emit('waitingCount', waitingUsers.size);

            // Try to find a match
            findMatch(socket);
        } catch (error) {
            console.error('Error joining waiting pool:', error);
            socket.emit('error', { message: 'Failed to join waiting pool' });
        }
    });

    // Handle user leaving waiting pool
    socket.on('leaveWaiting', () => {
        waitingUsers.delete(socket.id);
        io.emit('waitingCount', waitingUsers.size);
    });

    // Handle game actions
    socket.on('gameAction', async (data) => {
        try {
            const { matchId, action, answer } = data;
            const match = await Match.findById(matchId);
            
            if (!match) {
                socket.emit('error', { message: 'Match not found' });
                return;
            }

            // Update match state based on action
            match.actions.push({
                userId: socket.id,
                action,
                answer
            });

            await match.save();

            // Emit updated match state to both players
            io.to(matchId).emit('matchUpdate', match);
        } catch (error) {
            console.error('Error handling game action:', error);
            socket.emit('error', { message: 'Failed to process game action' });
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        waitingUsers.delete(socket.id);
        io.emit('waitingCount', waitingUsers.size);
    });
});

// Match finding logic
async function findMatch(socket) {
    const currentUser = waitingUsers.get(socket.id);
    if (!currentUser) return;

    // Find another waiting user
    for (const [otherSocketId, otherUser] of waitingUsers.entries()) {
        if (otherSocketId !== socket.id && otherUser.uniqueId !== currentUser.uniqueId) {
            // Create a match
            const match = await Match.create({
                users: [currentUser._id, otherUser._id],
                status: 'active'
            });

            // Remove both users from waiting pool
            waitingUsers.delete(socket.id);
            waitingUsers.delete(otherSocketId);

            // Emit match found to both users
            io.to(socket.id).to(otherSocketId).emit('matchFound', {
                matchId: match._id,
                opponent: {
                    name: otherUser.name,
                    age: otherUser.age
                }
            });

            // Join match room
            socket.join(match._id);
            io.sockets.sockets.get(otherSocketId)?.join(match._id);

            // Broadcast updated waiting count
            io.emit('waitingCount', waitingUsers.size);
            break;
        }
    }
}

// Routes
app.get('/api/waiting-count', (req, res) => {
    res.json({ count: waitingUsers.size });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 