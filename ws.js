import { WebSocketServer } from "ws";

export const wss = new WebSocketServer({ port: 3002 });

export function broadcast(message) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(message));
      console.log("WebSocket message sent to clients");
    }
  });
}

console.log("WebSocket server running on ws://localhost:3002");
