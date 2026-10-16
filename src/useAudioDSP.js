import { useEffect, useRef, useState } from 'react';

export function useAudioDSP(isPlaying) {
  const [is8DEnabled, setIs8DEnabled] = useState(false);
  const [eightDSpeed, setEightDSpeed] = useState(0.25);
  const [bassGain, setBassGain] = useState(0);
  const [vocalGain, setVocalGain] = useState(0);
  const [stereoPan, setStereoPan] = useState(0);
  const [is3DSpacial, setIs3DSpacial] = useState(false);
  const [spatialReverb, setSpatialReverb] = useState(30);
  const [currentPanPos, setCurrentPanPos] = useState(0);

  const audioCtxRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const bassFilterRef = useRef(null);
  const vocalFilterRef = useRef(null);
  const pannerNodeRef = useRef(null);
  const animFrameRef = useRef(null);
  const angleRef = useRef(0);

  const initAudioContext = (mediaElement) => {
    if (!mediaElement) return;

    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        audioCtxRef.current = new AudioContextClass();
      }

      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      if (!sourceNodeRef.current) {
        try {
          sourceNodeRef.current = ctx.createMediaElementSource(mediaElement);
        } catch (e) {
          return;
        }

        bassFilterRef.current = ctx.createBiquadFilter();
        bassFilterRef.current.type = 'lowshelf';
        bassFilterRef.current.frequency.value = 110;
        bassFilterRef.current.gain.value = bassGain;

        vocalFilterRef.current = ctx.createBiquadFilter();
        vocalFilterRef.current.type = 'peaking';
        vocalFilterRef.current.frequency.value = 2400;
        vocalFilterRef.current.Q.value = 1.2;
        vocalFilterRef.current.gain.value = vocalGain;

        if (ctx.createStereoPanner) {
          pannerNodeRef.current = ctx.createStereoPanner();
          pannerNodeRef.current.pan.value = stereoPan;
        }

        let currentNode = sourceNodeRef.current;
        currentNode.connect(bassFilterRef.current);
        currentNode = bassFilterRef.current;

        currentNode.connect(vocalFilterRef.current);
        currentNode = vocalFilterRef.current;

        if (pannerNodeRef.current) {
          currentNode.connect(pannerNodeRef.current);
          currentNode = pannerNodeRef.current;
        }

        currentNode.connect(ctx.destination);
      }
    } catch (err) {
      console.warn("DSP Init warning:", err);
    }
  };

  const resumeAudioContext = () => {
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
  };

  useEffect(() => {
    if (bassFilterRef.current && audioCtxRef.current) {
      try {
        bassFilterRef.current.gain.setTargetAtTime(bassGain, audioCtxRef.current.currentTime, 0.02);
      } catch (e) {}
    }
  }, [bassGain]);

  useEffect(() => {
    if (vocalFilterRef.current && audioCtxRef.current) {
      try {
        vocalFilterRef.current.gain.setTargetAtTime(vocalGain, audioCtxRef.current.currentTime, 0.02);
      } catch (e) {}
    }
  }, [vocalGain]);

  useEffect(() => {
    if (!is8DEnabled && pannerNodeRef.current && audioCtxRef.current) {
      try {
        pannerNodeRef.current.pan.setTargetAtTime(stereoPan, audioCtxRef.current.currentTime, 0.02);
        setCurrentPanPos(stereoPan);
      } catch (e) {}
    }
  }, [stereoPan, is8DEnabled]);

  useEffect(() => {
    if (is8DEnabled && isPlaying) {
      resumeAudioContext();
      let lastTime = performance.now();

      const animate8D = (now) => {
        const delta = (now - lastTime) / 1000;
        lastTime = now;
        angleRef.current += delta * eightDSpeed * Math.PI * 2;
        const panVal = Math.sin(angleRef.current);

        if (pannerNodeRef.current && audioCtxRef.current) {
          try {
            pannerNodeRef.current.pan.setValueAtTime(panVal, audioCtxRef.current.currentTime);
          } catch (e) {}
        }
        setCurrentPanPos(panVal);
        animFrameRef.current = requestAnimationFrame(animate8D);
      };

      animFrameRef.current = requestAnimationFrame(animate8D);
    } else {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (!is8DEnabled) {
        setCurrentPanPos(stereoPan);
        if (pannerNodeRef.current && audioCtxRef.current) {
          try {
            pannerNodeRef.current.pan.setValueAtTime(stereoPan, audioCtxRef.current.currentTime);
          } catch (e) {}
        }
      }
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [is8DEnabled, isPlaying, eightDSpeed, stereoPan]);

  return {
    initAudioContext,
    resumeAudioContext,
    is8DEnabled,
    setIs8DEnabled,
    eightDSpeed,
    setEightDSpeed,
    bassGain,
    setBassGain,
    vocalGain,
    setVocalGain,
    stereoPan,
    setStereoPan,
    is3DSpacial,
    setIs3DSpacial,
    spatialReverb,
    setSpatialReverb,
    currentPanPos
  };
}
