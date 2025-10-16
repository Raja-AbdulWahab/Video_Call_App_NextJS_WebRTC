"use client";
import React, { useEffect, useState } from "react";
import useSignaling from "../hooks/useSignaling";

export default function ChatPanel({ roomId, username }: { roomId: string; username: string }) {
  const { chats, sendChat } = useSignaling(roomId, username); // multiple hook calls OK in this pattern
  const [text, setText] = useState("");

  // Note: using the hook in two components creates multiple WebSocket connections.
  // For production, share the hook instance via context. For simplicity in this demo,
  // we will keep it simple and call sendChat via the hook. If you already have a single
  // hook instance, prefer passing sendChat as prop.

  function handleSend() {
    if (!text.trim()) return;
    sendChat(text.trim());
    setText("");
  }

  return (
    <div className="p-3 bg-white rounded shadow h-80">
      <div className="mb-2 font-medium">Room chat</div>
      <div className="overflow-auto h-56 mb-2">
        {chats.map((c, i) => (
          <div key={i} className="text-sm"><strong>{c.from}:</strong> {c.text}</div>
        ))}
      </div>

      <div className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} className="flex-1 input" placeholder="Type a message" />
        <button onClick={handleSend} className="btn">Send</button>
      </div>
    </div>
  );
}
