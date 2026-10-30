import { useCallback, useEffect, useRef, useState } from "react";
import { portalApi } from "../api/portal.api.js";

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

function makeKey() {
  return `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function mediaErrorMessage(error) {
  if (error?.name === "NotAllowedError") {
    return "Microphone or camera permission was denied. Allow access in the browser and try again.";
  }
  if (error?.name === "NotFoundError") {
    return "No microphone or camera was found on this device.";
  }
  return error?.message || "Could not access the microphone or camera.";
}

export function useCall(socket) {
  const [call, setCall] = useState(null);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [remoteReady, setRemoteReady] = useState(false);
  const [remoteAudioReady, setRemoteAudioReady] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [recording, setRecording] = useState(false);
  const [remoteRecording, setRemoteRecording] = useState(false);

  const socketRef = useRef(socket);
  const callRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const iceQueueRef = useRef([]);
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);
  const ringRef = useRef({ ctx: null, timer: null });
  const timerRef = useRef(null);
  const mixRecorderRef = useRef(null);
  const mixChunksRef = useRef([]);
  const mixCtxRef = useRef(null);
  const mixSourcesRef = useRef([]);
  const recordingMetaRef = useRef(null);

  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  const setCallState = useCallback((next) => {
    setCall((current) => {
      const value = typeof next === "function" ? next(current) : next;
      callRef.current = value;
      return value;
    });
  }, []);

  const stopRing = useCallback(() => {
    const ring = ringRef.current;
    if (ring.timer) {
      window.clearInterval(ring.timer);
      ring.timer = null;
    }
    if (ring.ctx) {
      try {
        ring.ctx.close();
      } catch {
        /* already closed */
      }
      ring.ctx = null;
    }
  }, []);

  const startRing = useCallback(() => {
    stopRing();
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      ringRef.current.ctx = ctx;
      const beep = (frequency, offset, duration) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const at = ctx.currentTime + offset;
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.linearRampToValueAtTime(0.14, at + 0.03);
        gain.gain.setValueAtTime(0.14, at + Math.max(0.05, duration - 0.05));
        gain.gain.linearRampToValueAtTime(0.0001, at + duration);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(at);
        oscillator.stop(at + duration + 0.03);
      };
      const pattern = () => {
        beep(480, 0, 0.35);
        beep(620, 0.42, 0.35);
        beep(480, 0.84, 0.35);
      };
      pattern();
      ringRef.current.timer = window.setInterval(pattern, 3000);
      if (navigator.vibrate) navigator.vibrate([400, 250, 400]);
    } catch {
      /* audio is optional */
    }
  }, [stopRing]);

  const stopMixRecording = useCallback(() => {
    const recorder = mixRecorderRef.current;
    mixRecorderRef.current = null;
    setRecording(false);

    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* already stopped */
      }
      return;
    }

    if (mixCtxRef.current) {
      try {
        mixCtxRef.current.close();
      } catch {
        /* already closed */
      }
      mixCtxRef.current = null;
    }
    mixSourcesRef.current = [];
  }, []);

  const cleanup = useCallback(() => {
    stopRing();
    stopMixRecording();
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (pcRef.current) {
      try {
        pcRef.current.ontrack = null;
        pcRef.current.onicecandidate = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.close();
      } catch {
        /* already closed */
      }
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          /* already stopped */
        }
      });
      localStreamRef.current = null;
    }
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    remoteStreamRef.current = null;
    pendingOfferRef.current = null;
    iceQueueRef.current = [];
    setRemoteReady(false);
    setRemoteAudioReady(false);
    setMuted(false);
    setCameraOn(true);
    setElapsed(0);
    setRemoteRecording(false);
    setCallState(null);
  }, [setCallState, stopMixRecording, stopRing]);

  const emit = useCallback((event, payload) => {
    if (socketRef.current) socketRef.current.emit(event, payload);
  }, []);

  const startMixRecording = useCallback(() => {
    const current = callRef.current;
    if (!current || current.direction !== "outgoing" || mixRecorderRef.current) return;
    if (!window.MediaRecorder || !window.AudioContext) return;

    const localStream = localStreamRef.current;
    const remoteStream = remoteStreamRef.current;
    if (!localStream?.getAudioTracks().length || !remoteStream?.getAudioTracks().length) return;

    let ctx = null;
    try {
      ctx = new window.AudioContext();
      const destination = ctx.createMediaStreamDestination();
      const localSource = ctx.createMediaStreamSource(localStream);
      const remoteSource = ctx.createMediaStreamSource(remoteStream);
      localSource.connect(destination);
      remoteSource.connect(destination);

      const preferred = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4"
      ];
      const mime = preferred.find((type) => MediaRecorder.isTypeSupported?.(type)) || "";
      const recorder = mime
        ? new MediaRecorder(destination.stream, { mimeType: mime })
        : new MediaRecorder(destination.stream);

      mixChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data?.size) mixChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const meta = recordingMetaRef.current;
        recordingMetaRef.current = null;
        const chunks = mixChunksRef.current;
        mixChunksRef.current = [];
        const type = recorder.mimeType || "audio/webm";

        mixSourcesRef.current.forEach((source) => {
          try {
            source.disconnect();
          } catch {
            /* already disconnected */
          }
        });
        mixSourcesRef.current = [];
        if (mixCtxRef.current) {
          try {
            await mixCtxRef.current.close();
          } catch {
            /* already closed */
          }
          mixCtxRef.current = null;
        }

        if (!meta?.callKey || !chunks.length) return;
        const blob = new Blob(chunks, { type });
        if (blob.size < 1200) return;
        const extension = type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : "webm";
        const form = new FormData();
        form.append("recording", blob, `call-${meta.callKey}.${extension}`);
        form.append("duration", String(Math.max(1, Math.round((Date.now() - meta.startedAt) / 1000))));

        try {
          await portalApi.uploadCallRecording(meta.callKey, form);
        } catch {
          setNotice("Call ended, but the recording could not be saved.");
        }
      };

      recorder.start(1000);
      mixRecorderRef.current = recorder;
      mixCtxRef.current = ctx;
      mixSourcesRef.current = [localSource, remoteSource];
      recordingMetaRef.current = { callKey: current.key, startedAt: Date.now() };
      setRecording(true);
      emit("call:recording", { peer_id: current.peer.id, call_key: current.key });
    } catch {
      if (ctx) {
        try {
          ctx.close();
        } catch {
          /* already closed */
        }
      }
      setRecording(false);
    }
  }, [emit]);

  const flushIce = useCallback(() => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) return;
    iceQueueRef.current.forEach((candidate) => {
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    });
    iceQueueRef.current = [];
  }, []);

  const setupPeer = useCallback(
    (callKey, peer) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;
      const remoteStream = new MediaStream();
      remoteStreamRef.current = remoteStream;

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          emit("call:signal", {
            peer_id: peer.id,
            call_key: callKey,
            signal: { type: "candidate", candidate: event.candidate }
          });
        }
      };

      pc.ontrack = (event) => {
        if (event.track) {
          const exists = remoteStream.getTracks().some((track) => track.id === event.track.id);
          if (!exists) remoteStream.addTrack(event.track);
          if (event.track.kind === "audio") setRemoteAudioReady(true);
        }
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.play().catch(() => {});
        }
        setRemoteReady(true);
      };

      pc.onconnectionstatechange = () => {
        if (pc !== pcRef.current) return;
        if (pc.connectionState === "connected") {
          setCallState((current) => (current ? { ...current, status: "connected" } : current));
        } else if (pc.connectionState === "failed") {
          setCallState((current) => (current ? { ...current, status: "failed" } : current));
        }
      };

      return pc;
    },
    [emit, setCallState]
  );

  const getMedia = useCallback(async (kind) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Calls need a secure HTTPS connection.");
    }
    const constraints =
      kind === "video"
        ? { audio: true, video: { width: { ideal: 1280 }, height: { ideal: 720 } } }
        : { audio: true };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play().catch(() => {});
    }
    return stream;
  }, []);

  const startCall = useCallback(
    async (peer, kind = "audio") => {
      if (!peer?.id || callRef.current) return;
      if (!socketRef.current) {
        setError("Connecting to the chat server. Please try again.");
        return;
      }
      setError("");
      setNotice("");
      const callKey = makeKey();
      setCallState({
        key: callKey,
        peer,
        kind: kind === "video" ? "video" : "audio",
        direction: "outgoing",
        status: "calling"
      });

      try {
        const stream = await getMedia(kind);
        if (callRef.current?.key !== callKey) {
          stream.getTracks().forEach((track) => track.stop());
          localStreamRef.current = null;
          return;
        }
        const pc = setupPeer(callKey, peer);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        emit("call:invite", {
          callee_id: peer.id,
          call_key: callKey,
          kind: kind === "video" ? "video" : "audio"
        });
        emit("call:signal", {
          peer_id: peer.id,
          call_key: callKey,
          signal: pc.localDescription
        });
      } catch (err) {
        cleanup();
        setError(mediaErrorMessage(err));
      }
    },
    [cleanup, emit, getMedia, setCallState, setupPeer]
  );

  const acceptCall = useCallback(async () => {
    const current = callRef.current;
    if (!current || current.direction !== "incoming") return;
    if (!pendingOfferRef.current) {
      setError("The call offer is still arriving. Please try again.");
      return;
    }
    setError("");
    setCallState({ ...current, status: "connecting" });
    try {
      const stream = await getMedia(current.kind);
      if (callRef.current?.key !== current.key) {
        stream.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
        return;
      }
      const pc = setupPeer(current.key, current.peer);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
      pendingOfferRef.current = null;
      flushIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      emit("call:accept", { caller_id: current.peer.id, call_key: current.key });
      emit("call:signal", {
        peer_id: current.peer.id,
        call_key: current.key,
        signal: pc.localDescription
      });
    } catch (err) {
      emit("call:reject", { caller_id: current.peer.id, call_key: current.key });
      cleanup();
      setError(mediaErrorMessage(err));
    }
  }, [cleanup, emit, flushIce, getMedia, setCallState, setupPeer]);

  const endCall = useCallback(
    (notify = true) => {
      const current = callRef.current;
      if (notify && current) {
        emit("call:end", { peer_id: current.peer.id, call_key: current.key });
      }
      cleanup();
      setNotice("Call ended.");
    },
    [cleanup, emit]
  );

  const rejectCall = useCallback(() => {
    const current = callRef.current;
    if (current) {
      emit("call:reject", { caller_id: current.peer.id, call_key: current.key });
    }
    cleanup();
    setNotice("Call declined.");
  }, [cleanup, emit]);

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }, []);

  const toggleCamera = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCameraOn(track.enabled);
  }, []);

  useEffect(() => {
    if (!socket) return undefined;

    const onInvite = ({ caller_id, caller_name, call_key, kind }) => {
      if (callRef.current) {
        socket.emit("call:reject", { caller_id, call_key });
        return;
      }
      setError("");
      setNotice("");
      setRemoteRecording(false);
      pendingOfferRef.current = null;
      iceQueueRef.current = [];
      setCallState({
        key: call_key,
        peer: { id: caller_id, full_name: caller_name || "TechNexa user" },
        kind: kind === "video" ? "video" : "audio",
        direction: "incoming",
        status: "ringing"
      });
      startRing();
    };

    const onAccept = ({ call_key }) => {
      const current = callRef.current;
      if (!current || current.key !== call_key) return;
      stopRing();
      setCallState({ ...current, status: "connecting" });
    };

    const onReject = ({ call_key }) => {
      const current = callRef.current;
      if (!current || current.key !== call_key) return;
      cleanup();
      setNotice("Call declined.");
    };

    const onEnd = ({ call_key }) => {
      const current = callRef.current;
      if (!current || current.key !== call_key) return;
      cleanup();
      setNotice("Call ended.");
    };

    const onOffline = ({ call_key }) => {
      const current = callRef.current;
      if (!current || current.key !== call_key) return;
      cleanup();
      setError("That person is offline right now. Try again later.");
    };

    const onSignal = async ({ signal, call_key }) => {
      const current = callRef.current;
      if (!current || current.key !== call_key || !signal) return;

      if (signal.type === "offer") {
        if (current.direction === "incoming" && !pcRef.current) {
          pendingOfferRef.current = signal;
        }
        return;
      }

      if (signal.type === "answer") {
        const pc = pcRef.current;
        if (!pc || pc.signalingState === "stable") return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          flushIce();
        } catch {
          setError("Could not connect the call.");
        }
        return;
      }

      if (signal.type === "candidate" && signal.candidate) {
        const pc = pcRef.current;
        if (pc && pc.remoteDescription) {
          pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
        } else {
          iceQueueRef.current.push(signal.candidate);
        }
      }
    };

    const onRecording = ({ call_key }) => {
      const current = callRef.current;
      if (!current || current.key !== call_key) return;
      setRemoteRecording(true);
    };

    const onError = ({ message }) => setError(message || "Call failed.");

    socket.on("call:invite", onInvite);
    socket.on("call:accept", onAccept);
    socket.on("call:reject", onReject);
    socket.on("call:end", onEnd);
    socket.on("call:offline", onOffline);
    socket.on("call:signal", onSignal);
    socket.on("call:recording", onRecording);
    socket.on("call:error", onError);

    return () => {
      socket.off("call:invite", onInvite);
      socket.off("call:accept", onAccept);
      socket.off("call:reject", onReject);
      socket.off("call:end", onEnd);
      socket.off("call:offline", onOffline);
      socket.off("call:signal", onSignal);
      socket.off("call:recording", onRecording);
      socket.off("call:error", onError);
    };
  }, [cleanup, flushIce, setCallState, socket, startRing, stopRing]);

  useEffect(() => {
    if (call?.status !== "connected") {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setElapsed(0);
      return undefined;
    }
    setElapsed(0);
    timerRef.current = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [call?.key, call?.status]);

  useEffect(() => {
    if (call?.status === "connected" && remoteAudioReady) startMixRecording();
  }, [call?.key, call?.status, remoteAudioReady, startMixRecording]);

  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      localVideoRef.current.play().catch(() => {});
    }
  }, [call?.key]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [call?.key, remoteReady]);

  useEffect(
    () => () => {
      cleanup();
    },
    [cleanup]
  );

  return {
    call,
    muted,
    cameraOn,
    remoteReady,
    recording: recording || remoteRecording,
    elapsed: formatDuration(elapsed),
    error,
    notice,
    remoteVideoRef,
    localVideoRef,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera
  };
}
