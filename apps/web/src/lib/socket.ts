"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket() {
  if (typeof window === "undefined") return null;
  if (!socket) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    socket = io(apiUrl, { transports: ["websocket", "polling"] });
  }
  return socket;
}

export function joinKitchen(branchId: string) {
  const s = getSocket();
  s?.emit("join", `kitchen:${branchId}`);
}
