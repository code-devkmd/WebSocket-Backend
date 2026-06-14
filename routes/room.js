import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

const router = Router();

router.post('/create', async (req, res) => {
    try {

        const db = getDB();

        const expiresAt = new Date(
            Date.now() + 24 * 60 * 60 * 1000
        );

        const result = await db
            .collection("rooms")
            .insertOne({
                createdAt: new Date(),
                expiresAt,
            })

        res.status(201).json({
            success: true,
            roomId: result.insertedId,
        });
    } catch (err) {
        console.log(err);

        res.status(500).json({
            success: false,
            message: "Failed to create room",
        });
    }
});

router.get("/:roomId", async (req, res) => {

    try {

        const db = getDB();

        const room = await db
            .collection("rooms")
            .findOne({
                _id: new ObjectId(req.params.roomId),
            });

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found",
            });
        }

        if (new Date() > room.expiresAt) {
            return res.status(410).json({
                success: false,
                message: "Room expired",
            });
        }

        res.json({
            success: true,
            room,
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Server error",
        });

    }
});

export default router;