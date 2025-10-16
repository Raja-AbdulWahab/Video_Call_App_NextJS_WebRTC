"use client";
import { useEffect, useRef, useState } from "react";

type ChatItem = { from: string; text: string };

export default function useSignaling(roomId: string, username: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [users, setUsers] = useState<string[]>([]);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [connected, setConnected] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const SIGNALING =
    process.env.NEXT_PUBLIC_SIGNALING_URL || "ws://localhost:8080";

  function safeSend(data: any) {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    } else {
      console.warn("⚠️ Tried to send before WebSocket open", data);
    }
  }

  useEffect(() => {
    if (!roomId || !username) return;

    const ws = new WebSocket(SIGNALING);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("✅ Connected to signaling server");
      safeSend({ type: "join", roomId, username });
      setConnected(true);
    };

    ws.onmessage = async (ev) => {
      const msg = JSON.parse(ev.data);
      switch (msg.type) {
        case "users":
          setUsers(msg.users || []);
          break;

        case "offer":
          await handleOffer(msg.from, msg.payload);
          break;

        case "answer":
          await handleAnswer(msg.from, msg.payload);
          break;

        case "candidate":
          if (pcRef.current && msg.payload?.candidate) {
            try {
              await pcRef.current.addIceCandidate(msg.payload.candidate);
            } catch (err) {
              console.warn("❌ addIceCandidate failed", err);
            }
          }
          break;

        case "chat":
          setChats((c) => {
            // Avoid showing the same message twice
            const isDuplicate = c.some(
              (item) => item.text === msg.text && item.from === msg.from
            );
            if (isDuplicate) return c;
            return [...c, { from: msg.from || "unknown", text: msg.text || "" }];
          });
          break;
      }
    };

    ws.onerror = (e) => {
      if (e instanceof ErrorEvent) {
        console.warn("⚠️ WebSocket connection issue:", e.message);
      } else {
        console.warn("⚠️ WebSocket connection issue:", e.type || e);
      }
    };

    ws.onclose = () => {
      console.log("🔌 Disconnected from signaling");
      setConnected(false);
    };

    return () => {
      safeSend({ type: "leave", roomId });
      try {
        ws.close();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, username]);

  async function ensureLocalStream() {
    if (typeof window === "undefined") {
      console.warn("🧠 ensureLocalStream called on server — skipping");
      return null;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      console.warn("🚫 navigator.mediaDevices not supported");
      return null;
    }

    if (localStreamRef.current) return localStreamRef.current;

    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = s;
      return s;
    } catch (err) {
      console.error("🎥 Error accessing camera/mic:", err);
      return null;
    }
  }

 function createPeer(targetUser?: string) {
  const iceServers = JSON.parse(process.env.NEXT_PUBLIC_ICE_SERVERS || "[]");
  const pc = new RTCPeerConnection({
    iceServers: iceServers.length > 0 ? iceServers : [{ urls: "stun:stun.l.google.com:19302" }],
  });

  pcRef.current = pc;

  if (localStreamRef.current) {
    localStreamRef.current.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!);
    });
  }

  pc.ontrack = (event) => {
  const [stream] = event.streams;
  if (stream) {
    console.log("📡 Remote stream received!");
    // debug: list receivers and tracks
    try {
      const receivers = pc.getReceivers();
      console.log("pc.getReceivers():", receivers.map(r => ({ id: r.track?.id, kind: r.track?.kind })));
    } catch (e) { console.warn("getReceivers error", e); }

    console.log("remote stream tracks:", stream.getTracks().map(t => ({ id: t.id, kind: t.kind, enabled: t.enabled })));

    setRemoteStream(stream);
  }
};


  pc.onicecandidate = (event) => {
    if (event.candidate && targetUser) {
      safeSend({
        type: "candidate",
        roomId,
        to: targetUser,
        payload: { candidate: event.candidate },
      });
    }
  };

  pc.oniceconnectionstatechange = () => {
    console.log("ICE state:", pc.iceConnectionState);
  };

  return pc;
}

async function callUser(target: string, p0?: (remoteStream: MediaStream) => void) {
  const local = await ensureLocalStream();
  if (!local) {
    console.warn("⚠️ No local stream available for call");
    return;
  }

  const pc = createPeer(target);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  safeSend({
    type: "offer",
    roomId,
    to: target,
    payload: { offer },
  });
}

async function handleOffer(from: string, payload: any) {
  const local = await ensureLocalStream();
  if (!local) {
    console.warn("⚠️ No local stream — cannot handle offer");
    return;
  }

  const pc = createPeer(from);
  await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  safeSend({
    type: "answer",
    roomId,
    to: from,
    payload: { answer },
  });
}



async function handleAnswer(from: string, payload: any) {
    if (pcRef.current) {
      await pcRef.current.setRemoteDescription(
        new RTCSessionDescription(payload.answer)
      );
    }
  }

  function sendChat(text: string) {
    if (!wsRef.current || !text.trim()) return;
    safeSend({ type: "chat", roomId, from: username, payload: { text: text.trim() } });
  }

  function getLocalStream() {
    return localStreamRef.current;
  }

  function closePeer() {
    if (pcRef.current) {
      try {
        pcRef.current.getSenders().forEach((s) => {
          try { s.replaceTrack?.(null); } catch {}
        });
        pcRef.current.close();
      } catch {}
      pcRef.current = null;
    }
    setRemoteStream(null);
  }

  return {
    users,
    chats,
    connected,
    callUser,
    sendChat,
    ensureLocalStream,
    getLocalStream,
    closePeer,
    remoteStream,
  };
}
