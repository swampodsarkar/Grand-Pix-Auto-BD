import React, { useEffect, useState, useRef } from 'react';
import AgoraRTC, { IAgoraRTCClient, IMicrophoneAudioTrack, IRemoteAudioTrack, IRemoteUser } from 'agora-rtc-sdk-ng';
import { useGameStore } from '../store/useGameStore';
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';

const APP_ID = '78e0fd577ac24263a2dcb2d9397c8bba';

// Max distance for audio to be heard completely
const MAX_DISTANCE = 1500;

export function VoiceChat() {
  const [inChannel, setInChannel] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const remoteUsersRef = useRef<{ [uid: string]: IRemoteUser }>({});
  
  const myId = useGameStore(s => s.myId);
  const roomId = useGameStore(s => s.roomId);

  useEffect(() => {
    return () => {
      leaveChannel();
    };
  }, []);

  // Update volume based on distance in the game frame by frame or periodically
  useEffect(() => {
    if (!inChannel) return;
    
    const interval = setInterval(() => {
      const state = useGameStore.getState();
      const me = state.myId ? state.gameState?.players?.[state.myId] : null;
      if (!me) return;

      Object.values(remoteUsersRef.current).forEach(user => {
        if (!user.uid) return;
        const remotePlayerId = String(user.uid);
        const remotePlayer = state.gameState?.players?.[remotePlayerId];
        
        if (remotePlayer && user.audioTrack) {
          const dist = Math.hypot(me.x - remotePlayer.x, me.y - remotePlayer.y);
          
          let volume = 0;
          if (dist < MAX_DISTANCE) {
            // Linear falloff, then drop to 0 if out of range
            const linearVolume = 1 - (dist / MAX_DISTANCE);
            // Cap to typical Agora volume range [0, 100]
            volume = Math.max(0, Math.min(100, Math.round(linearVolume * 100)));
          }
          
          user.audioTrack.setVolume(volume);
        }
      });
    }, 200);

    return () => clearInterval(interval);
  }, [inChannel]);

  const joinChannel = async () => {
    if (!myId || !roomId) return;
    setConnecting(true);
    setError(null);
    try {
      if (!clientRef.current) {
        clientRef.current = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      }

      const client = clientRef.current;

      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        if (mediaType === "audio") {
          remoteUsersRef.current[user.uid] = user;
          user.audioTrack?.play();
        }
      });

      client.on("user-unpublished", (user, mediaType) => {
        if (mediaType === "audio") {
          delete remoteUsersRef.current[user.uid];
        }
      });
      
      client.on("user-left", (user) => {
        delete remoteUsersRef.current[user.uid];
      });

      // We use null as token for development if token is disabled on Agora Dashboard
      await client.join(APP_ID, roomId, null, myId);

      const localTrack = await AgoraRTC.createMicrophoneAudioTrack();
      localAudioTrackRef.current = localTrack;
      await client.publish([localTrack]);

      setInChannel(true);
      setIsMuted(false);
    } catch (err: any) {
      console.error("Agora join failed:", err);
      setError(err?.message || "Failed to join voice chat. Token might be required.");
      if (clientRef.current) {
         await clientRef.current.leave();
      }
    } finally {
      setConnecting(false);
    }
  };

  const leaveChannel = async () => {
    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.stop();
      localAudioTrackRef.current.close();
      localAudioTrackRef.current = null;
    }
    
    if (clientRef.current) {
      await clientRef.current.leave();
      clientRef.current = null;
    }
    
    remoteUsersRef.current = {};
    setInChannel(false);
  };

  const toggleMute = () => {
    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.setMuted(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  if (!myId || !roomId) return null;

  const handleVoiceClick = async () => {
    // Request microphone permission (important for Android APK)
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      alert("Microphone permission denied. Voice chat won't work.");
      return;
    }

    if (inChannel) {
      leaveChannel();
    } else {
      joinChannel();
    }
  };

  return (
    <button
      onClick={handleVoiceClick}
      disabled={connecting}
      className="w-9 h-9 flex items-center justify-center bg-slate-900/90 backdrop-blur border border-slate-700 rounded-full shadow pointer-events-auto active:scale-95 transition-all"
      title={inChannel ? "Leave voice" : "Join proximity voice"}
    >
      {inChannel ? (
        isMuted ? <MicOff className="w-4 h-4 text-red-400" /> : <Mic className="w-4 h-4 text-lime-400" />
      ) : (
        <Mic className="w-4 h-4 text-slate-400" />
      )}
    </button>
  );
}
