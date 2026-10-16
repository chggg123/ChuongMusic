import { useEffect, useRef, useState } from 'react';

export function useAudioDSP(isPlaying) {
  const [is8DEnabled, setIs8DEnabled] = useState(false);
  const [eightDSpeed, setEightDSpeed] = useState(0.25); // Tốc độ xoay vòm 8D
  const [bassGain, setBassGain] = useState(0); // Tăng Bass 0 -> 20 dB
  const [vocalGain, setVocalGain] = useState(0); // Lọc giọng -12 -> +12 dB
  const [stereoPan, setStereoPan] = useState(0); // -1 (Trái) -> +1 (Phải)
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

  // KÍCH HOẠT VÀ NỐI LUỒNG BỘ LỌC WEB AUDIO API
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
        ctx.resume();
      }

      if (!sourceNodeRef.current) {
        // Gắn trực tiếp thẻ HTML5 Audio vào Web Audio API
        sourceNodeRef.current = ctx.createMediaElementSource(mediaElement);

        // 1. Lọc Bass Boost (Low-shelf Filter)
        bassFilterRef.current = ctx.createBiquadFilter();
        bassFilterRef.current.type = 'lowshelf';
        bassFilterRef.current.frequency.value = 110;
        bassFilterRef.current.gain.value = bassGain;

        // 2. Lọc Giọng Ca Sĩ (Peaking Filter)
        vocalFilterRef.current = ctx.createBiquadFilter();
        vocalFilterRef.current.type = 'peaking';
        vocalFilterRef.current.frequency.value = 2400;
        vocalFilterRef.current.Q.value = 1.2;
        vocalFilterRef.current.gain.value = vocalGain;

        // 3. Stereo Panner (Âm thanh vòm Trái / Phải 8D)
        if (ctx.createStereoPanner) {
          pannerNodeRef.current = ctx.createStereoPanner();
          pannerNodeRef.current.pan.value = stereoPan;
        }

        // Nối chuỗi: Source ➔ BassFilter ➔ VocalFilter ➔ StereoPanner ➔ Loa/Tai nghe
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
      console.log('DSP AudioContext initialized:', err);
    }
  };

  // Mở khóa AudioContext bị Chrome / Edge khóa Autoplay
  const resumeAudioContext = () => {
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  // Cập nhật cường độ Bass
  useEffect(() => {
    if (bassFilterRef.current && audioCtxRef.current) {
      bassFilterRef.current.gain.setTargetAtTime(bassGain, audioCtxRef.current.currentTime, 0.02);
    }
  }, [bassGain]);

  // Cập nhật cường độ Vocal
  useEffect(() => {
    if (vocalFilterRef.current && audioCtxRef.current) {
      vocalFilterRef.current.gain.setTargetAtTime(vocalGain, audioCtxRef.current.currentTime, 0.02);
    }
  }, [vocalGain]);

  // Cập nhật Stereo Pan
  useEffect(() => {
    if (!is8DEnabled && pannerNodeRef.current && audioCtxRef.current) {
      pannerNodeRef.current.pan.setTargetAtTime(stereoPan, audioCtxRef.current.currentTime, 0.02);
      setCurrentPanPos(stereoPan);
    }
  }, [stereoPan, is8DEnabled]);

  // Vòng lặp xoay luồng âm thanh 8D 360° theo thời gian thực
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
          pannerNodeRef.current.pan.setValueAtTime(panVal, audioCtxRef.current.currentTime);
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
          pannerNodeRef.current.pan.setValueAtTime(stereoPan, audioCtxRef.current.currentTime);
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
