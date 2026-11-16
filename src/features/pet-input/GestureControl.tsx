import { useCallback, useEffect, useRef, useState } from 'react';
import type { GestureRecognizer } from '@mediapipe/tasks-vision';
import type { PetCommand } from '../health/types';
import { GESTURE_COMMANDS, GestureStabilizer } from './gestures';

/** Bundled with the app (see scripts/fetch-gesture-model.mjs) for offline use. */
const LOCAL_MODEL = `${import.meta.env.BASE_URL}models/gesture_recognizer.task`;
/** Fallback when the model is not bundled. Requires internet; disclosed in the UI. */
const REMOTE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';
const WASM_BASE = `${import.meta.env.BASE_URL}mediapipe`;
/** Process ~10 frames/s: enough for gestures, light on CPU. */
const FRAME_INTERVAL_MS = 100;

type Phase = 'off' | 'starting' | 'on' | 'error';

let recognizerPromise: Promise<{ recognizer: GestureRecognizer; remote: boolean }> | undefined;

function loadRecognizer() {
  recognizerPromise ??= (async () => {
    const { GestureRecognizer } = await import('@mediapipe/tasks-vision');
    const wasm = { wasmLoaderPath: `${WASM_BASE}/vision_wasm_internal.js`, wasmBinaryPath: `${WASM_BASE}/vision_wasm_internal.wasm` };
    const create = (modelAssetPath: string) =>
      GestureRecognizer.createFromOptions(wasm, {
        baseOptions: { modelAssetPath, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numHands: 1,
      });
    // Bundled model first (works offline); Google's hosted copy only as a fallback.
    try {
      return { recognizer: await create(LOCAL_MODEL), remote: false };
    } catch {
      return { recognizer: await create(REMOTE_MODEL), remote: true };
    }
  })();
  recognizerPromise.catch(() => {
    recognizerPromise = undefined;
  });
  return recognizerPromise;
}

/**
 * Opt-in camera hand gestures. Frames are processed in the browser and are
 * never recorded, stored or uploaded. Off by default; stopping releases the camera.
 */
export function GestureControl({ onCommand }: { onCommand: (cmd: PetCommand, source: string) => void }) {
  const [phase, setPhase] = useState<Phase>('off');
  const [error, setError] = useState<string>();
  const [remoteModel, setRemoteModel] = useState(false);
  const [seen, setSeen] = useState<{ gesture: string; score: number }>();
  const [lastFired, setLastFired] = useState<string>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream>();
  const rafRef = useRef<number>();
  const stabilizer = useRef(new GestureStabilizer());
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = undefined;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = undefined;
    if (videoRef.current) videoRef.current.srcObject = null;
    stabilizer.current.reset();
    setSeen(undefined);
    setPhase('off');
  }, []);

  useEffect(() => stop, [stop]);

  // Stop processing (and release the camera) when the tab is hidden.
  useEffect(() => {
    const onVis = () => document.hidden && phase === 'on' && stop();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [phase, stop]);

  const start = useCallback(async () => {
    setError(undefined);
    setPhase('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      const { recognizer, remote } = await loadRecognizer();
      setRemoteModel(remote);
      if (!streamRef.current) return; // stopped while loading
      setPhase('on');
      let last = 0;
      const loop = (now: number) => {
        rafRef.current = requestAnimationFrame(loop);
        if (now - last < FRAME_INTERVAL_MS || video.readyState < 2) return;
        last = now;
        const res = recognizer.recognizeForVideo(video, now);
        const top = res.gestures[0]?.[0];
        setSeen(top ? { gesture: top.categoryName, score: top.score } : undefined);
        const fired = stabilizer.current.push({ gesture: top?.categoryName, score: top?.score ?? 0, t: now });
        if (fired) {
          setLastFired(`${GESTURE_COMMANDS[fired.gesture].label} → ${fired.command}`);
          onCommandRef.current(fired.command, 'gesture');
        }
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      const name = (e as Error)?.name;
      stop();
      setPhase('error');
      setError(
        name === 'NotAllowedError'
          ? 'Camera permission was denied. The buttons and keys 1–6 still work.'
          : name === 'NotFoundError'
            ? 'No camera was found.'
            : !navigator.onLine
              ? 'You’re offline and the gesture model isn’t saved on this device yet. Open SYNORA once while online, then gestures work offline. The buttons still work.'
              : 'Gesture recognition could not start (the model or runtime failed to load). The buttons still work.',
      );
    }
  }, [stop]);

  if (!supported) {
    return <p className="text-xs text-text-muted">Camera gestures are not supported in this browser. The buttons and keys 1–6 work.</p>;
  }

  const seenLabel = seen && seen.gesture !== 'None' ? `${GESTURE_COMMANDS[seen.gesture]?.label ?? seen.gesture} (${Math.round(seen.score * 100)}%)` : 'No gesture';

  return (
    <div className="w-full rounded border border-white/10 bg-panel p-3 text-left text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-text-secondary">
          Camera gestures <span className="font-normal text-text-muted">(optional, beta)</span>
        </span>
        <span className={phase === 'on' ? 'text-stable' : 'text-text-muted'} role="status">
          {phase === 'on' ? '● Camera on' : phase === 'starting' ? '… Starting' : '○ Camera off'}
        </span>
      </div>
      <div className={phase === 'off' || phase === 'error' ? 'hidden' : 'mt-2 flex items-start gap-3'}>
        <video ref={videoRef} muted playsInline className="h-24 w-32 rounded border border-white/10 bg-black object-cover" style={{ transform: 'scaleX(-1)' }} aria-label="Camera preview (mirrored, not recorded)" />
        <div className="space-y-1">
          <p>Seeing: <strong>{seenLabel}</strong></p>
          <p>Last action: <strong>{lastFired ?? '—'}</strong></p>
          {remoteModel && <p className="text-review">Model loaded from Google’s model storage (needs internet).</p>}
        </div>
      </div>
      <ul className="mt-2 grid grid-cols-3 gap-1 text-text-muted">
        <li>✋ Open palm → stand/float</li>
        <li>☝ Pointing up → sit/settle</li>
        <li>✊ Fist → jump/bob</li>
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {phase === 'on' || phase === 'starting' ? (
          <button onClick={stop} className="rounded border border-attention/60 px-2 py-1 text-attention">Stop camera</button>
        ) : (
          <button onClick={start} className="rounded border border-cyan/60 px-2 py-1 text-cyan">Enable camera gestures</button>
        )}
        <span className="text-text-muted">Video is processed on this device only. It is never recorded, stored or uploaded.</span>
      </div>
      {error && <p className="mt-2 text-review" role="alert">{error}</p>}
    </div>
  );
}
