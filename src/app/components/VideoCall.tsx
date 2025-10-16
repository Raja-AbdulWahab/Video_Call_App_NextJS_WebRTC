"use client";
import React, { useEffect, useRef, useState } from "react";

export default function VideoCall({ signaling }: any) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    // ✅ Make sure it only runs in browser
    if (typeof window === "undefined" || !navigator?.mediaDevices) {
      console.warn("getUserMedia not available (probably SSR).");
      return;
    }

    async function setupStream() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Error accessing media devices:", err);
      }
    }

    setupStream();
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-4">
        <div>
          <p>Local</p>
          <video ref={localVideoRef} autoPlay playsInline muted className="w-64 h-48 bg-black rounded-xl" />
        </div>
        <div>
          <p>Remote</p>
          <video ref={remoteVideoRef} autoPlay playsInline className="w-64 h-48 bg-black rounded-xl" />
        </div>
      </div>
      <button
        onClick={() => {
          localStream?.getTracks().forEach((track) => track.stop());
        }}
        className="px-4 py-2 bg-red-600 text-white rounded-md"
      >
        Hang up
      </button>
    </div>
  );
}
