"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getSocket } from "../../../lib/socket";
import { Socket } from "socket.io-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Player = { name: string; score: number };

type RoundResult = {
  correctPrompt: string;
  players: Player[];
};

export default function PlayerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params?.link as string;
  const playerName = searchParams.get("name");

  const [players, setPlayers] = useState<Player[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [gameImage, setGameImage] = useState<string | null>(null);
  const [inputPrompt, setInputPrompt] = useState("");
  const [currentPoints, setCurrentPoints] = useState("");
  const [hasAnswered, setHasAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [lastGain, setLastGain] = useState<{ gained: number; similarity: number } | null>(null);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!roomId || !playerName) return;
    const socket: Socket = getSocket();

    const onConnect = () => {
      setIsConnected(true);
      toast.success(`Joined as ${playerName}`);
    };
    const onDisconnect = () => {
      setIsConnected(false);
      toast.error("Disconnected from server");
    };
    const onUpdatePlayers = (p: Player[]) => setPlayers(p);

    const onReceivePrompt = (data: { image: string; points: string; timeLeft: number }) => {
      setGameImage(data.image);
      setCurrentPoints(data.points);
      setTimeLeft(data.timeLeft);
      setInputPrompt("");
      setHasAnswered(false);
      setRoundResult(null);
      setLastGain(null);
      toast.info(`New round — ${data.points} pts`);
      setTimeout(() => inputRef.current?.focus(), 100);
    };

    const onTimerTick = ({ timeLeft: t }: { timeLeft: number }) => setTimeLeft(t);

    const onScoreResult = (data: { gained: number; similarity: number }) => {
      setLastGain(data);
      if (data.gained > 0) {
        toast.success(`+${data.gained} pts (${data.similarity}% match)`);
      } else {
        toast.error("No points this round");
      }
    };

    const onRoundOver = (result: RoundResult) => {
      setRoundResult(result);
      setTimeLeft(0);
      toast.info("Round over — see the answer!");
    };

    const onError = (msg: string) => toast.error(msg);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("update_players", onUpdatePlayers);
    socket.on("receive_prompt", onReceivePrompt);
    socket.on("timer_tick", onTimerTick);
    socket.on("score_result", onScoreResult);
    socket.on("round_over", onRoundOver);
    socket.on("error_message", onError);

    if (!socket.connected) socket.connect();
    else onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("update_players", onUpdatePlayers);
      socket.off("receive_prompt", onReceivePrompt);
      socket.off("timer_tick", onTimerTick);
      socket.off("score_result", onScoreResult);
      socket.off("round_over", onRoundOver);
      socket.off("error_message", onError);
    };
  }, [roomId, playerName]);

  const handleSubmit = () => {
    if (!inputPrompt.trim()) return toast.warning("Type something first");
    const socket: Socket = getSocket();
    socket.emit("User_ans", { userPrompt: inputPrompt, roomId });
    setHasAnswered(true);
    setInputPrompt("");
  };

  const handleExit = () => {
    getSocket().disconnect();
    router.push("/");
  };

  const timerPct = timeLeft !== null && currentPoints ? (timeLeft / 60) * 100 : 100;
  const timerColor = timeLeft === null ? "#6366f1" : timeLeft > 20 ? "#6366f1" : timeLeft > 10 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Mono', monospace", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 40,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#fff", fontSize: 18, fontWeight: 700, letterSpacing: "-0.03em" }}>prompto</span>
          <span style={{
            fontSize: 11, padding: "3px 10px", borderRadius: 100,
            background: isConnected ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
            color: isConnected ? "#34d399" : "#f87171",
            border: `1px solid ${isConnected ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
          }}>
            {isConnected ? "● connected" : "○ disconnected"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#6b7280", fontSize: 12 }}>{playerName}</span>
          <button onClick={handleExit} style={exitBtnStyle}>Exit</button>
        </div>
      </div>

      {/* Timer bar */}
      {timeLeft !== null && gameImage && (
        <div style={{ height: 3, background: "#1f2937", width: "100%" }}>
          <div style={{
            height: "100%", width: `${timerPct}%`,
            background: timerColor,
            transition: "width 1s linear, background 0.3s",
          }} />
        </div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 24px", gap: 24, maxWidth: 900, margin: "0 auto", width: "100%" }}>

        {/* Timer display */}
        {timeLeft !== null && gameImage && !roundResult && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: timerColor, fontSize: 28, fontWeight: 700, letterSpacing: "-0.04em", transition: "color 0.3s" }}>
              {timeLeft}
            </span>
            <span style={{ color: "#4b5563", fontSize: 14 }}>seconds left</span>
            {currentPoints && (
              <span style={{
                marginLeft: 12, fontSize: 12, padding: "4px 12px",
                background: "rgba(99,102,241,0.15)", color: "#a5b4fc",
                border: "1px solid rgba(99,102,241,0.3)", borderRadius: 100,
              }}>
                {currentPoints} pts
              </span>
            )}
          </div>
        )}

        {/* Image */}
        <div style={{
          width: "100%", background: "#111", borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.07)",
          overflow: "hidden", minHeight: 280,
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative",
        }}>
          {gameImage ? (
            <Image src={gameImage} alt="Round image" width={900} height={500}
              style={{ width: "100%", height: "auto", maxHeight: 480, objectFit: "contain", display: "block" }} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 48 }}>
              <div style={{ width: 40, height: 40, border: "2px solid #374151", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              <span style={{ color: "#4b5563", fontSize: 14 }}>Waiting for host to start a round...</span>
            </div>
          )}
        </div>

        {/* Round result reveal */}
        {roundResult && (
          <div style={{
            width: "100%", background: "#111", border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: 12, padding: "20px 24px",
          }}>
            <div style={{ color: "#a5b4fc", fontSize: 11, letterSpacing: "0.1em", marginBottom: 8 }}>CORRECT PROMPT</div>
            <div style={{ color: "#fff", fontSize: 18, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.4 }}>
              &quot;{roundResult.correctPrompt}&quot;
            </div>
            {lastGain && (
              <div style={{ marginTop: 14, display: "flex", gap: 16 }}>
                <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, padding: "8px 16px" }}>
                  <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 2 }}>Points gained</div>
                  <div style={{ color: "#34d399", fontSize: 20, fontWeight: 700 }}>+{lastGain.gained}</div>
                </div>
                <div style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, padding: "8px 16px" }}>
                  <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 2 }}>Similarity</div>
                  <div style={{ color: "#a5b4fc", fontSize: 20, fontWeight: 700 }}>{lastGain.similarity}%</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Answer input */}
        {gameImage && !roundResult && (
          <div style={{ width: "100%", display: "flex", gap: 10 }}>
            <input
              ref={inputRef}
              type="text"
              placeholder={hasAnswered ? "Answer submitted — wait for next round" : "Type your guess..."}
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !hasAnswered && handleSubmit()}
              disabled={hasAnswered}
              style={{
                flex: 1, padding: "13px 16px",
                background: hasAnswered ? "#0f0f0f" : "#111",
                border: `1px solid ${hasAnswered ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.12)"}`,
                borderRadius: 10, color: hasAnswered ? "#4b5563" : "#fff",
                fontSize: 15, fontFamily: "inherit", outline: "none",
                cursor: hasAnswered ? "not-allowed" : "text",
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={hasAnswered}
              style={{
                padding: "13px 24px",
                background: hasAnswered ? "#1f2937" : "#6366f1",
                color: hasAnswered ? "#4b5563" : "#fff",
                border: "none", borderRadius: 10,
                fontSize: 14, fontWeight: 600, cursor: hasAnswered ? "not-allowed" : "pointer",
                fontFamily: "inherit", transition: "all 0.15s", whiteSpace: "nowrap",
              }}
            >
              {hasAnswered ? "Submitted ✓" : "Submit"}
            </button>
          </div>
        )}

        {/* Scoreboard */}
        {players.length > 0 && (
          <div style={{ width: "100%", marginTop: 8 }}>
            <div style={{ color: "#4b5563", fontSize: 11, letterSpacing: "0.1em", marginBottom: 12 }}>SCOREBOARD</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[...players].sort((a, b) => b.score - a.score).map((p, i) => (
                <div key={p.name} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 16px",
                  background: p.name === playerName ? "rgba(99,102,241,0.1)" : "#111",
                  border: `1px solid ${p.name === playerName ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)"}`,
                  borderRadius: 10,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ color: i === 0 ? "#f59e0b" : "#374151", fontSize: 13, minWidth: 20 }}>
                      {i === 0 ? "★" : `${i + 1}.`}
                    </span>
                    <span style={{ color: p.name === playerName ? "#a5b4fc" : "#e5e7eb", fontSize: 14, fontWeight: p.name === playerName ? 600 : 400 }}>
                      {p.name}{p.name === playerName ? " (you)" : ""}
                    </span>
                  </div>
                  <span style={{ color: "#9ca3af", fontSize: 14, fontFamily: "inherit" }}>
                    {p.score.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus { border-color: rgba(99,102,241,0.5) !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
      `}</style>
    </div>
  );
}

const exitBtnStyle: React.CSSProperties = {
  padding: "6px 14px", background: "transparent",
  color: "#6b7280", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 7, fontSize: 12, cursor: "pointer", fontFamily: "'DM Mono', monospace",
};