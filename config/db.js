import { MongoClient, ServerApiVersion } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGODB_URI;

if (!uri) {
    throw new Error("MONGODB_URI is not defined in .env");
}

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

let db;

export async function connectDB() {
    if (db) return db;

    await client.connect();
    db = client.db("anonymous-chat");

    console.log("Successfully connected to MongoDB!");
    return db;
}

export function getDB() {
    if (!db) {
        throw new Error("Database not connected. Call connectDB() first.");
    }
    return db;
}