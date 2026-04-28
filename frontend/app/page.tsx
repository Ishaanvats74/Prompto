"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createId } from "@paralleldrive/cuid2";
import { getSocket } from "@/lib/socket";
import { Socket } from "socket.io-client";

export default function Home() {
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinLink, setJoinLink] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const router = useRouter();
  const playerNameRef = useRef(playerName);
  playerNameRef.current = playerName;

  useEffect(() => {
    const socket: Socket = getSocket();

    socket.off("room_created");
    socket.off("joined_room");
    socket.off("existing_name");
    socket.off("error_message");

    socket.on("room_created", (roomId: string) => {
      router.push(`/room/host/${roomId}`);
    });

    socket.on("joined_room", (roomId: string) => {
      router.push(`/room/${roomId}?name=${encodeURIComponent(playerNameRef.current)}`);
    });

    socket.on("existing_name", (err: string) => {
      alert(err);
      setJoining(false);
    });

    socket.on("error_message", (err: string) => {
      alert(err);
      setCreating(false);
      setJoining(false);
    });

    if (!socket.connected) socket.connect();

    return () => {
      socket.off("room_created");
      socket.off("joined_room");
      socket.off("existing_name");
      socket.off("error_message");
    };
  }, [router]);

  const handleCreate = () => {
    setCreating(true);
    const socket: Socket = getSocket();
    const link = createId();

    const doCreate = () => socket.emit("create_room", link);

    if (socket.connected) {
      doCreate();
    } else {
      socket.once("connect", doCreate);
      socket.connect();
    }
  };

  const handleJoin = () => {
    if (!joinLink.trim() || !playerName.trim()) {
      alert("Please fill in your name and the room code.");
      return;
    }
    setJoining(true);
    const socket: Socket = getSocket();

    const doJoin = () =>
      socket.emit("join_room", {
        roomId: joinLink.trim(),
        playerName: playerName.trim(),
      });

    if (socket.connected) {
      doJoin();
    } else {
      socket.once("connect", doJoin);
      socket.connect();
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'DM Mono', 'Courier New', monospace",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Grid background */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        pointerEvents: "none",
      }} />

      {/* Radial glow */}
      <div style={{
        position: "absolute", top: "30%", left: "50%",
        transform: "translate(-50%,-50%)",
        width: 600, height: 600,
        background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{
        position: "relative", zIndex: 1, textAlign: "center",
        padding: "0 24px", maxWidth: 600, width: "100%",
      }}>
        {/* Badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(99,102,241,0.1)",
          border: "1px solid rgba(99,102,241,0.3)",
          borderRadius: 100, padding: "6px 16px", marginBottom: 32,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "#6366f1", display: "inline-block",
            animation: "pulse 2s infinite",
          }} />
          <span style={{ color: "#a5b4fc", fontSize: 12, letterSpacing: "0.1em" }}>
            PROMPT GUESSING GAME
          </span>
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: "clamp(64px, 12vw, 96px)",
          fontWeight: 700,
          color: "#fff",
          letterSpacing: "-0.04em",
          lineHeight: 1,
          marginBottom: 16,
          fontFamily: "'DM Mono', monospace",
        }}>
          prompto
        </h1>

        <p style={{
          color: "#6b7280", fontSize: 16, marginBottom: 56,
          lineHeight: 1.6, letterSpacing: "0.01em",
        }}>
          Host shows an AI image. Players guess the prompt.<br />
          Closest guess wins the round.
        </p>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={handleCreate}
            disabled={creating}
            style={{
              padding: "14px 36px",
              background: creating ? "#3730a3" : "#6366f1",
              color: "#fff", border: "none", borderRadius: 10,
              fontSize: 15, fontWeight: 600,
              cursor: creating ? "not-allowed" : "pointer",
              fontFamily: "inherit", letterSpacing: "0.02em",
              transition: "all 0.15s",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {creating && (
              <span style={{
                width: 14, height: 14,
                border: "2px solid rgba(255,255,255,0.3)",
                borderTopColor: "#fff", borderRadius: "50%",
                display: "inline-block", animation: "spin 0.7s linear infinite",
              }} />
            )}
            {creating ? "Creating room..." : "Create Room"}
          </button>

          <button
            onClick={() => setJoinOpen(true)}
            style={{
              padding: "14px 36px",
              background: "transparent", color: "#e5e7eb",
              border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10,
              fontSize: 15, fontWeight: 600, cursor: "pointer",
              fontFamily: "inherit", letterSpacing: "0.02em",
              transition: "all 0.15s",
            }}
          >
            Join Room
          </button>
        </div>

        {/* How it works */}
        <div style={{
          display: "flex", gap: 24, marginTop: 64,
          justifyContent: "center", flexWrap: "wrap",
        }}>
          {[
            { n: "01", label: "Host generates or uploads an image" },
            { n: "02", label: "Players guess the original prompt" },
            { n: "03", label: "AI scores similarity — closest wins" },
          ].map(({ n, label }) => (
            <div key={n} style={{ textAlign: "left", maxWidth: 160 }}>
              <div style={{ color: "#6366f1", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}>{n}</div>
              <div style={{ color: "#9ca3af", fontSize: 13, lineHeight: 1.5 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Join Modal */}
      {joinOpen && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 50, padding: 24,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) { setJoinOpen(false); setJoining(false); } }}
        >
          <div style={{
            background: "#111",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 16, padding: "32px",
            width: "100%", maxWidth: 400,
            fontFamily: "'DM Mono', monospace",
          }}>
            <h2 style={{
              color: "#fff", fontSize: 20, fontWeight: 600,
              marginBottom: 24, letterSpacing: "-0.02em",
            }}>
              Join a room
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="text"
                placeholder="Your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                autoFocus
                style={inputStyle}
              />
              <input
                type="text"
                placeholder="Room code"
                value={joinLink}
                onChange={(e) => setJoinLink(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                onClick={handleJoin}
                disabled={joining}
                style={{
                  flex: 1, padding: "12px",
                  background: joining ? "#3730a3" : "#6366f1",
                  color: "#fff", border: "none", borderRadius: 8,
                  fontSize: 14, fontWeight: 600,
                  cursor: joining ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {joining && (
                  <span style={{
                    width: 12, height: 12,
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#fff", borderRadius: "50%",
                    display: "inline-block", animation: "spin 0.7s linear infinite",
                  }} />
                )}
                {joining ? "Joining..." : "Join"}
              </button>
              <button
                onClick={() => { setJoinOpen(false); setJoining(false); }}
                style={{
                  flex: 1, padding: "12px",
                  background: "transparent", color: "#9ca3af",
                  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                  fontSize: 14, fontWeight: 600, cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;600;700&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { to { transform: rotate(360deg); } }
        button:hover:not(:disabled) { opacity: 0.85 !important; transform: translateY(-1px); }
        input::placeholder { color: #4b5563; }
        input:focus { outline: none; border-color: rgba(99,102,241,0.5) !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
      `}</style>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  background: "#1a1a1a",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#fff",
  fontSize: 14,
  fontFamily: "'DM Mono', monospace",
  outline: "none",
  boxSizing: "border-box",
};