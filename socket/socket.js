export function setupSocket(io) {
    io.on("connection", (socket) => {
        console.log(
            `User connected: ${socket.id}`
        );

        socket.on("join_room", (data) => {
            const { roomId, username } = data;

            socket.join(roomId);

            console.log(
                `${username} joined ${roomId}`
            );

            socket.to(roomId).emit(
                "user_joined",
                {
                    username,
                }
            );
        });

        socket.on("disconnect", () => {
            console.log(
                `Disconnected: ${socket.id}`
            );
        });
    });
}