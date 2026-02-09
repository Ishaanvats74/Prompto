require("dotenv").config();
const { Server } = require("socket.io");
const { GoogleGenAI } = require("@google/genai");
const express = require("express");
const http = require("http");
const cors = require("cors");
var similarity = require("compute-cosine-similarity");

const app = express();

app.use(
  cors({
    origin: ["http://localhost:3000", "https://prompto-rust.vercel.app"],
    credentials: true,
  }),
);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://prompto-rust.vercel.app"],
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket"],
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});

app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

const rooms = {};

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const embedding = async (text) => {
  try {
    const response = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: text,
    });
    return response.embeddings[0].values;
  } catch (error) {
    console.error("❌ Embedding error:", error);
    throw error;
  }
};

io.on("connection", (socket) => {
  // =========================
  // CREATE ROOM (Host)
  // =========================
  socket.on("create_room", (roomId) => {
    if (rooms[roomId]) {
      return socket.emit(
        "error_message",
        "⚠ Room already exists, skipping creation",
      );
    }

    socket.join(roomId);

    rooms[roomId] = {
      host: socket.id,
      players: [],
      currentRound: null,
    };

    socket.emit("room_created", roomId);
  });

  // =========================
  // JOIN ROOM (Players Only)
  // =========================
  socket.on("join_room", ({ roomId, playerName }) => {
    if (!rooms[roomId]) {
      return socket.emit("error_message", "Room does not exist");
    }

    socket.join(roomId);

    // If same socket already joined → ignore
    const alreadyExists = rooms[roomId].players.find(
      (player) => player.id === socket.id,
    );

    if (alreadyExists) return;

    // If same name but DIFFERENT socket → block
    const existingName = rooms[roomId].players.find(
      (player) => player.name === playerName,
    );

    if (existingName) {
      return socket.emit(
        "existing_name",
        "Choose a different name, this name already exists",
      );
    }

    rooms[roomId].players.push({
      id: socket.id,
      name: playerName,
      score: 0,
    });

    socket.emit("joined_room", roomId);

    // 🔥 Send current round state if exists (late join support)
    if (rooms[roomId].currentRound) {
      socket.emit("receive_prompt", rooms[roomId].currentRound);
    }

    io.to(roomId).emit("update-players", rooms[roomId].players);
  });

  // =========================
  // NEW PROMPT FROM HOST
  // =========================
  socket.on("Host_prompt", async ({ roomId, prompt, points, image }) => {
    try {
      if (!rooms[roomId]) {
        socket.emit("error_message", "Room not found");
        return;
      }

      const hostVector = await embedding(prompt);

      if (!hostVector) {
        throw new Error("Failed to generate embedding");
      }

      rooms[roomId].currentRound = {
        prompt,
        points: Number(points),
        image,
        hostEmbedding: hostVector,
      };

      io.to(roomId).emit("receive_prompt", {
        image,
        points,
      });
    } catch (error) {
      return socket.emit(
        "error_message",
        `Failed to process prompt: ${error.message}`,
      );
    }
  });

  socket.on("User_ans", async ({ userPrompt, roomId }) => {
    try {
      if (!rooms[roomId]) return;
      if (!rooms[roomId].currentRound) return;

      const userVector = await embedding(userPrompt);
      const hostVector = rooms[roomId].currentRound.hostEmbedding;

      const score = similarity(userVector, hostVector);

      const final_score = score * rooms[roomId].currentRound.points;

      const gainedPoints = Math.round(final_score);

      rooms[roomId].players = rooms[roomId].players.map((player) => {
        if (player.id === socket.id) {
          player.score += gainedPoints;
        }
        return player;
      });
      socket.emit("score_result", {
        gained: gainedPoints,
      });
      io.to(roomId).emit("update-players", rooms[roomId].players);
    } catch (error) {
      return socket.emit("error_message", `Error in User_ans:: ${error}`);
    }
  });

  // =========================
  // DISCONNECT
  // =========================
  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);

    for (const roomId in rooms) {
      rooms[roomId].players = rooms[roomId].players.filter(
        (player) => player.id !== socket.id,
      );

      io.to(roomId).emit("update-players", rooms[roomId].players);
    }
  });
});
