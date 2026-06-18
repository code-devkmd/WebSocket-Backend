import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import roomRoutes from './routes/room.js';
import { connectDB } from './config/db.js';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "https://anonymous-chat-chi.vercel.app/", 
        methods: ["GET", "POST"]
    }
});

app.use('/api/rooms', roomRoutes);

const socketUserMap = new Map();
const activeUsers = new Map();

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    const broadcastRoomUsers = (roomId) => {
        const roomUsers = [];
        activeUsers.forEach((userData, socketId) => {
            if (userData.roomId === roomId) {
                roomUsers.push({ id: socketId, username: userData.username });
            }
        });

        io.to(roomId).emit('room_stats', {
            onlineCount: roomUsers.length,
            users: roomUsers
        });

        return roomUsers.length;
    };

    socket.on('join_room', ({ roomId, username }, callback) => {
        let nameExists = false;
        activeUsers.forEach((userData) => {
            if (userData.roomId === roomId && userData.username === username) {
                nameExists = true;
            }
        });

        if (nameExists) {
            if (callback) callback({ success: false, message: "Username is already taken in this room." });
            return;
        }
        
        socket.join(roomId);

        socketUserMap.set(socket.id, { roomId, username });

        activeUsers.set(socket.id, { roomId, username });

        socket.to(roomId).emit('receive_message', {
            id: Date.now().toString(),
            text: `${username} joined the chat`,
            type: 'system'
        });

        broadcastRoomUsers(roomId);
        if (callback) callback({ success: true });
    });

    socket.on('typing', ({ roomId, username }) => {
        socket.to(roomId).emit('user_typing', { username });
    });

    socket.on('stop_typing', ({ roomId, username }) => {
        socket.to(roomId).emit('user_stopped_typing', { username });
    });

    socket.on('send_message', ({ roomId, message }) => {
        socket.to(roomId).emit('receive_message', message);
    });

    socket.on('disconnect', async () => {
        const userData = socketUserMap.get(socket.id);

        if (userData) {
            const { roomId, username } = userData;
            
            activeUsers.delete(socket.id);

            socket.to(roomId).emit('user_stopped_typing', { username });

            socket.to(roomId).emit('receive_message', {
                id: Date.now().toString(),
                text: `${username} left the chat`,
                type: 'system'
            });

            socketUserMap.delete(socket.id);

            const remainingUsers = broadcastRoomUsers(roomId);
         
            if (remainingUsers === 0) {
                console.log(`Room ${roomId} is completely empty. Cleaning up database...`);
                try {
                    // Replace 'Room' with whatever your Mongoose/Database model is named
                    // Example: await Room.deleteOne({ roomId: roomId });
                    console.log(`Room ${roomId} deleted successfully.`);
                } catch (err) {
                    console.error(`Error deleting empty room ${roomId}:`, err);
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3001;
connectDB().then(() => {
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});