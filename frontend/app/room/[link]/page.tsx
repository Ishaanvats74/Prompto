"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getSocket } from "../../../lib/socket";
import { Socket } from "socket.io-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Player = {
  name: string;
  score: number;
};

export default function Page() {
  const params = useParams();
  const searchParams = useSearchParams();

  const roomId = params?.link as string;
  const playerName = searchParams.get("name");

  const [players, setPlayers] = useState<Player[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [gameImage, setGameImage] = useState<string | null>(null);
  const [inputPrompt, setInputPrompt] = useState<string>("");
  const [currentPoints, setCurrentPoints] = useState<string>("");
  const [hasAnswered, setHasAnswered] = useState<boolean>(false);

  const hasJoinedRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (!roomId || !playerName) return;

    const socket = getSocket();
    if (!socket.connected) socket.connect();

    if (!hasJoinedRef.current) {
      socket.emit("join_room", { roomId, playerName });
      hasJoinedRef.current = true;
      toast.success(`Joined room as ${playerName} 🎉`);
    }

    const handleConnect = () => {
      setIsConnected(true);
      toast.success("Connected to server 🟢");
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      toast.error("Disconnected from server 🔴");
    };

    const handleUpdatePlayers = (updatedPlayers: Player[]) => {
      setPlayers(updatedPlayers);
    };

    const handleReceivePrompt = (data: { image: string; points: string }) => {
      setGameImage(data.image);
      setCurrentPoints(data.points);
      setInputPrompt("");
      setHasAnswered(false);
      toast.info(`New round started! ${data.points} points 🎯`);
    };

    const handleError = (msg: string) => {
      toast.error(msg);
    };
    const handleScoreResult = (data: { gained: number }) => {
      if (data.gained > 0) {
        toast.success(`🔥 You gained ${data.gained} points!`);
      } else {
        toast.error("0 points this round 😅");
      }
    };

    socket.off("connect", handleConnect);
    socket.off("disconnect", handleDisconnect);
    socket.off("update-players", handleUpdatePlayers);
    socket.off("receive_prompt", handleReceivePrompt);
    socket.off("error_message", handleError);
    socket.off("score_result", handleScoreResult);

    socket.on("score_result", handleScoreResult);
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("update-players", handleUpdatePlayers);
    socket.on("receive_prompt", handleReceivePrompt);
    socket.on("error_message", handleError);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("update-players", handleUpdatePlayers);
      socket.off("receive_prompt", handleReceivePrompt);
      socket.off("error_message", handleError);
      socket.off("score_result", handleScoreResult);
    };
  }, [roomId, playerName]);

  const handleExitGame = () => {
    const socket = getSocket();

    socket.disconnect(); // leave socket cleanly

    toast.info("You left the game 👋");

    router.push("/");
  };

  const handleSubmit = () => {
    if (!inputPrompt.trim()) {
      toast.warning("Please enter an answer first ⚠️");
      return;
    }

    const socket: Socket = getSocket();

    socket.emit("User_ans", {
      userPrompt: inputPrompt,
      roomId,
    });

    setHasAnswered(true);
    toast.success("Answer submitted 🚀");
    setInputPrompt("");
  };

  return (
    <div className="relative min-h-screen flex flex-col lg:flex-row bg-gray-100 pt-20 sm:pt-24">
      {/* ================= TOP EXIT BUTTON ================= */}
      <div className="absolute top-4 left-4 z-50">
        <button
          onClick={handleExitGame}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-lg transition"
        >
          Exit Game
        </button>
      </div>

      {/* ================= LEFT SIDE ================= */}
      <div className="flex flex-col justify-center items-center w-full lg:w-2/3 bg-white p-4 sm:p-6 md:p-10 gap-6">
        <div className="w-full max-w-4xl">
          {/* Points */}
          {currentPoints && (
            <div className="text-center mb-4">
              <p className="text-indigo-600 text-base sm:text-lg md:text-xl font-semibold">
                {currentPoints} Points
              </p>
            </div>
          )}

          {/* IMAGE CONTAINER */}
          <div className="relative w-full bg-gray-100 rounded-2xl shadow-lg p-4 sm:p-6 flex items-center justify-center">
            {gameImage ? (
              <Image
                src={gameImage}
                alt="Game Scene"
                width={900}
                height={900}
                className="object-contain w-full h-auto max-h-[250px] sm:max-h-[350px] md:max-h-[500px] rounded-xl"
              />
            ) : (
              <div className="h-48 sm:h-64 flex items-center justify-center text-gray-400 text-base sm:text-lg">
                Waiting for host...
              </div>
            )}
          </div>

          {/* ANSWER INPUT */}
          <div className="mt-6 w-full">
            <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl shadow-md">
              <input
                type="text"
                placeholder="Type your answer..."
                className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm sm:text-base ${
                  hasAnswered ? "bg-gray-200 cursor-not-allowed" : ""
                }`}
                onChange={(e) => setInputPrompt(e.target.value)}
                value={inputPrompt}
                disabled={hasAnswered}
              />

              <button
                disabled={hasAnswered}
                className={`w-full sm:w-auto px-6 py-3 text-white font-semibold rounded-lg shadow transition ${
                  hasAnswered
                    ? "bg-gray-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-indigo-600 to-blue-600 hover:scale-105"
                }`}
                onClick={handleSubmit}
              >
                {hasAnswered ? "Answered ✔" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================= RIGHT SIDE (SCOREBOARD) ================= */}
      <div className="flex flex-col w-full lg:w-1/3 bg-gray-50 p-4 sm:p-6 md:p-8 items-center">
        <h2 className="text-xl sm:text-2xl font-bold mb-6 text-gray-800 text-center">
          Scoreboard
        </h2>

        <div className="w-full max-w-md bg-white rounded-2xl shadow p-4 sm:p-6 max-h-[400px] overflow-y-auto">
          {players.length === 0 ? (
            <p className="text-gray-500 text-center text-sm sm:text-base">
              Waiting for players...
            </p>
          ) : (
            players.map((player, index) => (
              <div
                key={index}
                className="flex justify-between items-center py-3 border-b last:border-none"
              >
                <span className="font-medium text-gray-700 text-sm sm:text-base truncate">
                  {player.name}
                </span>
                <span className="font-semibold text-indigo-600 text-sm sm:text-base">
                  {player.score}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 text-xs sm:text-sm text-gray-600 text-center break-all">
          <p>Status: {isConnected ? "🟢 Connected" : "🔴 Disconnected"}</p>
          <p>Room: {roomId}</p>
          <p>You: {playerName}</p>
        </div>
      </div>
    </div>
  );
}
