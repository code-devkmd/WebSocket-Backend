import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import roomRoutes from './routes/room.js';
import { connectDB, getDB } from './config/db.js';
import { ObjectId } from 'mongodb';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
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

    socket.on('join_room', async ({ roomId, username }, callback) => {
        const trimmedUsername = String(username || "").trim();
        if (!trimmedUsername) {
            if (callback) callback({ success: false, message: "Username cannot be empty." });
            return;
        }

        const normalizedName = trimmedUsername.toLowerCase();
        let nameExists = false;
        activeUsers.forEach((userData) => {
            if (userData.roomId === roomId && userData.normalizedName === normalizedName) {
                nameExists = true;
            }
        });

        if (nameExists) {
            if (callback) callback({ success: false, message: "Username is already taken in this room." });
            return;
        }

        socket.join(roomId);
        socketUserMap.set(socket.id, { roomId, username: trimmedUsername });
        activeUsers.set(socket.id, { roomId, username: trimmedUsername, normalizedName });

        try {
            const db = getDB();

            const previousMessages = await db.collection('messages')
                .find({ roomId })
                .sort({ timestamp: 1 })
                .toArray();

            socket.emit('load_messages', previousMessages);

            const joinMessage = {
                id: Date.now().toString(),
                roomId,
                text: `${username} joined the chat`,
                type: 'system',
                timestamp: new Date()
            };

            await db.collection('messages').insertOne(joinMessage);
            socket.to(roomId).emit('receive_message', joinMessage);

            broadcastRoomUsers(roomId);
            if (callback) callback({ success: true });

        } catch (error) {
            console.error("Database error during join:", error);
            if (callback) callback({ success: false, message: "Server error joining room." });
        }
    });

    socket.on('typing', ({ roomId, username }) => {
        socket.to(roomId).emit('user_typing', { username });
    });

    socket.on('stop_typing', ({ roomId, username }) => {
        socket.to(roomId).emit('user_stopped_typing', { username });
    });

    socket.on('send_message', async ({ roomId, message }) => {
        try {
            const db = getDB();

            const messageData = {
                ...message,
                roomId,
                timestamp: new Date()
            };

            await db.collection('messages').insertOne(messageData);
            socket.to(roomId).emit('receive_message', messageData);
        } catch (error) {
            console.error("Error saving message:", error);
        }
    });

    socket.on('disconnect', async () => {
        const userData = socketUserMap.get(socket.id);

        if (userData) {
            const { roomId, username } = userData;

            activeUsers.delete(socket.id);
            socketUserMap.delete(socket.id);

            try {
                const db = getDB();

                const leaveMessage = {
                    id: Date.now().toString(),
                    roomId,
                    text: `${username} left the chat`,
                    type: 'system',
                    timestamp: new Date()
                };

                await db.collection('messages').insertOne(leaveMessage);
                socket.to(roomId).emit('receive_message', leaveMessage);
                socket.to(roomId).emit('user_stopped_typing', { username });

                const remainingUsers = broadcastRoomUsers(roomId);

                if (remainingUsers === 0) {
                    console.log(`Room ${roomId} is completely empty. Cleaning up database...`);

                    await db.collection('rooms').deleteOne({ _id: new ObjectId(roomId) });
                    await db.collection('messages').deleteMany({ roomId });

                    console.log(`Room ${roomId} and its messages deleted successfully.`);
                }
            } catch (error) {
                console.error("Error during disconnect cleanup:", error);
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