# 🎮 Prompto – Real-Time AI Prompt Guessing Game

Prompto is a real-time multiplayer game where:

- 🧑‍💻 A host creates a room
- 🖼 Host generates or uploads an image
- 📝 Host sets a prompt + point value
- 👥 Players join the room
- 💬 Players submit their guess
- 🧠 AI embeddings + cosine similarity calculate score
- 🏆 Scoreboard updates live via Socket.IO

---

## 🚀 Tech Stack

### Frontend
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Socket.IO Client

### Backend
- Node.js
- Express (HTTP server)
- Socket.IO
- Google Gemini Embedding API
- Cosine Similarity (compute-cosine-similarity)

---

## 🧠 How Scoring Works

1. Host prompt → Embedded using Gemini
2. Player answer → Embedded using Gemini
3. Cosine similarity is calculated
4. Final score = similarity × round points

Example:
Round Points: 5000
Similarity: 0.82

Final Score = 0.82 × 5000 = 4100


---

## 📦 Project Structure

Prompto/
│
├── backend/
│ ├── server.js
│ ├── package.json
│
├── frontend/
│ ├── app/
│ ├── lib/socket.ts
│ ├── package.json
│
└── README.md


---

## 🛠 Running Locally

### 1️⃣ Backend
cd backend
npm install
node server.js


### 2️⃣ Frontend
cd frontend
npm install
npm run dev


---

## 🌍 Deployment

### Backend → Render  
Start Command:
node server.js


### Frontend → Vercel

---

## 🔐 Environment Variables

Backend `.env` file:

GEMINI_API_KEY=your_api_key_here


---

## 👨‍💻 Author
Built by Ishaan 🚀