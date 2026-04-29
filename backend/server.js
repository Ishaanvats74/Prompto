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
    origin: ["http://localhost:3000", "https://prompto-beta.vercel.app/", "*"],
    credentials: true,
  }),
);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://prompto-beta.vercel.app/", "*"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const PORT = process.env.PORT || 3001;
const ROUND_DURATION = 60; // seconds

server.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
  console.log(process.env.GEMINI_API_KEY)
});

app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

const rooms = {};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

// End a round: reveal answer, stop timer, reset answered set
const endRound = (roomId) => {
  const room = rooms[roomId];
  if (!room || !room.currentRound) return;

  clearInterval(room.timerInterval);
  clearTimeout(room.roundTimeout);
  room.timerInterval = null;
  room.roundTimeout = null;

  const correctPrompt = room.currentRound.prompt;
  room.currentRound.active = false;

  io.to(roomId).emit("round_over", {
    correctPrompt,
    players: room.players,
  });

  console.log(`🔔 Round ended in room ${roomId}`);
};

io.on("connection", (socket) => {
  // =========================
  // CREATE ROOM (Host)
  // =========================
  socket.on("create_room", (roomId) => {
    if (rooms[roomId]) {
      return socket.emit("error_message", "⚠ Room already exists");
    }

    socket.join(roomId);

    rooms[roomId] = {
      host: socket.id,
      players: [],
      currentRound: null,
      timerInterval: null,
      roundTimeout: null,
    };

    socket.emit("room_created", roomId);
    console.log(`🏠 Room created: ${roomId}`);
  });

  // =========================
  // JOIN ROOM (Players)
  // =========================
  socket.on("join_room", ({ roomId, playerName }) => {
    if (!rooms[roomId]) {
      return socket.emit("error_message", "Room does not exist");
    }

    socket.join(roomId);

    const alreadyExists = rooms[roomId].players.find((p) => p.id === socket.id);
    if (alreadyExists) return;

    const existingName = rooms[roomId].players.find((p) => p.name === playerName);
    if (existingName) {
      return socket.emit("existing_name", "That name is already taken — pick another");
    }

    rooms[roomId].players.push({ id: socket.id, name: playerName, score: 0 });

    socket.emit("joined_room", roomId);

    // Late join: send current round state
    if (rooms[roomId].currentRound && rooms[roomId].currentRound.active) {
      const { image, points, timeLeft } = rooms[roomId].currentRound;
      socket.emit("receive_prompt", { image, points, timeLeft: timeLeft ?? ROUND_DURATION });
    }

    io.to(roomId).emit("update_players", rooms[roomId].players);
  });

  // =========================
  // HOST SENDS PROMPT
  // =========================
  socket.on("Host_prompt", async ({ roomId, prompt, points, image }) => {
    try {
      if (!rooms[roomId]) return socket.emit("error_message", "Room not found");

      // Clear any existing round timer
      clearInterval(rooms[roomId].timerInterval);
      clearTimeout(rooms[roomId].roundTimeout);

      socket.emit("prompt_processing", true);

      const hostVector = await embedding(prompt);
      if (!hostVector) throw new Error("Failed to generate embedding");

      socket.emit("prompt_processing", false);

      // Reset answered set for new round
      rooms[roomId].currentRound = {
        prompt,
        points: Number(points),
        image,
        hostEmbedding: hostVector,
        active: true,
        answeredIds: new Set(),
        timeLeft: ROUND_DURATION,
      };

      // Broadcast round start to all players
      io.to(roomId).emit("receive_prompt", {
        image,
        points,
        timeLeft: ROUND_DURATION,
      });

      // Countdown ticker — sends timeLeft every second to all clients
      rooms[roomId].timerInterval = setInterval(() => {
        const round = rooms[roomId]?.currentRound;
        if (!round || !round.active) return;
        round.timeLeft = Math.max(0, round.timeLeft - 1);
        io.to(roomId).emit("timer_tick", { timeLeft: round.timeLeft });
      }, 1000);

      // Auto-end round after ROUND_DURATION seconds
      rooms[roomId].roundTimeout = setTimeout(() => {
        endRound(roomId);
      }, ROUND_DURATION * 1000);

      console.log(`📨 New round in ${roomId} — ${points} pts, ${ROUND_DURATION}s`);
    } catch (error) {
      socket.emit("prompt_processing", false);
      return socket.emit("error_message", `Failed to process prompt: ${error.message}`);
    }
  });

  // =========================
  // PLAYER SUBMITS ANSWER
  // =========================
  socket.on("User_ans", async ({ userPrompt, roomId }) => {
    try {
      if (!rooms[roomId]) return;
      const round = rooms[roomId].currentRound;
      if (!round || !round.active) {
        return socket.emit("error_message", "Round is not active");
      }

      // Prevent double-submit
      if (round.answeredIds.has(socket.id)) {
        return socket.emit("error_message", "You already answered this round");
      }
      round.answeredIds.add(socket.id);

      const userVector = await embedding(userPrompt);
      const score = similarity(userVector, round.hostEmbedding);
      const gainedPoints = Math.round(score * round.points);

      rooms[roomId].players = rooms[roomId].players.map((player) => {
        if (player.id === socket.id) player.score += gainedPoints;
        return player;
      });

      socket.emit("score_result", { gained: gainedPoints, similarity: Math.round(score * 100) });
      io.to(roomId).emit("update_players", rooms[roomId].players);

      // If everyone answered, end round early
      const playerCount = rooms[roomId].players.length;
      if (round.answeredIds.size >= playerCount && playerCount > 0) {
        endRound(roomId);
      }
    } catch (error) {
      return socket.emit("error_message", `Error scoring answer: ${error.message}`);
    }
  });

  // =========================
  // HOST ENDS ROUND MANUALLY
  // =========================
  socket.on("end_round", ({ roomId }) => {
    if (!rooms[roomId]) return;
    if (rooms[roomId].host !== socket.id) return;
    endRound(roomId);
  });

  // =========================
  // DISCONNECT
  // =========================
  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
    for (const roomId in rooms) {
      const room = rooms[roomId];
      room.players = room.players.filter((p) => p.id !== socket.id);
      io.to(roomId).emit("update_players", room.players);

      // If host disconnects, clean up room
      if (room.host === socket.id) {
        clearInterval(room.timerInterval);
        clearTimeout(room.roundTimeout);
        io.to(roomId).emit("error_message", "Host disconnected — game ended");
        delete rooms[roomId];
      }
    }
  });
});