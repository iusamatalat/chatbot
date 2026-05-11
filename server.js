/* ============================================
   MTM HACKATHON — Express + MongoDB Backend
   Chat history persistence with REST API
============================================ */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serve frontend files

// MongoDB connection
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "mtm_hackathon";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;

async function connectDB() {
  try {
    await client.connect();
    db = client.db(dbName);
    await db.command({ ping: 1 });
    console.log("✅ Connected to MongoDB Atlas successfully!");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  }
}

/* ─────────────────────────────────────────────
   API ROUTES
───────────────────────────────────────────── */

// GET /api/chats — List all chat sessions (newest first)
app.get("/api/chats", async (req, res) => {
  try {
    const chats = await db
      .collection("chats")
      .find({}, { projection: { title: 1, createdAt: 1, updatedAt: 1, messageCount: 1 } })
      .sort({ updatedAt: -1 })
      .toArray();
    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chats/:id — Get a specific chat with all messages
app.get("/api/chats/:id", async (req, res) => {
  try {
    const chat = await db
      .collection("chats")
      .findOne({ _id: new ObjectId(req.params.id) });
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    res.json(chat);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chats — Create a new chat session
app.post("/api/chats", async (req, res) => {
  try {
    const { title, messages } = req.body;
    const doc = {
      title: title || "New Chat",
      messages: messages || [],
      messageCount: messages ? messages.length : 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await db.collection("chats").insertOne(doc);
    res.status(201).json({ _id: result.insertedId, ...doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/chats/:id — Update chat (append messages, update title)
app.put("/api/chats/:id", async (req, res) => {
  try {
    const { title, messages } = req.body;
    const update = { $set: { updatedAt: new Date() } };

    if (title) update.$set.title = title;
    if (messages) {
      update.$set.messages = messages;
      update.$set.messageCount = messages.length;
    }

    const result = await db
      .collection("chats")
      .findOneAndUpdate(
        { _id: new ObjectId(req.params.id) },
        update,
        { returnDocument: "after" }
      );

    if (!result) return res.status(404).json({ error: "Chat not found" });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/chats/:id — Delete a chat
app.delete("/api/chats/:id", async (req, res) => {
  try {
    const result = await db
      .collection("chats")
      .deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0)
      return res.status(404).json({ error: "Chat not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chats/:id/message — Append a single message to a chat
app.post("/api/chats/:id/message", async (req, res) => {
  try {
    const { role, content } = req.body;
    const result = await db
      .collection("chats")
      .findOneAndUpdate(
        { _id: new ObjectId(req.params.id) },
        {
          $push: { messages: { role, content, timestamp: new Date() } },
          $inc: { messageCount: 1 },
          $set: { updatedAt: new Date() },
        },
        { returnDocument: "after" }
      );
    if (!result) return res.status(404).json({ error: "Chat not found" });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────
   START SERVER
───────────────────────────────────────────── */
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  });
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await client.close();
  process.exit(0);
});
