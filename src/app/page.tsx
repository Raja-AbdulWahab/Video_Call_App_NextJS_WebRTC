"use client";

import React, { useState, useRef, useEffect } from "react";
import useSignaling from "./hooks/useSignaling";
import UserList from "./components/UserList";

export default function Home() {
  const [room, setRoom] = useState("");
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);

  return (
    <div className="p-6 min-h-screen bg-gray-100">
      {!joined ? (
        <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow space-y-4">
          <h1 className="text-2xl font-semibold text-center">
            Join or Create a Room
          </h1>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full p-2 border rounded"
          />
          <input
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="Room ID"
            className="w-full p-2 border rounded"
          />
          <button
            onClick={() => {
              if (!name.trim() || !room.trim())
                return alert("Please enter both name and room ID");
              setJoined(true);
            }}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            Join
          </button>
        </div>
      ) : (
        <Room roomId={room} username={name} />
      )}
    </div>
  );
}

function Room({
  roomId,
  username,
}: {
  roomId: string;
  username: string;
}) {
  const hook = useSignaling(roomId, username);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // ✅ FIX 1 — ensure local video stream displays even in Edge
  useEffect(() => {
    (async () => {
      try {
        const stream = await hook.ensureLocalStream();
        if (stream && localVideoRef.current) {
          // clone for compatibility (Edge sometimes blocks reused MediaStream)
          const clone = stream.clone();
          localVideoRef.current.srcObject = clone;
          localVideoRef.current.muted = true;
          localVideoRef.current.playsInline = true;

          const playPromise = localVideoRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch((err) => {
              console.warn("⚠️ Local video play() failed:", err);
            });
          }
        }
      } catch (err) {
        console.error("🎥 Failed to load local stream:", err);
      }
    })();
  }, [hook]);

  // ✅ FIX 2 — safely attach remote stream (handle autoplay blocking)
  useEffect(() => {
    if (!hook.remoteStream || !remoteVideoRef.current) return;
    const el = remoteVideoRef.current;
    el.srcObject = hook.remoteStream;
    el.playsInline = true;

    const tryPlay = async () => {
      try {
        await el.play();
      } catch (err) {
        console.warn("⚠️ Remote video play() blocked, retrying...");
        el.onloadedmetadata = () => el.play().catch(() => {});
      }
    };
    tryPlay();
  }, [hook.remoteStream]);

  return (
    <div className="grid grid-cols-3 gap-4 mt-6">
      <div className="col-span-2 bg-white p-4 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-2">Video Call</h2>
        <div className="flex flex-col gap-4">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full rounded bg-black"
          />
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full rounded bg-black"
          />
        </div>
      </div>

      <aside className="space-y-4">
        <UserList
          users={hook.users}
          username={username}
          onCall={(u) =>
            hook.callUser(u, (remoteStream: MediaStream) => {
              if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
                remoteVideoRef.current
                  .play()
                  .catch((err) => console.warn("⚠️ Remote video play() failed:", err));
              }
            })
          }
        />
        <ChatBox hook={hook} username={username} roomId={roomId} />
      </aside>
    </div>
  );
}

function ChatBox({
  hook,
  username,
  roomId,
}: {
  hook: ReturnType<typeof useSignaling>;
  username: string;
  roomId: string;
}) {
  const [text, setText] = useState("");

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h3 className="font-medium mb-2">Chat</h3>
      <div className="border rounded p-2 mb-3 h-48 overflow-auto bg-gray-50">
        {hook.chats.length === 0 ? (
          <p className="text-gray-500 text-sm text-center mt-10">
            No messages yet
          </p>
        ) : (
          hook.chats.map((c, i) => (
            <div key={i} className="mb-1">
              <strong>{c.from}:</strong> {c.text}
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 p-2 border rounded"
          placeholder="Type a message..."
        />
        <button
          className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700"
          onClick={() => {
            if (!text.trim()) return;
            hook.sendChat(text.trim());
            setText("");
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
