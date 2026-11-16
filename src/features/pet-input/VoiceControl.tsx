import { useRef, useState } from 'react';
import type { PetCommand, PetSpecies } from '../health/types';
import { parseVoiceCommand, voiceHints } from './voice';

// Minimal typing for the (still vendor-prefixed) Web Speech API.
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: { 0: { transcript: string } }[] & { length: number } }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type Ctor = new () => SpeechRecognitionLike;

function getCtor(): Ctor | undefined {
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/**
 * Push-to-talk voice commands. Listens only after a click, for a single
 * phrase, and never continuously. Browser speech services may send audio to
 * the browser vendor's servers and may need internet, which the UI discloses.
 */
export function VoiceControl({ onCommand, species }: { onCommand: (cmd: PetCommand, source: string) => void; species?: PetSpecies }) {
  const hints = voiceHints(species).map((w) => `“${w}”`);
  const Ctor = getCtor();
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<string>();
  const [result, setResult] = useState<string>();
  const [error, setError] = useState<string>();
  const rec = useRef<SpeechRecognitionLike>();

  if (!Ctor) {
    return <p className="text-xs text-text-muted">Voice commands are not supported in this browser. The buttons and keys 1–5 work.</p>;
  }

  const listen = () => {
    setError(undefined);
    setHeard(undefined);
    setResult(undefined);
    const r = new Ctor();
    r.lang = 'en-US';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.continuous = false;
    r.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript ?? '';
      setHeard(text);
      const cmd = parseVoiceCommand(text, species);
      if (cmd) {
        setResult(`→ ${species === 'axolotl' && cmd === 'stand' ? 'float' : cmd}`);
        onCommand(cmd, 'voice');
      } else {
        setResult(`No pet command recognised. Try ${hints.slice(0, 3).join(', ')}.`);
      }
    };
    r.onerror = (e) => {
      setError(
        e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'Microphone permission was denied.'
          : e.error === 'network'
            ? 'Speech recognition needs an internet connection in this browser.'
            : e.error === 'no-speech'
              ? 'Didn’t hear anything. Try again.'
              : `Speech recognition error: ${e.error}`,
      );
    };
    r.onend = () => setListening(false);
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setError('Could not start speech recognition.');
    }
  };

  return (
    <div className="w-full rounded border border-white/10 bg-panel p-3 text-left text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-text-secondary">
          Voice commands <span className="font-normal text-text-muted">(optional, push-to-talk)</span>
        </span>
        <span className={listening ? 'text-stable' : 'text-text-muted'} role="status">{listening ? '● Listening…' : '○ Mic off'}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {listening ? (
          <button onClick={() => rec.current?.stop()} className="rounded border border-attention/60 px-2 py-1 text-attention">Stop</button>
        ) : (
          <button onClick={listen} className="rounded border border-cyan/60 px-2 py-1 text-cyan">🎙 Push to talk</button>
        )}
        <span className="text-text-muted">Say {hints.slice(0, -1).join(', ')} or {hints[hints.length - 1]}.</span>
      </div>
      {heard !== undefined && (
        <p className="mt-2">Heard: “{heard}” <strong>{result}</strong></p>
      )}
      {error && <p className="mt-2 text-review" role="alert">{error}</p>}
      <p className="mt-2 text-text-muted">
        Your browser’s speech service may send the audio to its provider (e.g. Google for Chrome) and may need internet. SYNORA never stores or uploads audio itself, and only listens after you press the button.
      </p>
    </div>
  );
}
