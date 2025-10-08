"use client";
import { useState } from "react";

export default function Home() {
  const [joinGame, setJoinGame] = useState<boolean>(false);

  return (
    <div className="h-screen w-full flex flex-col justify-center items-center bg-gradient-to-b from-gray-100 via-white to-gray-50 relative px-4 sm:px-6">
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 mb-4 tracking-tight text-center">
        Prompto
      </h1>

      <p className="text-md sm:text-lg md:text-xl text-gray-600 text-center max-w-md sm:max-w-lg mb-12">
        A sleek prompt-based game. Create a room or join one to challenge your
        friends instantly.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 mb-6 w-full sm:w-auto justify-center">
        <button className="w-full sm:w-auto px-6 py-3 sm:px-10 sm:py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg shadow-lg hover:scale-105 hover:from-blue-700 hover:to-indigo-700 transition-transform duration-200">
          Create a Room
        </button>
        <button
          className="w-full sm:w-auto px-6 py-3 sm:px-10 sm:py-4 bg-white border border-gray-300 text-gray-800 font-semibold rounded-lg shadow hover:scale-105 hover:bg-gray-50 transition-transform duration-200"
          onClick={() => setJoinGame(true)}
        >
          Join a Room
        </button>
      </div>

      <div className="absolute bottom-10 flex gap-2 sm:gap-3">
        <span className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-400 rounded-full animate-pulse"></span>
        <span className="w-2 h-2 sm:w-3 sm:h-3 bg-indigo-400 rounded-full animate-pulse delay-200"></span>
        <span className="w-2 h-2 sm:w-3 sm:h-3 bg-purple-400 rounded-full animate-pulse delay-400"></span>
      </div>

      <p className="mt-16 text-xs sm:text-sm text-gray-400 text-center">
        &copy; 2025 Prompto. All rights reserved.
      </p>

      <div
        className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity duration-500 ${
          joinGame ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div
          className={`bg-white rounded-xl shadow-2xl p-6 sm:p-8 max-w-xs sm:max-w-sm w-full text-center
            transform transition-all duration-500
            ${joinGame ? "scale-100 translate-y-0 opacity-100" : "scale-95 -translate-y-10 opacity-0"}`}
        >
          <h2 className="text-xl sm:text-2xl font-bold mb-4">Join Game</h2>
          <p className="text-gray-700 mb-6 text-sm sm:text-base">
            Enter the game link below to join instantly.
          </p>

          <input
            type="text"
            placeholder="Enter the link here"
            className="w-full px-3 sm:px-4 py-2 mb-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm sm:text-base"
          />

          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <button className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition">
              Join
            </button>
            <button
              className="w-full sm:w-auto px-4 py-2 bg-gray-300 text-gray-800 font-semibold rounded-lg hover:bg-gray-400 transition"
              onClick={() => setJoinGame(false)}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
