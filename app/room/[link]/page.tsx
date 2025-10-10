"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { socket } from "../../../lib/socket";

export default function GamePage() {
  const [players, setPlayers] = useState<{ name: string; score: number }[]>([]);
  const gameImage = "/photo-1525182008055-f88b95ff7980.jpeg";

  useEffect(() => {
    socket.on("update-players", (updatedPlayers) => {
      setPlayers(updatedPlayers);
    });

    return () => {
      socket.off("update-players");
    };
  }, []);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-100">
      {/* Left Side */}
      <div className="flex flex-col justify-center items-center w-full md:w-2/3 bg-white shadow-lg p-6 gap-6">
        <div className="w-full max-w-3xl">
          <div className="relative w-full h-64 md:h-[450px] rounded-2xl overflow-hidden shadow-lg">
            <Image
              src={gameImage}
              alt="Game Scene"
              fill
              className="object-cover rounded-2xl"
            />
          </div>
        </div>
      </div>

      {/* Right Side - Scoreboard */}
      <div className="flex flex-col w-full md:w-1/3 bg-gray-50 shadow-inner p-6 items-center">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Scoreboard</h2>
        <div className="w-full max-w-sm bg-white rounded-2xl shadow p-6">
          {players.length === 0 ? (
            <p className="text-gray-500 text-center">No players joined yet</p>
          ) : (
            players.map((player, index) => (
              <div
                key={index}
                className="flex justify-between p-3 border-b last:border-none"
              >
                <span className="font-medium text-gray-700">{player.name}</span>
                <span className="font-semibold text-indigo-600">{player.score}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
