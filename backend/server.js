// require("dotenv").config();
// const { Server } = require("socket.io");
// const { GoogleGenAI } = require("@google/genai");
// const express = require("express");
// const http = require("http");
// const cors = require("cors");
// var similarity = require("compute-cosine-similarity");
// const app = express();
// const server = http.createServer(app);
// const allowedOrigins = [
//   "http://localhost:3000",
//   "https://prompto-beta.vercel.app",
//   "https://prompto-git-main-ishaanvats74s-projects.vercel.app",
//   "https://prompto-mp3tzjdck-ishaanvats74s-projects.vercel.app"
// ];

// app.use(cors({
//   origin: allowedOrigins,
//   credentials: true,
// }));

// const io = new Server(server, {
//   cors: {
//     origin: allowedOrigins,
//     methods: ["GET", "POST"],
//     credentials: true,
//   },
// });

// const PORT = process.env.PORT || 3001;
// const ROUND_DURATION = 60; // seconds

// server.listen(PORT, () => {
//   console.log("🚀 Server running on port", PORT);
//   console.log(process.env.GEMINI_API_KEY)
// });

// app.get("/", (req, res) => {
//   res.send("Server is running 🚀");
// });

// const rooms = {};

// const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// const embedding = async (text) => {
//   try {
//     const response = await ai.models.embedContent({
//       model: "gemini-embedding-001",
//       contents: text,
//     });
//     return response.embeddings[0].values;
//   } catch (error) {
//     console.error("❌ Embedding error:", error);
//     throw error;
//   }
// };

// // End a round: reveal answer, stop timer, reset answered set
// const endRound = (roomId) => {
//   const room = rooms[roomId];
//   if (!room || !room.currentRound) return;

//   clearInterval(room.timerInterval);
//   clearTimeout(room.roundTimeout);
//   room.timerInterval = null;
//   room.roundTimeout = null;

//   const correctPrompt = room.currentRound.prompt;
//   room.currentRound.active = false;

//   io.to(roomId).emit("round_over", {
//     correctPrompt,
//     players: room.players,
//   });

//   console.log(`🔔 Round ended in room ${roomId}`);
// };

// io.on("connection", (socket) => {
//   // =========================
//   // CREATE ROOM (Host)
//   // =========================
//   socket.on("create_room", (roomId) => {
//     if (rooms[roomId]) {
//       return socket.emit("error_message", "⚠ Room already exists");
//     }

//     socket.join(roomId);

//     rooms[roomId] = {
//       host: socket.id,
//       players: [],
//       currentRound: null,
//       timerInterval: null,
//       roundTimeout: null,
//     };

//     socket.emit("room_created", roomId);
//     console.log(`🏠 Room created: ${roomId}`);
//   });

//   // =========================
//   // JOIN ROOM (Players)
//   // =========================
//   socket.on("join_room", ({ roomId, playerName }) => {
//     if (!rooms[roomId]) {
//       return socket.emit("error_message", "Room does not exist");
//     }

//     socket.join(roomId);

//     const alreadyExists = rooms[roomId].players.find((p) => p.id === socket.id);
//     if (alreadyExists) return;

//     const existingName = rooms[roomId].players.find((p) => p.name === playerName);
//     if (existingName) {
//       return socket.emit("existing_name", "That name is already taken — pick another");
//     }

//     rooms[roomId].players.push({ id: socket.id, name: playerName, score: 0 });

//     socket.emit("joined_room", roomId);

//     // Late join: send current round state
//     if (rooms[roomId].currentRound && rooms[roomId].currentRound.active) {
//       const { image, points, timeLeft } = rooms[roomId].currentRound;
//       socket.emit("receive_prompt", { image, points, timeLeft: timeLeft ?? ROUND_DURATION });
//     }

//     io.to(roomId).emit("update_players", rooms[roomId].players);
//   });

//   // =========================
//   // HOST SENDS PROMPT
//   // =========================
//   socket.on("Host_prompt", async ({ roomId, prompt, points, image }) => {
//     try {
//       if (!rooms[roomId]) return socket.emit("error_message", "Room not found");

//       // Clear any existing round timer
//       clearInterval(rooms[roomId].timerInterval);
//       clearTimeout(rooms[roomId].roundTimeout);

//       socket.emit("prompt_processing", true);

//       const hostVector = await embedding(prompt);
//       if (!hostVector) throw new Error("Failed to generate embedding");

//       socket.emit("prompt_processing", false);

//       // Reset answered set for new round
//       rooms[roomId].currentRound = {
//         prompt,
//         points: Number(points),
//         image,
//         hostEmbedding: hostVector,
//         active: true,
//         answeredIds: new Set(),
//         timeLeft: ROUND_DURATION,
//       };

//       // Broadcast round start to all players
//       io.to(roomId).emit("receive_prompt", {
//         image,
//         points,
//         timeLeft: ROUND_DURATION,
//       });

//       // Countdown ticker — sends timeLeft every second to all clients
//       rooms[roomId].timerInterval = setInterval(() => {
//         const round = rooms[roomId]?.currentRound;
//         if (!round || !round.active) return;
//         round.timeLeft = Math.max(0, round.timeLeft - 1);
//         io.to(roomId).emit("timer_tick", { timeLeft: round.timeLeft });
//       }, 1000);

//       // Auto-end round after ROUND_DURATION seconds
//       rooms[roomId].roundTimeout = setTimeout(() => {
//         endRound(roomId);
//       }, ROUND_DURATION * 1000);

//       console.log(`📨 New round in ${roomId} — ${points} pts, ${ROUND_DURATION}s`);
//     } catch (error) {
//       socket.emit("prompt_processing", false);
//       return socket.emit("error_message", `Failed to process prompt: ${error.message}`);
//     }
//   });

//   // =========================
//   // PLAYER SUBMITS ANSWER
//   // =========================
//   socket.on("User_ans", async ({ userPrompt, roomId }) => {
//     try {
//       if (!rooms[roomId]) return;
//       const round = rooms[roomId].currentRound;
//       if (!round || !round.active) {
//         return socket.emit("error_message", "Round is not active");
//       }

//       // Prevent double-submit
//       if (round.answeredIds.has(socket.id)) {
//         return socket.emit("error_message", "You already answered this round");
//       }
//       round.answeredIds.add(socket.id);

//       const userVector = await embedding(userPrompt);
//       const score = similarity(userVector, round.hostEmbedding);
//       const gainedPoints = Math.round(score * round.points);

//       rooms[roomId].players = rooms[roomId].players.map((player) => {
//         if (player.id === socket.id) player.score += gainedPoints;
//         return player;
//       });

//       socket.emit("score_result", { gained: gainedPoints, similarity: Math.round(score * 100) });
//       io.to(roomId).emit("update_players", rooms[roomId].players);

//       // If everyone answered, end round early
//       const playerCount = rooms[roomId].players.length;
//       if (round.answeredIds.size >= playerCount && playerCount > 0) {
//         endRound(roomId);
//       }
//     } catch (error) {
//       return socket.emit("error_message", `Error scoring answer: ${error.message}`);
//     }
//   });

//   // =========================
//   // HOST ENDS ROUND MANUALLY
//   // =========================
//   socket.on("end_round", ({ roomId }) => {
//     if (!rooms[roomId]) return;
//     if (rooms[roomId].host !== socket.id) return;
//     endRound(roomId);
//   });

//   // =========================
//   // DISCONNECT
//   // =========================
//   socket.on("disconnect", () => {
//     console.log("❌ Disconnected:", socket.id);
//     for (const roomId in rooms) {
//       const room = rooms[roomId];
//       room.players = room.players.filter((p) => p.id !== socket.id);
//       io.to(roomId).emit("update_players", room.players);

//       // If host disconnects, clean up room
//       if (room.host === socket.id) {
//         clearInterval(room.timerInterval);
//         clearTimeout(room.roundTimeout);
//         io.to(roomId).emit("error_message", "Host disconnected — game ended");
//         delete rooms[roomId];
//       }
//     }
//   });
// });

require("dotenv").config();
const { Server } = require("socket.io");
const { GoogleGenAI } = require("@google/genai");
const express = require("express");
const http = require("http");
const cors = require("cors");
var similarity = require("compute-cosine-similarity");

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  "http://localhost:3000",
  "https://prompto-beta.vercel.app",
  "https://prompto-git-main-ishaanvats74s-projects.vercel.app",
  "https://prompto-mp3tzjdck-ishaanvats74s-projects.vercel.app",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  // ✅ FIX 1: Match client transport — avoids Render proxy upgrade issues
  transports: ["websocket", "polling"],
  // ✅ FIX 2: Longer timeouts to survive Render cold starts & slow connections
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  // ✅ FIX 3: Allow large payloads (base64 images in Host_prompt)
  maxHttpBufferSize: 5e6, // 5 MB
});

const PORT = process.env.PORT || 3001;
const ROUND_DURATION = 60; // seconds

server.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});

// ✅ FIX 4: Health endpoint — ping this every ~10 min (UptimeRobot etc.)
//           to prevent Render free-tier spin-down which causes mass disconnects
app.get("/", (req, res) => res.send("Server is running 🚀"));
app.get("/health", (req, res) => res.sendStatus(200));

// ─────────────────────────────────────────────
// In-memory room store
// ─────────────────────────────────────────────
const rooms = {};

// ─────────────────────────────────────────────
// Gemini AI
// ─────────────────────────────────────────────
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const embedding = async (text) => {
  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
  });
  return response.embeddings[0].values;
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Safely clear both timers on a room */
const clearRoomTimers = (room) => {
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }
  if (room.roundTimeout) {
    clearTimeout(room.roundTimeout);
    room.roundTimeout = null;
  }
};

/** End a round: reveal answer, stop timers */
const endRound = (roomId) => {
  const room = rooms[roomId];
  if (!room || !room.currentRound || !room.currentRound.active) return;

  clearRoomTimers(room);
  room.currentRound.active = false;

  io.to(roomId).emit("round_over", {
    correctPrompt: room.currentRound.prompt,
    players: room.players,
  });

  console.log(`🔔 Round ended in room ${roomId}`);
};

// ─────────────────────────────────────────────
// Socket events
// ─────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`✅ Connected: ${socket.id}`);

  // ── CREATE ROOM (Host) ──────────────────────
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
    console.log(`🏠 Room created: ${roomId} by ${socket.id}`);
  });

  // ── JOIN ROOM (Players) ─────────────────────
  socket.on("join_room", ({ roomId, playerName }) => {
    if (!rooms[roomId]) {
      return socket.emit("error_message", "Room does not exist");
    }

    // Idempotent join
    if (rooms[roomId].players.find((p) => p.id === socket.id)) return;

    if (rooms[roomId].players.find((p) => p.name === playerName)) {
      return socket.emit(
        "existing_name",
        "That name is already taken — pick another"
      );
    }

    socket.join(roomId);
    rooms[roomId].players.push({ id: socket.id, name: playerName, score: 0 });
    socket.emit("joined_room", roomId);

    // Late-join: catch up with current round state
    const round = rooms[roomId].currentRound;
    if (round && round.active) {
      socket.emit("receive_prompt", {
        image: round.image,
        points: round.points,
        timeLeft: round.timeLeft ?? ROUND_DURATION,
      });
    }

    io.to(roomId).emit("update_players", rooms[roomId].players);
    console.log(`👤 ${playerName} joined room ${roomId}`);
  });

  // ── HOST SENDS PROMPT ───────────────────────
  socket.on("Host_prompt", async ({ roomId, prompt, points, image }) => {
    if (!rooms[roomId]) {
      return socket.emit("error_message", "Room not found");
    }
    if (rooms[roomId].host !== socket.id) {
      return socket.emit("error_message", "Only the host can start a round");
    }

    // Clear any existing round
    clearRoomTimers(rooms[roomId]);
    socket.emit("prompt_processing", true);

    try {
      const hostVector = await embedding(prompt);

      socket.emit("prompt_processing", false);

      rooms[roomId].currentRound = {
        prompt,
        points: Number(points),
        image,
        hostEmbedding: hostVector,
        active: true,
        answeredIds: new Set(),
        timeLeft: ROUND_DURATION,
      };

      io.to(roomId).emit("receive_prompt", {
        image,
        points,
        timeLeft: ROUND_DURATION,
      });

      // Countdown ticker
      rooms[roomId].timerInterval = setInterval(() => {
        const round = rooms[roomId]?.currentRound;
        if (!round || !round.active) return;
        round.timeLeft = Math.max(0, round.timeLeft - 1);
        io.to(roomId).emit("timer_tick", { timeLeft: round.timeLeft });
      }, 1000);

      // Auto-end after ROUND_DURATION
      rooms[roomId].roundTimeout = setTimeout(() => {
        endRound(roomId);
      }, ROUND_DURATION * 1000);

      console.log(
        `📨 New round in ${roomId} — ${points} pts, ${ROUND_DURATION}s`
      );
    } catch (error) {
      socket.emit("prompt_processing", false);
      console.error("❌ Host_prompt error:", error);
      socket.emit(
        "error_message",
        `Failed to process prompt: ${error.message}`
      );
    }
  });

  // ── PLAYER SUBMITS ANSWER ───────────────────
  socket.on("User_ans", async ({ userPrompt, roomId }) => {
    if (!rooms[roomId]) return;

    const round = rooms[roomId].currentRound;
    if (!round || !round.active) {
      return socket.emit("error_message", "Round is not active");
    }

    if (round.answeredIds.has(socket.id)) {
      return socket.emit("error_message", "You already answered this round");
    }

    round.answeredIds.add(socket.id);

    try {
      const userVector = await embedding(userPrompt);
      const score = similarity(userVector, round.hostEmbedding);
      const gainedPoints = Math.round(score * round.points);

      rooms[roomId].players = rooms[roomId].players.map((player) => {
        if (player.id === socket.id) player.score += gainedPoints;
        return player;
      });

      socket.emit("score_result", {
        gained: gainedPoints,
        similarity: Math.round(score * 100),
      });
      io.to(roomId).emit("update_players", rooms[roomId].players);

      // End early if everyone answered
      const playerCount = rooms[roomId].players.length;
      if (round.answeredIds.size >= playerCount && playerCount > 0) {
        endRound(roomId);
      }
    } catch (error) {
      console.error("❌ User_ans error:", error);
      // ✅ FIX 5: Remove from answeredIds so player can retry after a transient error
      round.answeredIds.delete(socket.id);
      socket.emit("error_message", `Error scoring answer: ${error.message}`);
    }
  });

  // ── HOST ENDS ROUND MANUALLY ────────────────
  socket.on("end_round", ({ roomId }) => {
    if (!rooms[roomId]) return;
    if (rooms[roomId].host !== socket.id) return;
    endRound(roomId);
  });

  // ── RESET SCORES ────────────────────────────
  socket.on("reset_scores", ({ roomId }) => {
    if (!rooms[roomId]) return;
    if (rooms[roomId].host !== socket.id) return;

    rooms[roomId].players = rooms[roomId].players.map((p) => ({
      ...p,
      score: 0,
    }));
    io.to(roomId).emit("update_players", rooms[roomId].players);
    console.log(`🔄 Scores reset in room ${roomId}`);
  });

  // ── DISCONNECT ──────────────────────────────
  socket.on("disconnect", (reason) => {
    console.log(`❌ Disconnected: ${socket.id} — reason: ${reason}`);

    for (const roomId in rooms) {
      const room = rooms[roomId];

      // Host disconnected — tear down room
      if (room.host === socket.id) {
        clearRoomTimers(room);
        io.to(roomId).emit(
          "error_message",
          "Host disconnected — game ended"
        );
        delete rooms[roomId];
        console.log(`🗑  Room ${roomId} deleted (host left)`);
        continue;
      }

      // Player disconnected — remove from list
      const before = room.players.length;
      room.players = room.players.filter((p) => p.id !== socket.id);
      if (room.players.length < before) {
        io.to(roomId).emit("update_players", room.players);

        // If the round is active and everyone remaining has answered, end it
        const round = room.currentRound;
        if (
          round &&
          round.active &&
          room.players.length > 0 &&
          round.answeredIds.size >= room.players.length
        ) {
          endRound(roomId);
        }
      }
    }
  });
});