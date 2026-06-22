import React, { useEffect, useRef, useState } from "react";
import { HorizontalNoteTuner } from "./HorizontalNoteTuner";

export interface SpectrumSettings {
  fftSize?: number;
  smoothingTimeConstant?: number;
}

const PITCH_HISTORY_SIZE = 7;
const PITCH_SMOOTHING = 0.18;
const SILENCE_HOLD_MS = 1200;

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  const size = buf.length;
  let rms = 0;

  for (let i = 0; i < size; i += 1) {
    rms += buf[i] * buf[i];
  }

  rms = Math.sqrt(rms / size);
  if (rms < 0.01) {
    return -1;
  }

  let r1 = 0;
  let r2 = size - 1;
  const threshold = 0.2;

  for (let i = 0; i < size / 2; i += 1) {
    if (Math.abs(buf[i]) < threshold) {
      r1 = i;
      break;
    }
  }

  for (let i = 1; i < size / 2; i += 1) {
    if (Math.abs(buf[size - i]) < threshold) {
      r2 = size - i;
      break;
    }
  }

  const trimmed = buf.slice(r1, r2);
  const len = trimmed.length;
  const correlation = new Float32Array(len);

  for (let i = 0; i < len; i += 1) {
    for (let j = 0; j < len - i; j += 1) {
      correlation[i] += trimmed[j] * trimmed[j + i];
    }
  }

  let dip = 0;
  while (dip < len - 1 && correlation[dip] > correlation[dip + 1]) {
    dip += 1;
  }

  let maxPos = -1;
  let maxVal = -1;
  for (let i = dip; i < len; i += 1) {
    if (correlation[i] > maxVal) {
      maxVal = correlation[i];
      maxPos = i;
    }
  }

  if (maxPos < 1) {
    return -1;
  }

  const x1 = correlation[maxPos - 1];
  const x2 = correlation[maxPos];
  const x3 = correlation[maxPos + 1] || 0;
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  const period = a !== 0 ? maxPos - b / (2 * a) : maxPos;

  return sampleRate / period;
}

interface SpectrumVisualizerProps {
  settings: SpectrumSettings;
}

export const SpectrumVisualizer: React.FC<SpectrumVisualizerProps> = ({
  settings,
}) => {
  const { fftSize = 2048, smoothingTimeConstant = 0.8 } = settings;
  const [started, setStarted] = useState(false);
  const [detectedFreq, setDetectedFreq] = useState<number | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timeDataRef = useRef<Float32Array | null>(null);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const pitchHistoryRef = useRef<number[]>([]);
  const displayFreqRef = useRef<number | null>(null);
  const lastPitchTimeRef = useRef<number>(0);

  const startAudio = async () => {
    if (started) {
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioCtx = new window.AudioContext();
    const analyser = audioCtx.createAnalyser();

    analyser.fftSize = fftSize;
    analyser.smoothingTimeConstant = smoothingTimeConstant;

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    streamRef.current = stream;
    audioCtxRef.current = audioCtx;
    analyserRef.current = analyser;
    timeDataRef.current = new Float32Array(analyser.fftSize);
    setStarted(true);
  };

  useEffect(() => {
    if (!started) {
      return;
    }

    const tick = () => {
      const analyser = analyserRef.current;
      const timeData = timeDataRef.current;

      if (!analyser || !timeData || !audioCtxRef.current) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      analyser.getFloatTimeDomainData(timeData);
      const freq = autoCorrelate(timeData, audioCtxRef.current.sampleRate);
      const now = performance.now();

      if (freq > 0) {
        const history = pitchHistoryRef.current;
        history.push(freq);
        if (history.length > PITCH_HISTORY_SIZE) {
          history.shift();
        }

        const targetFreq = median(history);
        const currentFreq = displayFreqRef.current ?? targetFreq;
        const nextFreq =
          currentFreq + (targetFreq - currentFreq) * PITCH_SMOOTHING;

        displayFreqRef.current = nextFreq;
        lastPitchTimeRef.current = now;
        setDetectedFreq(nextFreq);
      } else if (now - lastPitchTimeRef.current < SILENCE_HOLD_MS) {
        setDetectedFreq(displayFreqRef.current);
      } else {
        pitchHistoryRef.current = [];
        displayFreqRef.current = null;
        setDetectedFreq(null);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [started]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      audioCtxRef.current?.close();
    };
  }, []);

  return (
    <HorizontalNoteTuner
      measuredHz={detectedFreq}
      started={started}
      onStart={startAudio}
    />
  );
};
