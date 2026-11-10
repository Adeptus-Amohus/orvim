"""Three refinements each of the user's selected Fairy and Warm Keys motifs.

Python 3 + NumPy. Original v2 auditions stay intact; this generates v3.
These files are not enabled as notification sounds before the user chooses.
"""
import importlib.util
import json
import math
from pathlib import Path
import wave

import numpy as np

SOURCE = Path(__file__).with_name("create-friendly-notification-candidates.py")
SPEC = importlib.util.spec_from_file_location("friendly_audio", SOURCE)
BASE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BASE)
RATE = BASE.RATE
OUTPUT = Path(__file__).resolve().parents[1] / "public" / "sounds" / "candidates" / "v3"


def tone(midi, duration, voice, softness, brightness, decay):
    t = np.arange(round(duration * RATE)) / RATE
    phase = 2 * np.pi * BASE.pitch(midi) * t
    release = BASE.smooth((duration - t) / max(0.1, 0.2 / decay))
    if voice == "harp":
        y = np.zeros(len(t))
        for harmonic in range(1, 10):
            amplitude = harmonic ** -1.7 * (1 if harmonic == 1 else brightness)
            y += amplitude * np.sin(phase * harmonic) * np.exp(-t * (2.8 + harmonic * 1.8) * decay)
        envelope = BASE.smooth(t / (0.012 * softness)) * release
    elif voice == "musicbox":
        y = np.sin(phase) * np.exp(-3.2 * decay * t)
        y += 0.12 * brightness * np.sin(phase * 2.003) * np.exp(-6.2 * decay * t)
        y += 0.043 * brightness * np.sin(phase * 3.98) * np.exp(-9.4 * decay * t)
        envelope = BASE.smooth(t / (0.018 * softness)) * release
    else:
        y = np.sin(phase + 0.18 * brightness * np.sin(phase * 2) * np.exp(-9 * decay * t))
        y += 0.055 * brightness * np.sin(phase * 2) * np.exp(-7 * decay * t)
        envelope = BASE.smooth(t / (0.028 * softness)) * release * np.exp(-2.3 * decay * t)
    return y * envelope


def create(filename, label, family, duration, notes, softness, brightness, decay, space):
    dry = np.zeros((round(duration * RATE), 2))
    for start, midi, length, gain, voice, pan in notes:
        signal = tone(midi, length, voice, softness, brightness, decay) * gain
        offset = round(start * RATE)
        count = min(len(signal), len(dry) - offset)
        dry[offset:offset + count, 0] += signal[:count] * math.sqrt((1 - pan) / 2)
        dry[offset:offset + count, 1] += signal[:count] * math.sqrt((1 + pan) / 2)
    # Preserve the intimate space of the selected v2 sounds, with less echo in
    # the compact versions. The melody remains centred for phone speakers.
    spatial = BASE.gentle_space(dry)
    audio = dry + space * (spatial - dry)
    edge = round(0.1 * RATE)
    audio[-edge:] *= BASE.smooth(np.linspace(1, 0, edge))[:, None]
    audio[0] = audio[-1] = 0
    audio *= 0.26 / np.max(np.abs(audio))
    pcm = np.rint(audio * 32767).astype("<i2")
    with wave.open(str(OUTPUT / filename), "wb") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(pcm.tobytes())
    return {
        "file": filename, "label": label, "family": family,
        "group": "wellbeing" if family == "Fairy" else "schedule",
        "duration": duration, "peak": 0.26,
        "rms": round(float(np.sqrt(np.mean(audio ** 2))), 4),
        "source": "v2/wellbeing-01-fairy.wav" if family == "Fairy" else "v2/schedule-02-warm-keys.wav",
        "enabled": False,
    }


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    variants = [
        create("fairy-01-soft.wav", "Нежная", "Fairy", 1.95, [
            (0.00, 65, 0.85, 0.80, "harp", -0.09),
            (0.16, 69, 0.90, 0.76, "harp", 0.04),
            (0.33, 72, 0.95, 0.82, "musicbox", 0.09),
            (0.54, 74, 0.95, 0.57, "musicbox", -0.04),
            (0.54, 53, 0.90, 0.17, "keys", 0.0),
            (0.54, 57, 0.85, 0.07, "keys", 0.0),
        ], softness=1.45, brightness=0.62, decay=0.9, space=0.8),
        create("fairy-02-sparkle.wav", "Искра", "Fairy", 1.85, [
            (0.00, 65, 0.75, 0.80, "harp", -0.09),
            (0.12, 69, 0.80, 0.74, "harp", 0.04),
            (0.26, 72, 0.90, 0.76, "musicbox", 0.09),
            (0.41, 74, 0.85, 0.47, "musicbox", -0.04),
            (0.59, 77, 0.80, 0.40, "musicbox", 0.04),
            (0.59, 53, 0.75, 0.18, "keys", 0.0),
        ], softness=1.15, brightness=0.96, decay=1.02, space=1.05),
        create("fairy-03-short.wav", "Короткая", "Fairy", 1.25, [
            (0.00, 65, 0.50, 0.80, "harp", -0.06),
            (0.10, 69, 0.55, 0.73, "harp", 0.02),
            (0.22, 72, 0.59, 0.75, "musicbox", 0.06),
            (0.35, 74, 0.60, 0.50, "musicbox", -0.02),
            (0.35, 53, 0.55, 0.15, "keys", 0.0),
        ], softness=1.25, brightness=0.75, decay=1.28, space=0.42),
        create("warm-keys-01-velvet.wav", "Бархатная", "Warm Keys", 1.95, [
            (0.00, 58, 1.05, 0.60, "keys", -0.035),
            (0.17, 62, 1.10, 0.54, "keys", 0.035),
            (0.36, 65, 1.10, 0.47, "keys", 0.0),
            (0.36, 58, 1.05, 0.14, "keys", 0.0),
            (0.36, 70, 0.85, 0.12, "harp", 0.07),
        ], softness=1.6, brightness=0.6, decay=0.85, space=0.75),
        create("warm-keys-02-bright.wav", "Светлая", "Warm Keys", 1.8, [
            (0.00, 58, 0.90, 0.60, "keys", -0.035),
            (0.14, 62, 0.90, 0.55, "keys", 0.035),
            (0.30, 65, 0.90, 0.48, "keys", 0.0),
            (0.49, 70, 0.85, 0.30, "keys", 0.035),
            (0.49, 58, 0.80, 0.14, "keys", 0.0),
            (0.49, 70, 0.65, 0.10, "harp", -0.07),
        ], softness=1.25, brightness=0.85, decay=1.03, space=0.8),
        create("warm-keys-03-short.wav", "Короткая", "Warm Keys", 1.15, [
            (0.00, 58, 0.62, 0.60, "keys", -0.025),
            (0.12, 62, 0.62, 0.55, "keys", 0.025),
            (0.25, 65, 0.62, 0.47, "keys", 0.0),
            (0.25, 70, 0.50, 0.13, "harp", 0.05),
            (0.25, 58, 0.55, 0.10, "keys", 0.0),
        ], softness=1.35, brightness=0.72, decay=1.25, space=0.38),
    ]
    (OUTPUT / "manifest.json").write_text(json.dumps(variants, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"created": len(variants), "path": str(OUTPUT), "variants": variants}, ensure_ascii=True))


if __name__ == "__main__":
    main()
