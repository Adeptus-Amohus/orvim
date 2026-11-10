import { mkdirSync, writeFileSync } from "node:fs";

// Original three-note bell. No samples or melodies from other works are used.
const rate = 44100,
  seconds = 0.95,
  frames = Math.ceil(rate * seconds);
const notes = [
  [0, 659.255, 0.35],
  [0.105, 987.767, 0.28],
  [0.21, 1318.51, 0.24],
];
const pcm = Buffer.alloc(frames * 4);
for (let frame = 0; frame < frames; frame++) {
  const time = frame / rate;
  let sample = 0;
  for (const [start, frequency, gain] of notes) {
    const age = time - start;
    if (age < 0) continue;
    const envelope = (1 - Math.exp(-age * 190)) * Math.exp(-age * 7.5);
    sample +=
      gain *
      envelope *
      (Math.sin(2 * Math.PI * frequency * age) +
        0.12 * Math.sin(2 * Math.PI * frequency * 2.003 * age));
  }
  const fade = Math.min(1, (seconds - time) / 0.08);
  const value = Math.round(
    Math.max(-1, Math.min(1, sample * fade * 0.62)) * 32767,
  );
  pcm.writeInt16LE(value, frame * 4);
  pcm.writeInt16LE(value, frame * 4 + 2);
}
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write("WAVEfmt ", 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(rate, 24);
header.writeUInt32LE(rate * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(pcm.length, 40);
mkdirSync("public/sounds/training", { recursive: true });
writeFileSync(
  "public/sounds/training/rest-ready.wav",
  Buffer.concat([header, pcm]),
);
