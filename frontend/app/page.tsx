"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createId } from "@paralleldrive/cuid2";
import { getSocket } from "@/lib/socket";
import { Socket } from "socket.io-client";

export default function Home() {
  const [joinGame, setJoinGame] = useState<boolean>(false);
  const [joinLink, setJoinLink] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");
  const router = useRouter();

  const playerNameRef = useRef(playerName);
  playerNameRef.current = playerName;

  useEffect(() => {
    const socket: Socket = getSocket();

    socket.off("connect");
    socket.off("room_created");
    socket.off("joined_room");
    socket.off("disconnect");

    socket.on("connect", () => {
      console.log("✅ Connected:", socket.id);
    });

    socket.on("room_created", (roomId: string) => {
      router.push(`/room/host/${roomId}`);
    });

    socket.on("existing_name", (error) => {
      alert(error);
    });
    socket.on("error_message", (error) => {
      alert(error);
    });

    socket.on("joined_room", (roomId: string) => {
      router.push(`/room/${roomId}?name=${playerNameRef.current}`);
    });

    socket.on("disconnect", () => {
      console.log("❌ Disconnected");
    });

    return () => {
      socket.off("connect");
      socket.off("room_created");
      socket.off("joined_room");
      socket.off("disconnect");
    };
  }, [router]);

  const handleCreate = () => {
    const socket = getSocket();
    const link = createId();

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit("create_room", link);
  };

  const handleJoin = () => {
    if (!joinLink || !playerName) {
      alert("Please fill in all fields!");
      return;
    }

    const socket = getSocket();

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit("join_room", {
      roomId: joinLink,
      playerName,
    });
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-gradient-to-b from-gray-100 via-white to-gray-50 px-4 sm:px-6 md:px-8 relative">
      {/* Title */}
      <h1 className="text-3xl xs:text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 mb-4 tracking-tight text-center">
        Prompto
      </h1>

      {/* Subtitle */}
      <p className="text-sm xs:text-base sm:text-lg md:text-xl text-gray-600 text-center max-w-xs sm:max-w-md md:max-w-lg mb-10 sm:mb-12 leading-relaxed">
        A sleek, prompt-based challenge game. Create or join a room to test your
        creativity with friends!
      </p>

      {/* Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 w-full sm:w-auto max-w-sm sm:max-w-none">
        <button
          className="w-full sm:w-auto px-6 py-3 sm:px-10 sm:py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:scale-105 hover:from-blue-700 hover:to-indigo-700 transition-all duration-200"
          onClick={handleCreate}
        >
          Create a Room
        </button>

        <button
          className="w-full sm:w-auto px-6 py-3 sm:px-10 sm:py-4 bg-white border border-gray-300 text-gray-800 font-semibold rounded-xl shadow hover:scale-105 hover:bg-gray-50 transition-all duration-200"
          onClick={() => setJoinGame(true)}
        >
          Join a Room
        </button>
      </div>

      {/* Join Modal */}
      {joinGame && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-sm sm:max-w-md text-center animate-fadeIn">
            <h2 className="text-lg sm:text-xl font-bold mb-5 text-gray-900">
              Join Game
            </h2>

            <input
              type="text"
              placeholder="Your Name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full px-4 py-2 sm:py-3 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <input
              type="text"
              placeholder="Game Link"
              value={joinLink}
              onChange={(e) => setJoinLink(e.target.value)}
              className="w-full px-4 py-2 sm:py-3 border border-gray-300 rounded-lg mb-5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleJoin}
                className="w-full px-4 py-2 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Join
              </button>

              <button
                onClick={() => setJoinGame(false)}
                className="w-full px-4 py-2 sm:py-3 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
