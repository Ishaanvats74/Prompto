"use client";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { socket } from "../../../../lib/socket";

export default function GamePage() {
  const params = useParams();
  const [image, setImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [scoreStage, setScoreStage] = useState("1000");
  const [gameLink, setGameLink] = useState<string>("");
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [transport, setTransport] = useState("");
  const [players, setPlayers] = useState<{ name: string; score: number }[]>([]);

  

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setImage(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    alert(`Submitted prompt "${prompt}" for ${scoreStage} points!`);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gradient-to-b from-gray-100 via-white to-gray-50">
      {/* Left Side */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 md:p-12 bg-white shadow-lg md:border-r">
        <h2 className="text-3xl font-extrabold mb-6 text-gray-900 text-center">
          Upload Image & Send Prompt
        </h2>

        <div className="w-full max-w-md flex flex-col gap-6">
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-500 transition-all duration-300">
            {image ? (
              <Image
                src={image}
                alt="Uploaded"
                width={400}
                height={400}
                className="rounded-lg w-full h-64 object-cover mb-4 shadow-md"
              />
            ) : (
              <p className="text-gray-400 mb-4">No image uploaded yet</p>
            )}
            <label className="cursor-pointer text-blue-600 hover:underline font-semibold">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              Upload Image
            </label>
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt here..."
            className="w-full h-28 p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 resize-none"
          />

          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <select
              value={scoreStage}
              onChange={(e) => setScoreStage(e.target.value)}
              className="w-full sm:w-1/2 border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 font-medium"
            >
              <option value="1000">1000 Points</option>
              <option value="2000">2000 Points</option>
              <option value="3000">3000 Points</option>
              <option value="4000">4000 Points</option>
              <option value="5000">5000 Points</option>
            </select>

            <button
              onClick={handleSubmit}
              className="w-full sm:w-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-3 rounded-xl shadow-lg hover:scale-105 transition-transform duration-200"
            >
              Send Prompt
            </button>
          </div>
        </div>
      </div>

      {/* Right Side - Scoreboard */}
      <div className="flex-1 flex flex-col items-center p-8 bg-gray-100">
        <h2 className="text-3xl font-extrabold mb-8 text-gray-900 text-center">
          Scoreboard
        </h2>

        <div className="w-full max-w-md bg-white shadow-2xl rounded-2xl p-6">
          {players.length > 0 ? (
            players.map((player, index) => (
              <div
                key={index}
                className="flex justify-between items-center py-3 border-b last:border-none"
              >
                <span className="font-medium text-gray-800">{player.name}</span>
                <span className="text-indigo-600 font-bold text-lg">
                  {player.score}
                </span>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center">Waiting for players...</p>
          )}
        </div>

        <div className="mt-6 text-sm text-gray-600">
          <p>Status: {isConnected ? "🟢 Connected" : "🔴 Disconnected"}</p>
          <p>Transport: {transport || "N/A"}</p>
          <p>Room: {gameLink}</p>
        </div>
      </div>
    </div>
  );
}
