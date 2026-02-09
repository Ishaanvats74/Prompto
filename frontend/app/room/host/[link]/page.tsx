"use client";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getSocket } from "../../../../lib/socket";
import { Socket } from "socket.io-client";
import { supabase } from "@/utils/supabase";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Player = {
  name: string;
  score: number;
};

export default function Page() {
  const params = useParams();
  const roomId = params?.link as string;

  const [image, setImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>("");
  const [scoreStage, setScoreStage] = useState<string>("1000");
  const [players, setPlayers] = useState<Player[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [gameLink, setGameLink] = useState<string>("");
  const [lastFilePath, setLastFilePath] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const router = useRouter();

  // ================= SOCKET =================
  useEffect(() => {
    if (!roomId) return;
    const socket: Socket = getSocket();

    if (!socket.connected) socket.connect();

    setGameLink(roomId);

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    const handleUpdatePlayers = (updatedPlayers: Player[]) =>
      setPlayers(updatedPlayers);

    socket.off("connect", handleConnect);
    socket.off("disconnect", handleDisconnect);
    socket.off("update-players", handleUpdatePlayers);

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("update-players", handleUpdatePlayers);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("update-players", handleUpdatePlayers);
    };
  }, [roomId]);

  const handleExitGame = () => {
    const socket = getSocket();
    socket.disconnect();

    toast.info("Game ended 👋");

    router.push("/");
  };

  const handleCopyLink = async () => {
    try {
      const link = `${window.location.origin}/room/${roomId}?name=PLAYER_NAME`;

      await navigator.clipboard.writeText(link);

      toast.success("Room link copied 📋");
    } catch (err) {
      console.log(err);
      toast.error("Failed to copy link ❌");
    }
  };

  // ================= IMAGE UPLOAD =================
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      toast.loading("Uploading image...", { id: "upload" });

      if (lastFilePath) {
        await supabase.storage.from("game-images").remove([lastFilePath]);
      }

      const fileName = `${roomId}/${Date.now()}-${file.name}`;

      const { error } = await supabase.storage
        .from("game-images")
        .upload(fileName, file);

      if (error) {
        toast.error("Upload failed ❌", { id: "upload" });
        setIsUploading(false);
        return;
      }

      const { data } = supabase.storage
        .from("game-images")
        .getPublicUrl(fileName);

      setImage(data.publicUrl);
      setLastFilePath(fileName);

      toast.success("Image uploaded successfully 🎉", { id: "upload" });
      setIsUploading(false);
    } catch (err) {
      console.log(err);
      toast.error("Unexpected error during upload ❌", { id: "upload" });
      setIsUploading(false);
    }
  };

  // ================= SEND PROMPT =================
  const handleSubmit = () => {
    if (!prompt || !image) {
      toast.warning("Upload or generate an image first ⚠️");
      return;
    }

    const socket = getSocket();

    socket.emit("Host_prompt", {
      roomId,
      prompt,
      points: scoreStage,
      image,
    });

    toast.success("Prompt sent to players 🚀");
  };

  // ================= GENERATE IMAGE =================
  const handleGenerate = async () => {
    if (!prompt) {
      toast.warning("Enter prompt first ⚠️");
      return;
    }

    try {
      setIsUploading(true);

      toast.loading("Generating image...", { id: "generate" });

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();

      if (data.error) {
        toast.error("Generation failed ❌", { id: "generate" });
        setIsUploading(false);
        return;
      }

      if (lastFilePath) {
        await supabase.storage.from("game-images").remove([lastFilePath]);
      }

      const res = await fetch(data.image);
      const blob = await res.blob();

      const fileName = `${roomId}/${Date.now()}-generated.png`;

      const { error } = await supabase.storage
        .from("game-images")
        .upload(fileName, blob);

      if (error) {
        toast.error("Upload failed ❌", { id: "generate" });
        setIsUploading(false);
        return;
      }

      const { data: publicData } = supabase.storage
        .from("game-images")
        .getPublicUrl(fileName);

      setImage(publicData.publicUrl);
      setLastFilePath(fileName);

      toast.success("Image generated successfully 🎨", {
        id: "generate",
      });

      setIsUploading(false);
    } catch (err) {
      console.log(err);
      toast.error("Something went wrong ❌", { id: "generate" });
      setIsUploading(false);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (lastFilePath) {
        supabase.storage.from("game-images").remove([lastFilePath]);
      }
    };
  }, [lastFilePath]);
  // ================= UI =================

  return (
    <div className="relative min-h-screen flex flex-col lg:flex-row bg-gradient-to-b from-gray-100 via-white to-gray-50 pt-20 sm:pt-24">
      {/* ================= TOP CONTROLS ================= */}
      <div className="absolute top-4 left-4 right-4 z-50 flex flex-col sm:flex-row gap-3 sm:gap-4">
        <button
          onClick={handleExitGame}
          className="w-full sm:w-auto px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-lg transition"
        >
          Exit Game
        </button>

        <button
          onClick={handleCopyLink}
          className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg transition"
        >
          Copy Link
        </button>
      </div>

      {/* ================= LEFT SIDE ================= */}
      <div className="w-full lg:w-1/2 flex flex-col items-center p-4 sm:p-6 md:p-10 bg-white lg:border-r">
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-6 text-gray-900 text-center">
          Host Room
        </h2>

        <div className="w-full max-w-lg flex flex-col gap-6">
          {/* Image Upload Box */}
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 sm:p-6 text-center hover:border-blue-500 transition-all duration-300">
            {image ? (
              <Image
                src={image}
                alt="Uploaded"
                width={800}
                height={800}
                className="rounded-lg w-full h-auto max-h-[250px] sm:max-h-[350px] md:max-h-[450px] object-contain mb-4 shadow-md"
              />
            ) : (
              <p className="text-gray-400 mb-4 text-sm sm:text-base">
                No image yet
              </p>
            )}

            <label className="cursor-pointer text-blue-600 font-semibold text-sm sm:text-base">
              Upload Image
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Prompt */}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt here..."
            className="w-full h-24 sm:h-28 md:h-32 p-3 sm:p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm sm:text-base"
          />

          {/* Points + Buttons */}
          <div className="flex flex-col gap-4">
            <select
              value={scoreStage}
              onChange={(e) => setScoreStage(e.target.value)}
              className="w-full border border-gray-300 rounded-xl p-2 sm:p-3 text-sm sm:text-base"
            >
              <option value="1000">1000 Points</option>
              <option value="2000">2000 Points</option>
              <option value="3000">3000 Points</option>
              <option value="4000">4000 Points</option>
              <option value="5000">5000 Points</option>
            </select>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleGenerate}
                disabled={isUploading}
                className={`w-full ${
                  isUploading
                    ? "bg-gray-600"
                    : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-105"
                } text-white font-semibold py-3 rounded-xl shadow-lg transition`}
              >
                {isUploading ? "Processing..." : "Generate Image"}
              </button>

              <button
                onClick={handleSubmit}
                disabled={isUploading}
                className={`w-full ${
                  isUploading
                    ? "bg-gray-600"
                    : "bg-gradient-to-r from-green-600 to-emerald-600 hover:scale-105"
                } text-white font-semibold py-3 rounded-xl shadow-lg transition`}
              >
                Send Prompt
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================= RIGHT SIDE ================= */}
      <div className="w-full lg:w-1/2 flex flex-col items-center p-4 sm:p-6 bg-gray-100">
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-6 sm:mb-8 text-gray-900 text-center">
          Scoreboard
        </h2>

        <div className="w-full max-w-lg bg-white shadow-xl rounded-2xl p-4 sm:p-6 max-h-[400px] overflow-y-auto">
          {players.length > 0 ? (
            players.map((player, index) => (
              <div
                key={index}
                className="flex justify-between items-center py-3 border-b last:border-none"
              >
                <span className="font-medium text-gray-800 text-sm sm:text-base">
                  {player.name}
                </span>
                <span className="text-indigo-600 font-bold text-base sm:text-lg">
                  {player.score}
                </span>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center text-sm sm:text-base">
              Waiting for players...
            </p>
          )}
        </div>

        <div className="mt-6 text-xs sm:text-sm text-gray-600 text-center">
          <p>Status: {isConnected ? "🟢 Connected" : "🔴 Disconnected"}</p>
          <p className="break-all">Room: {gameLink}</p>
        </div>
      </div>
    </div>
  );
}
