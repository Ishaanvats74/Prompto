import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io("https://prompto.onrender.com", {
      withCredentials: true,
      transports: ["websocket"],
    });
  }
  return socket;
};
