import express from "express";
import dotenv from "dotenv";
import cors from 'cors';
import http from "http";
import { Server } from "socket.io";

import { connectDB } from "./config/db.js";
import roomRouter from "./routes/room.js";
import { setupSocket } from "./socket/socket.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/rooms", roomRouter);

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
    },
})

setupSocket(io);

server.listen(3001, async () => {
    await connectDB();
    console.log("Server running on port 3001");
});