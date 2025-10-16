// server/signalingServer.js
const { WebSocketServer } = require("ws");

const wss = new WebSocketServer({ port: 8080 });
const rooms = new Map(); // roomId -> Set<WebSocket>

wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data);
      const { type, roomId, username, to, payload, text } = msg;

      switch (type) {
        case "join": {
          if (!roomId || !username) return;
          if (!rooms.has(roomId)) rooms.set(roomId, new Set());
          const room = rooms.get(roomId);

          ws.username = username;
          ws.roomId = roomId;
          room.add(ws);

          // Notify everyone in the room of updated users
          broadcast(roomId, {
            type: "users",
            users: Array.from(room).map((u) => u.username),
          });
          break;
        }

        case "offer":
        case "answer":
        case "candidate": {
          const room = rooms.get(roomId);
          if (!room) return;
          for (const client of room) {
            if (client.username === to && client.readyState === 1) {
              client.send(JSON.stringify({ type, from: username, payload }));
            }
          }
          break;
        }

        case "chat": {
          const messageText = (payload && payload.text) || text || "";
          const room = rooms.get(ws.roomId);
          if (!room) return;

          const senderName = ws.username || msg.from || "unknown";

          broadcast(ws.roomId, {
            type: "chat",
            from: senderName,
            text: messageText,
          });
          break;
        }

        case "leave":
          cleanup(ws);
          break;
      }
    } catch (err) {
      console.error("❌ Error handling message:", err);
    }
  });

  ws.on("close", () => cleanup(ws));
});

/**
 * Broadcasts a message to everyone in a room, optionally excluding one client
 */
function broadcast(roomId, message, excludeWs) {
  const room = rooms.get(roomId);
  if (!room) return;
  const msg = JSON.stringify(message);
  for (const client of room) {
    if (client !== excludeWs && client.readyState === 1) {
      client.send(msg);
    }
  }
}

/**
 * Remove a disconnected WebSocket from its room
 */
function cleanup(ws) {
  const room = rooms.get(ws.roomId);
  if (!room) return;
  room.delete(ws);
  broadcast(ws.roomId, {
    type: "users",
    users: Array.from(room).map((u) => u.username),
  });
}

console.log("✅ Signaling server running on ws://localhost:8080");
