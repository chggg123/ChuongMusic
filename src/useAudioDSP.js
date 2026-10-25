import { useEffect, useRef, useState } from 'react';

const createRoomImpulse = (audioContext, roomSize, damp) => {
  const duration = 0.5 + roomSize * 4;
  const length = Math.floor(audioContext.sampleRate * duration);
  const impulse = audioContext.createBuffer(2, length, audioContext.sampleRate);
  const decayRate = 6 / duration;

  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const samples = impulse.getChannelData(channel);
    for (let i = 0; i < samples.length; i += 1) {
      const progress = i / samples.length;
      const envelope = Math.exp(-decayRate * progress * duration);
      const highFrequencyDamping = 1 - damp * progress;
      samples[i] = (Math.random() * 2 - 1) * envelope * highFrequencyDamping / Math.sqrt(length);
    }
  }

  return impulse;
};

const setPannerPosition = (panner, x, z, currentTime) => {
  if (panner.positionX && panner.positionZ) {
    panner.positionX.setValueAtTime(x, currentTime);
    panner.positionZ.setValueAtTime(z, currentTime);
  } else {
    panner.setPosition(x, 0, z);
  }
};

export function useAudioDSP(isPlaying) {
  const [savedSettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('liquid_audio_settings') || '{}');
    } catch (error) {
      console.warn('Không thể khôi phục tùy chỉnh âm thanh:', error);
      return {};
    }
  });
  const savedNumber = (key, min, max, fallback) => {
    const value = savedSettings[key];
    return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
  };
  const [is8DEnabled, setIs8DEnabled] = useState(() => savedSettings.is8DEnabled === true);
  const [eightDSpeed, setEightDSpeed] = useState(() => savedNumber('eightDSpeed', 0.05, 0.8, 0.25));
  const [bassGain, setBassGain] = useState(() => savedNumber('bassGain', 0, 20, 0));
  const [vocalGain, setVocalGain] = useState(() => savedNumber('vocalGain', -12, 12, 0));
  const [stereoPan, setStereoPan] = useState(() => savedNumber('stereoPan', -1, 1, 0));
  const [isWideEnabled, setIsWideEnabled] = useState(() => savedSettings.isWideEnabled === true);
  const [wideMix, setWideMix] = useState(() => savedNumber('wideMix', 0, 1, 0.4));
  const [wideDamp, setWideDamp] = useState(() => savedNumber('wideDamp', 0, 1, 0.3));
  const [wideRoomSize, setWideRoomSize] = useState(() => savedNumber('wideRoomSize', 0, 1, 0.9));
  const [wideGain, setWideGain] = useState(() => savedNumber('wideGain', -12, 12, 0));
  const [current8DAngle, setCurrent8DAngle] = useState(0);

  useEffect(() => {
    localStorage.setItem('liquid_audio_settings', JSON.stringify({
      is8DEnabled,
      eightDSpeed,
      bassGain,
      vocalGain,
      stereoPan,
      isWideEnabled,
      wideMix,
      wideDamp,
      wideRoomSize,
      wideGain
    }));
  }, [
    is8DEnabled,
    eightDSpeed,
    bassGain,
    vocalGain,
    stereoPan,
    isWideEnabled,
    wideMix,
    wideDamp,
    wideRoomSize,
    wideGain
  ]);

  const audioCtxRef = useRef(null);
  const mediaSourcesRef = useRef(new WeakSet());
  const dspGraphInitializedRef = useRef(false);
  const bassFilterRef = useRef(null);
  const vocalFilterRef = useRef(null);
  const stereoPannerRef = useRef(null);
  const stereoRouteGainRef = useRef(null);
  const surroundPannerRef = useRef(null);
  const surroundRouteGainRef = useRef(null);
  const wideConvolverRef = useRef(null);
  const wideDampFilterRef = useRef(null);
  const wideInputGainRef = useRef(null);
  const wideDryGainRef = useRef(null);
  const wideWetGainRef = useRef(null);
  const outputGainRef = useRef(null);
  const animFrameRef = useRef(null);
  const lastUiUpdateRef = useRef(0);
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
      if (ctx.state === 'suspended') ctx.resume();

      if (!dspGraphInitializedRef.current) {
        bassFilterRef.current = ctx.createBiquadFilter();
        bassFilterRef.current.type = 'lowshelf';
        bassFilterRef.current.frequency.value = 110;
        bassFilterRef.current.gain.value = bassGain;

        vocalFilterRef.current = ctx.createBiquadFilter();
        vocalFilterRef.current.type = 'peaking';
        vocalFilterRef.current.frequency.value = 2400;
        vocalFilterRef.current.Q.value = 1.2;
        vocalFilterRef.current.gain.value = vocalGain;

        stereoPannerRef.current = ctx.createStereoPanner();
        stereoPannerRef.current.pan.value = stereoPan;
        stereoRouteGainRef.current = ctx.createGain();
        stereoRouteGainRef.current.gain.value = is8DEnabled ? 0 : 1;

        surroundPannerRef.current = ctx.createPanner();
        surroundPannerRef.current.panningModel = 'HRTF';
        surroundPannerRef.current.distanceModel = 'linear';
        surroundPannerRef.current.maxDistance = 10000;
        surroundPannerRef.current.rolloffFactor = 0;
        setPannerPosition(surroundPannerRef.current, 0, -1, ctx.currentTime);
        surroundRouteGainRef.current = ctx.createGain();
        surroundRouteGainRef.current.gain.value = is8DEnabled ? 1 : 0;

        wideConvolverRef.current = ctx.createConvolver();
        wideConvolverRef.current.buffer = createRoomImpulse(ctx, wideRoomSize, wideDamp);

        wideDampFilterRef.current = ctx.createBiquadFilter();
        wideDampFilterRef.current.type = 'lowpass';
        wideDampFilterRef.current.frequency.value = 20000 * Math.pow(800 / 20000, wideDamp);
        wideInputGainRef.current = ctx.createGain();
        wideDryGainRef.current = ctx.createGain();
        wideDryGainRef.current.gain.value = isWideEnabled ? 1 - wideMix : 1;
        wideWetGainRef.current = ctx.createGain();
        wideWetGainRef.current.gain.value = isWideEnabled ? wideMix : 0;
        outputGainRef.current = ctx.createGain();
        outputGainRef.current.gain.value = Math.pow(10, wideGain / 20);

        bassFilterRef.current.connect(vocalFilterRef.current);

        vocalFilterRef.current.connect(stereoPannerRef.current);
        stereoPannerRef.current.connect(stereoRouteGainRef.current);
        stereoRouteGainRef.current.connect(wideInputGainRef.current);

        vocalFilterRef.current.connect(surroundPannerRef.current);
        surroundPannerRef.current.connect(surroundRouteGainRef.current);
        surroundRouteGainRef.current.connect(wideInputGainRef.current);

        wideDryGainRef.current.connect(outputGainRef.current);
        wideInputGainRef.current.connect(wideDryGainRef.current);
        wideInputGainRef.current.connect(wideConvolverRef.current);
        wideConvolverRef.current.connect(wideDampFilterRef.current);
        wideDampFilterRef.current.connect(wideWetGainRef.current);
        wideWetGainRef.current.connect(outputGainRef.current);
        outputGainRef.current.connect(ctx.destination);
        dspGraphInitializedRef.current = true;
      }

      if (!mediaSourcesRef.current.has(mediaElement)) {
        const sourceNode = ctx.createMediaElementSource(mediaElement);
        sourceNode.connect(bassFilterRef.current);
        mediaSourcesRef.current.add(mediaElement);
      }
    } catch (error) {
      console.error('Không thể khởi tạo xử lý âm thanh DSP:', error);
    }
  };

  const resumeAudioContext = () => {
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  useEffect(() => {
    if (!audioCtxRef.current) return;
    const now = audioCtxRef.current.currentTime;
    bassFilterRef.current?.gain.setTargetAtTime(bassGain, now, 0.02);
  }, [bassGain]);

  useEffect(() => {
    if (!audioCtxRef.current) return;
    const now = audioCtxRef.current.currentTime;
    vocalFilterRef.current?.gain.setTargetAtTime(vocalGain, now, 0.02);
  }, [vocalGain]);

  useEffect(() => {
    if (!audioCtxRef.current) return;
    const now = audioCtxRef.current.currentTime;
    stereoPannerRef.current?.pan.setTargetAtTime(stereoPan, now, 0.02);
  }, [stereoPan]);

  useEffect(() => {
    if (!audioCtxRef.current) return;
    const now = audioCtxRef.current.currentTime;
    stereoRouteGainRef.current?.gain.setTargetAtTime(is8DEnabled ? 0 : 1, now, 0.03);
    surroundRouteGainRef.current?.gain.setTargetAtTime(is8DEnabled ? 1 : 0, now, 0.03);

    if (!is8DEnabled) {
      angleRef.current = 0;
      if (surroundPannerRef.current) {
        setPannerPosition(surroundPannerRef.current, 0, -1, now);
      }
    }
  }, [is8DEnabled, stereoPan]);

  useEffect(() => {
    if (!audioCtxRef.current) return;
    const now = audioCtxRef.current.currentTime;
    wideDryGainRef.current?.gain.setTargetAtTime(isWideEnabled ? 1 - wideMix : 1, now, 0.03);
    wideWetGainRef.current?.gain.setTargetAtTime(isWideEnabled ? wideMix : 0, now, 0.03);
  }, [isWideEnabled, wideMix]);

  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const filter = wideDampFilterRef.current;
    if (filter) {
      filter.frequency.setTargetAtTime(20000 * Math.pow(800 / 20000, wideDamp), ctx.currentTime, 0.03);
    }
    if (wideConvolverRef.current) {
      wideConvolverRef.current.buffer = createRoomImpulse(ctx, wideRoomSize, wideDamp);
    }
  }, [wideDamp, wideRoomSize]);

  useEffect(() => {
    if (!audioCtxRef.current || !outputGainRef.current) return;
    outputGainRef.current.gain.setTargetAtTime(
      Math.pow(10, wideGain / 20),
      audioCtxRef.current.currentTime,
      0.03
    );
  }, [wideGain]);

  useEffect(() => {
    if (is8DEnabled && isPlaying) {
      resumeAudioContext();
      let lastTime = performance.now();

      const animate8D = (now) => {
        const delta = (now - lastTime) / 1000;
        lastTime = now;
        angleRef.current = (angleRef.current + delta * eightDSpeed * Math.PI * 2) % (Math.PI * 2);

        const x = Math.sin(angleRef.current);
        const z = -Math.cos(angleRef.current);
        const ctx = audioCtxRef.current;
        if (surroundPannerRef.current && ctx) {
          setPannerPosition(surroundPannerRef.current, x, z, ctx.currentTime);
        }

        if (now - lastUiUpdateRef.current > 50) {
          setCurrent8DAngle(angleRef.current);
          lastUiUpdateRef.current = now;
        }
        animFrameRef.current = requestAnimationFrame(animate8D);
      };

      animFrameRef.current = requestAnimationFrame(animate8D);
    } else if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [is8DEnabled, isPlaying, eightDSpeed]);

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
    isWideEnabled,
    setIsWideEnabled,
    wideMix,
    setWideMix,
    wideDamp,
    setWideDamp,
    wideRoomSize,
    setWideRoomSize,
    wideGain,
    setWideGain,
    current8DAngle
  };
}
