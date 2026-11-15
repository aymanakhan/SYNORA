// Downloads MediaPipe's Gesture Recognizer model into public/models/ so camera
// gestures work offline (the app otherwise falls back to Google's hosted copy,
// which needs internet). Review the model card's licence before committing it:
// https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer
import { mkdir, writeFile } from 'node:fs/promises';

const URL =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';
const OUT = new globalThis.URL('../public/models/gesture_recognizer.task', import.meta.url);

const res = await fetch(URL);
if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
const buf = Buffer.from(await res.arrayBuffer());
await mkdir(new globalThis.URL('.', OUT), { recursive: true });
await writeFile(OUT, buf);
console.log(`Saved ${(buf.length / 1e6).toFixed(1)} MB to public/models/gesture_recognizer.task`);
