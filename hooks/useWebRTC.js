'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSocket } from './useSocket';

export function useWebRTC(gameId) {
  const { connected, emit, on, off } = useSocket();

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const [connectionState, setConnectionState] = useState('new');
  const [iceState, setIceState] = useState('new');

  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const opponentIdRef = useRef(null);

  const getLocalMedia = useCallback(async (video = true, audio = true) => {
    try {
      setError(null);
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('This browser does not support media devices');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
        audio: audio ? { echoCancellation: true, noiseSuppression: true } : false,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setMicOn(audio);
      setCameraOn(video);
      setIsReady(true);
      return stream;
    } catch (err) {
      console.error('[WebRTC] Media access error:', err);
      setError(err?.message || 'Failed to access camera/microphone');
      setIsReady(false);
      return null;
    }
  }, []);

  const toggleMicrophone = useCallback(() => {
    if (!localStreamRef.current) return;
    const tracks = localStreamRef.current.getAudioTracks();
    const current = tracks.length ? tracks[0].enabled : true;
    tracks.forEach((t) => (t.enabled = !current));
    setMicOn(!current);
  }, []);

  const toggleCamera = useCallback(async () => {
    const current = cameraOn;
    if (current) {
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = false));
        setCameraOn(false);
      }
    } else {
      if (!localStreamRef.current || localStreamRef.current.getVideoTracks().length === 0) {
        await getLocalMedia(true, micOn);
      } else {
        localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = true));
        setCameraOn(true);
      }
    }
  }, [cameraOn, micOn, getLocalMedia]);

  const toggleSpeaker = useCallback(() => {
    setSpeakerOn((prev) => !prev);
  }, []);

  const stopMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      setIsReady(false);
    }
    if (peerRef.current) {
      try { peerRef.current.close(); } catch {}
      peerRef.current = null;
    }
    setRemoteStream(null);
    setConnectionState('new');
    setIceState('new');
  }, []);

  const destroyPeer = useCallback(() => {
    if (peerRef.current) {
      try { peerRef.current.close(); } catch {}
      peerRef.current = null;
    }
    setConnectionState('new');
    setIceState('new');
  }, []);

  const createPeer = useCallback((localStream) => {
    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
      iceCandidatePoolSize: 10,
    };
    const peer = new RTCPeerConnection(config);
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        peer.addTrack(track, localStream);
      });
    }
    peer.ontrack = (e) => {
      if (e.streams?.[0]) {
        setRemoteStream(e.streams[0]);
      }
    };
    peer.onconnectionstatechange = () => {
      setConnectionState(peer.connectionState);
      if (peer.connectionState === 'failed' || peer.connectionState === 'closed') {
        setRemoteStream(null);
      }
    };
    peer.oniceconnectionstatechange = () => {
      setIceState(peer.iceConnectionState);
    };
    peer.onicegatheringstatechange = () => {};
    peerRef.current = peer;
    return peer;
  }, []);

  const offerCall = useCallback(
    async (toUserId) => {
      if (!gameId) return;
      if (!connected) { setError('You are not connected to the server'); return; }
      if (!localStreamRef.current) {
        await getLocalMedia(true, true);
        if (!localStreamRef.current) return;
      }
      try {
        opponentIdRef.current = toUserId;
        destroyPeer();
        const peer = createPeer(localStreamRef.current);
        peer.onicecandidate = (e) => {
          if (e.candidate) {
            emit('video:ice-candidate', { gameId, toUserId, candidate: e.candidate });
          }
        };
        const offer = await peer.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await peer.setLocalDescription(offer);
        emit('video:offer', { gameId, toUserId, offer });
        console.log('[WebRTC] Offer sent to:', toUserId);
      } catch (err) {
        console.error('[WebRTC] Offer error:', err);
        setError(err?.message || 'Could not send the offer');
      }
    },
    [gameId, connected, emit, getLocalMedia, destroyPeer, createPeer]
  );

  const answerCall = useCallback(
    async (fromUserId, offer) => {
      if (!gameId || !connected) return;
      if (!localStreamRef.current) {
        await getLocalMedia(true, true);
        if (!localStreamRef.current) return;
      }
      try {
        opponentIdRef.current = fromUserId;
        destroyPeer();
        const peer = createPeer(localStreamRef.current);
        peer.onicecandidate = (e) => {
          if (e.candidate) {
            emit('video:ice-candidate', { gameId, toUserId: fromUserId, candidate: e.candidate });
          }
        };
        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        emit('video:answer', { gameId, toUserId: fromUserId, answer });
        console.log('[WebRTC] Answer sent to:', fromUserId);
      } catch (err) {
        console.error('[WebRTC] Answer error:', err);
        setError(err?.message || 'Could not send the answer');
      }
    },
    [gameId, connected, emit, getLocalMedia, destroyPeer, createPeer]
  );

  const reconnect = useCallback(() => {
    setError(null);
    const opponent = opponentIdRef.current;
    if (opponent) offerCall(opponent);
  }, [offerCall]);

  useEffect(() => {
    if (!gameId || !on) return;
    const u1 = on('video:offer', (data) => {
      if (!data?.offer || !data?.fromUserId || data.gameId !== gameId) return;
      console.log('[WebRTC] Offer received from:', data.fromUserId);
      answerCall(data.fromUserId, data.offer);
    });
    const u2 = on('video:answer', async (data) => {
      if (!data?.answer || !peerRef.current || data.gameId !== gameId) return;
      try {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        console.log('[WebRTC] Answer applied');
      } catch (e) {
        console.error('[WebRTC] Answer apply error:', e);
        setError(e?.message);
      }
    });
    const u3 = on('video:ice-candidate', async (data) => {
      if (!data?.candidate || !peerRef.current || data.gameId !== gameId) return;
      try {
        await peerRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (e) {
        console.error('[WebRTC] ICE candidate error:', e);
      }
    });
    return () => {
      u1?.(); u2?.(); u3?.();
    };
  }, [gameId, on, answerCall]);

  useEffect(() => {
    return () => {
      stopMedia();
    };
  }, [stopMedia]);

  return {
    localStream,
    remoteStream,
    micOn,
    cameraOn,
    speakerOn,
    isReady,
    error,
    connectionState,
    iceState,
    getLocalMedia,
    toggleMicrophone,
    toggleCamera,
    toggleSpeaker,
    stopMedia,
    offerCall,
    answerCall,
    reconnect,
    destroyPeer,
  };
}

export default useWebRTC;
