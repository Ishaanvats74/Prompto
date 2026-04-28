"use client";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getSocket } from "../../../../lib/socket";
import { Socket } from "socket.io-client";
import { supabase } from "@/utils/supabase";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Player = { name: string; score: number };
type Step = "image" | "prompt" | "send";

export default function HostPage() {
  const params = useParams();
  const roomId = params?.link as string;
  const router = useRouter();

  const [step, setStep] = useState<Step>("image");
  const [image, setImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [scoreStage, setScoreStage] = useState("1000");
  const [players, setPlayers] = useState<Player[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastFilePath, setLastFilePath] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genStatus, setGenStatus] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [roundActive, setRoundActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [roundResult, setRoundResult] = useState<{ correctPrompt: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const genTimerRef = useRef<NodeJS.Timeout | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // Socket setup
  useEffect(() => {
    if (!roomId) return;
    const socket: Socket = getSocket();
    if (!socket.connected) socket.connect();

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    const onUpdatePlayers = (p: Player[]) => setPlayers(p);
    const onTimerTick = ({ timeLeft: t }: { timeLeft: number }) => setTimeLeft(t);
    const onRoundOver = (result: { correctPrompt: string }) => {
      setRoundActive(false);
      setRoundResult(result);
      setTimeLeft(null);
      toast.success("Round ended!");
    };
    const onPromptProcessing = (v: boolean) => setProcessing(v);
    const onError = (msg: string) => {
      toast.error(msg);
      setProcessing(false);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("update_players", onUpdatePlayers);
    socket.on("timer_tick", onTimerTick);
    socket.on("round_over", onRoundOver);
    socket.on("prompt_processing", onPromptProcessing);
    socket.on("error_message", onError);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("update_players", onUpdatePlayers);
      socket.off("timer_tick", onTimerTick);
      socket.off("round_over", onRoundOver);
      socket.off("prompt_processing", onPromptProcessing);
      socket.off("error_message", onError);
    };
  }, [roomId]);

  // Cleanup uploaded file on unmount
  useEffect(() => {
    return () => {
      if (lastFilePath) supabase.storage.from("game-images").remove([lastFilePath]);
    };
  }, [lastFilePath]);

  const handleExit = () => {
    getSocket().disconnect();
    router.push("/");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success("Room code copied!");
    } catch {
      toast.error("Failed to copy");
    }
  };

  // Image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      toast.loading("Uploading...", { id: "upload" });
      if (lastFilePath) await supabase.storage.from("game-images").remove([lastFilePath]);

      const fileName = `${roomId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("game-images").upload(fileName, file);
      if (error) { toast.error("Upload failed", { id: "upload" }); return; }

      const { data } = supabase.storage.from("game-images").getPublicUrl(fileName);
      setImage(data.publicUrl);
      setLastFilePath(fileName);
      toast.success("Image uploaded!", { id: "upload" });
      setStep("prompt");
      setTimeout(() => promptRef.current?.focus(), 100);
    } catch {
      toast.error("Upload failed", { id: "upload" });
    } finally {
      setIsUploading(false);
    }
  };

  // AI generate image with progress simulation
  const handleGenerate = async () => {
    if (!prompt) { toast.warning("Enter a prompt first"); return; }

    try {
      setIsGenerating(true);
      setGenProgress(0);
      setGenStatus("Sending to model...");

      // Simulate progress while waiting
      let prog = 0;
      const statuses = ["Warming up model...", "Generating image...", "Rendering details...", "Almost done..."];
      genTimerRef.current = setInterval(() => {
        prog = Math.min(prog + Math.random() * 3 + 0.5, 92);
        setGenProgress(Math.round(prog));
        setGenStatus(statuses[prog < 20 ? 0 : prog < 50 ? 1 : prog < 80 ? 2 : 3]);
      }, 300);

      toast.loading("Generating image...", { id: "gen" });
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();

      clearInterval(genTimerRef.current!);
      setGenProgress(95);
      setGenStatus("Uploading to storage...");

      if (data.error) { toast.error("Generation failed", { id: "gen" }); return; }

      if (lastFilePath) await supabase.storage.from("game-images").remove([lastFilePath]);

      const res = await fetch(data.image);
      const blob = await res.blob();
      const fileName = `${roomId}/${Date.now()}-generated.png`;
      const { error } = await supabase.storage.from("game-images").upload(fileName, blob);
      if (error) { toast.error("Upload failed", { id: "gen" }); return; }

      const { data: pub } = supabase.storage.from("game-images").getPublicUrl(fileName);
      setImage(pub.publicUrl);
      setLastFilePath(fileName);
      setGenProgress(100);
      setGenStatus("Done!");
      toast.success("Image ready!", { id: "gen" });
      setStep("prompt");
      setTimeout(() => promptRef.current?.focus(), 100);
    } catch {
      toast.error("Something went wrong", { id: "gen" });
    } finally {
      clearInterval(genTimerRef.current!);
      setIsGenerating(false);
    }
  };

  const handleSendPrompt = () => {
    if (!prompt || !image) { toast.warning("Image and prompt required"); return; }
    const socket = getSocket();
    socket.emit("Host_prompt", { roomId, prompt, points: scoreStage, image });
    setRoundActive(true);
    setRoundResult(null);
    setTimeLeft(60);
    toast.success("Round started!");
    setStep("image"); // reset for next round
    setPrompt("");
    setImage(null);
  };

  const handleEndRound = () => {
    getSocket().emit("end_round", { roomId });
  };

  const timerColor = timeLeft === null ? "#6366f1" : timeLeft > 20 ? "#6366f1" : timeLeft > 10 ? "#f59e0b" : "#ef4444";

  const STEPS: Step[] = ["image", "prompt", "send"];
  const stepIdx = STEPS.indexOf(step);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Mono', monospace", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 40, flexWrap: "wrap", gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#fff", fontSize: 18, fontWeight: 700, letterSpacing: "-0.03em" }}>prompto</span>
          <span style={{
            fontSize: 11, padding: "3px 10px", borderRadius: 100,
            background: "rgba(99,102,241,0.12)", color: "#a5b4fc",
            border: "1px solid rgba(99,102,241,0.3)",
          }}>HOST</span>
          <span style={{
            fontSize: 11, padding: "3px 10px", borderRadius: 100,
            background: isConnected ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
            color: isConnected ? "#34d399" : "#f87171",
            border: `1px solid ${isConnected ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
          }}>
            {isConnected ? "● live" : "○ offline"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={handleCopy} style={topBtnStyle}>Copy code</button>
          {roundActive && (
            <button onClick={handleEndRound} style={{ ...topBtnStyle, color: "#f59e0b", borderColor: "rgba(245,158,11,0.3)" }}>
              End round
            </button>
          )}
          <button onClick={handleExit} style={{ ...topBtnStyle, color: "#f87171", borderColor: "rgba(239,68,68,0.2)" }}>Exit</button>
        </div>
      </div>

      {/* Timer bar */}
      {roundActive && timeLeft !== null && (
        <div style={{ height: 3, background: "#1f2937" }}>
          <div style={{
            height: "100%", width: `${(timeLeft / 60) * 100}%`,
            background: timerColor, transition: "width 1s linear, background 0.3s",
          }} />
        </div>
      )}

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 300px", gap: 0, maxWidth: 1100, margin: "0 auto", width: "100%", padding: "0 16px" }}>

        {/* LEFT — Wizard */}
        <div style={{ padding: "28px 24px 28px 0", display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Round status */}
          {roundActive && timeLeft !== null && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "#111", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12, padding: "14px 20px",
            }}>
              <span style={{ color: "#9ca3af", fontSize: 13 }}>Round active</span>
              <span style={{ color: timerColor, fontSize: 24, fontWeight: 700, letterSpacing: "-0.04em", transition: "color 0.3s" }}>
                {timeLeft}s
              </span>
            </div>
          )}

          {/* Round result */}
          {roundResult && (
            <div style={{
              background: "#111", border: "1px solid rgba(99,102,241,0.3)",
              borderRadius: 12, padding: "16px 20px",
            }}>
              <div style={{ color: "#6b7280", fontSize: 11, letterSpacing: "0.1em", marginBottom: 6 }}>LAST ROUND — CORRECT PROMPT</div>
              <div style={{ color: "#e5e7eb", fontSize: 16, lineHeight: 1.5 }}>&quot;{roundResult.correctPrompt}&quot;</div>
            </div>
          )}

          {/* Step tabs */}
          <div style={{ display: "flex", gap: 4 }}>
            {(["image", "prompt", "send"] as Step[]).map((s, i) => (
              <button key={s} onClick={() => setStep(s)} style={{
                padding: "7px 18px", borderRadius: 100, fontSize: 12, fontWeight: 500,
                cursor: "pointer", fontFamily: "inherit",
                background: step === s ? "#1a1a2e" : "transparent",
                color: step === s ? "#a5b4fc" : "#4b5563",
                border: `1px solid ${step === s ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.06)"}`,
                transition: "all 0.15s",
              }}>
                {i + 1} — {s}
              </button>
            ))}
          </div>

          {/* Step: Image */}
          {step === "image" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Upload zone */}
              <label style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 10, minHeight: 200, background: "#111",
                border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 14,
                cursor: "pointer", transition: "border-color 0.15s", padding: 24,
              }}>
                {image ? (
                  <Image src={image} alt="Preview" width={800} height={400}
                    style={{ width: "100%", maxHeight: 260, objectFit: "contain", borderRadius: 8 }} />
                ) : (
                  <>
                    <div style={{ width: 44, height: 44, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
                      </svg>
                    </div>
                    <span style={{ color: "#6b7280", fontSize: 14 }}>Click to upload image</span>
                    <span style={{ color: "#374151", fontSize: 12 }}>PNG, JPG, WEBP</span>
                  </>
                )}
                <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} disabled={isUploading} />
              </label>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
                <span style={{ color: "#374151", fontSize: 12 }}>or generate</span>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <input
                  type="text"
                  placeholder="Describe the image you want..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !isGenerating && handleGenerate()}
                  style={{ ...darkInputStyle, flex: 1 }}
                />
                <button onClick={handleGenerate} disabled={isGenerating || isUploading} style={primaryBtnStyle}>
                  {isGenerating ? "..." : "Generate"}
                </button>
              </div>

              {/* Generation progress */}
              {isGenerating && (
                <div style={{ background: "#111", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ color: "#9ca3af", fontSize: 13 }}>{genStatus}</span>
                    <span style={{ color: "#6366f1", fontSize: 13, fontWeight: 600 }}>{genProgress}%</span>
                  </div>
                  <div style={{ height: 4, background: "#1f2937", borderRadius: 100, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${genProgress}%`, background: "#6366f1", borderRadius: 100, transition: "width 0.3s" }} />
                  </div>
                </div>
              )}

              {image && (
                <button onClick={() => setStep("prompt")} style={primaryBtnStyle}>
                  Next — add prompt →
                </button>
              )}
            </div>
          )}

          {/* Step: Prompt */}
          {step === "prompt" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {image && (
                <Image src={image} alt="Selected" width={800} height={300}
                  style={{ width: "100%", maxHeight: 200, objectFit: "contain", borderRadius: 10, background: "#111", border: "1px solid rgba(255,255,255,0.06)" }} />
              )}
              <div>
                <div style={{ color: "#6b7280", fontSize: 11, letterSpacing: "0.1em", marginBottom: 8 }}>SECRET PROMPT (players guess this)</div>
                <textarea
                  ref={promptRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe exactly what's in the image — players must guess this..."
                  rows={4}
                  style={{
                    width: "100%", padding: "12px 14px", background: "#111",
                    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
                    color: "#fff", fontSize: 14, fontFamily: "inherit",
                    resize: "none", outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setStep("image")} style={ghostBtnStyle}>← Back</button>
                <button onClick={() => setStep("send")} disabled={!prompt.trim()} style={{ ...primaryBtnStyle, flex: 1, opacity: !prompt.trim() ? 0.5 : 1 }}>
                  Next — review →
                </button>
              </div>
            </div>
          )}

          {/* Step: Send */}
          {step === "send" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {image && (
                <Image src={image} alt="Final" width={800} height={300}
                  style={{ width: "100%", maxHeight: 200, objectFit: "contain", borderRadius: 10, background: "#111", border: "1px solid rgba(255,255,255,0.06)" }} />
              )}

              {/* Summary */}
              <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                <Row label="Prompt" value={prompt || "—"} />
                <Row label="Points" value={`${scoreStage} pts`} />
                <Row label="Players waiting" value={`${players.length}`} />
                <Row label="Round duration" value="60 seconds" />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <select
                  value={scoreStage}
                  onChange={(e) => setScoreStage(e.target.value)}
                  style={{ ...darkInputStyle, flex: 1 }}
                >
                  {["1000", "2000", "3000", "4000", "5000"].map((v) => (
                    <option key={v} value={v}>{v} points</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setStep("prompt")} style={ghostBtnStyle}>← Back</button>
                <button
                  onClick={handleSendPrompt}
                  disabled={processing || !image || !prompt}
                  style={{
                    flex: 1, padding: "13px", background: processing ? "#064e3b" : "#059669",
                    color: "#ecfdf5", border: "none", borderRadius: 10,
                    fontSize: 14, fontWeight: 600, cursor: processing ? "not-allowed" : "pointer",
                    fontFamily: "inherit", opacity: !image || !prompt ? 0.5 : 1,
                  }}
                >
                  {processing ? "Processing embed..." : "Send to players →"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Scoreboard */}
        <div style={{
          borderLeft: "1px solid rgba(255,255,255,0.07)",
          padding: "28px 0 28px 24px",
          display: "flex", flexDirection: "column", gap: 16,
        }}>
          <div>
            <div style={{ color: "#4b5563", fontSize: 11, letterSpacing: "0.1em", marginBottom: 4 }}>ROOM CODE</div>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "#111", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 9, padding: "10px 14px",
            }}>
              <span style={{ color: "#e5e7eb", fontSize: 13, fontFamily: "inherit", letterSpacing: "0.05em" }}>
                {roomId?.slice(0, 12)}...
              </span>
              <button onClick={handleCopy} style={{ background: "none", border: "none", color: "#6366f1", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                copy
              </button>
            </div>
          </div>

          <div>
            <div style={{ color: "#4b5563", fontSize: 11, letterSpacing: "0.1em", marginBottom: 10 }}>
              SCOREBOARD ({players.length} player{players.length !== 1 ? "s" : ""})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {players.length === 0 ? (
                <div style={{ color: "#374151", fontSize: 13, padding: "20px 0", textAlign: "center" }}>
                  Waiting for players...
                </div>
              ) : (
                [...players].sort((a, b) => b.score - a.score).map((p, i) => (
                  <div key={p.name} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "9px 12px",
                    background: "#111",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 9,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ color: i === 0 ? "#f59e0b" : "#374151", fontSize: 12, minWidth: 16 }}>
                        {i === 0 ? "★" : `${i + 1}`}
                      </span>
                      <span style={{ color: "#e5e7eb", fontSize: 13 }}>{p.name}</span>
                    </div>
                    <span style={{ color: "#9ca3af", fontSize: 13 }}>{p.score.toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;600;700&display=swap');
        textarea:focus, input:focus, select:focus { border-color: rgba(99,102,241,0.5) !important; outline: none; }
        button:hover:not(:disabled) { opacity: 0.85; }
      `}</style>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
      <span style={{ color: "#6b7280" }}>{label}</span>
      <span style={{ color: "#e5e7eb", maxWidth: "60%", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}

const darkInputStyle: React.CSSProperties = {
  padding: "11px 14px", background: "#111",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9,
  color: "#fff", fontSize: 13, fontFamily: "'DM Mono', monospace",
  outline: "none",
};

const primaryBtnStyle: React.CSSProperties = {
  padding: "11px 20px", background: "#6366f1", color: "#fff",
  border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600,
  cursor: "pointer", fontFamily: "'DM Mono', monospace", transition: "all 0.15s",
};

const ghostBtnStyle: React.CSSProperties = {
  padding: "11px 18px", background: "transparent", color: "#6b7280",
  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9,
  fontSize: 13, cursor: "pointer", fontFamily: "'DM Mono', monospace",
};

const topBtnStyle: React.CSSProperties = {
  padding: "6px 14px", background: "transparent", color: "#9ca3af",
  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7,
  fontSize: 12, cursor: "pointer", fontFamily: "'DM Mono', monospace",
};