"""Second notification audition: original, gentle adventure-game motifs.

Run with Python 3 and NumPy. The six WAV files are audition assets;
the application does not select or enable them automatically.
"""
from pathlib import Path
import json
import math
import wave

import numpy as np

RATE = 44100
OUTPUT = Path(__file__).resolve().parents[1] / "public" / "sounds" / "candidates" / "v2"
RNG = np.random.default_rng(24680)


def pitch(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def smooth(value):
    x = np.clip(value, 0, 1)
    return x * x * (3 - 2 * x)


def instrument(midi, duration, voice):
    t = np.arange(round(duration * RATE)) / RATE
    frequency = pitch(midi)
    phase = 2 * np.pi * frequency * t
    if voice == "ocarina":
        # Rounded, breath-led tone with very slight delayed vibrato.
        vibrato = smooth((t - 0.12) / 0.2) * frequency * 0.0018 / 5.1 * np.sin(2 * np.pi * 5.1 * t)
        p = phase + vibrato
        air = RNG.normal(0, 1, len(t))
        air = np.convolve(air, np.ones(10) / 10, mode="same")
        y = np.sin(p) + 0.12 * np.sin(2 * p) + 0.024 * np.sin(3 * p) + 0.028 * air
        envelope = smooth(t / 0.045) * smooth((duration - t) / 0.16) * np.exp(-0.6 * t)
    elif voice == "harp":
        y = np.zeros(len(t))
        for harmonic in range(1, 10):
            amplitude = harmonic ** -1.7
            y += amplitude * np.sin(phase * harmonic) * np.exp(-t * (2.8 + harmonic * 1.8))
        envelope = smooth(t / 0.012) * smooth((duration - t) / 0.16)
    elif voice == "musicbox":
        # Felt-damped tines: enough upper harmonics to suggest a music box.
        y = np.sin(phase) * np.exp(-3.2 * t)
        y += 0.12 * np.sin(phase * 2.003) * np.exp(-6.2 * t)
        y += 0.043 * np.sin(phase * 3.98) * np.exp(-9.4 * t)
        envelope = smooth(t / 0.018) * smooth((duration - t) / 0.2)
    else:
        # Warm electric keys, with a low register and a soft hammer.
        y = np.sin(phase + 0.18 * np.sin(phase * 2) * np.exp(-9 * t))
        y += 0.055 * np.sin(phase * 2) * np.exp(-7 * t)
        envelope = smooth(t / 0.028) * smooth((duration - t) / 0.2) * np.exp(-2.3 * t)
    return y * envelope


def add_note(track, start, midi, duration, gain, voice, pan):
    signal = instrument(midi, duration, voice) * gain
    offset = round(start * RATE)
    available = min(len(signal), len(track) - offset)
    signal = signal[:available]
    track[offset:offset + available, 0] += signal * math.sqrt((1 - pan) / 2)
    track[offset:offset + available, 1] += signal * math.sqrt((1 + pan) / 2)


def gentle_space(dry):
    # Quiet cross-channel reflections. Most of the sound stays in the centre,
    # so the melody is also clear on a single phone speaker.
    stereo = dry.copy()
    for delay, gain, cross in [
        (0.042, 0.12, False), (0.071, 0.10, True),
        (0.113, 0.078, False), (0.163, 0.057, True),
        (0.227, 0.038, False), (0.307, 0.023, True),
        (0.409, 0.013, False), (0.527, 0.007, True),
    ]:
        offset = round(delay * RATE)
        source = dry[:-offset, ::-1] if cross else dry[:-offset]
        stereo[offset:] += source * gain
    # A soft low-pass removes the sharpest attack harmonics.
    stereo = (stereo + 0.75 * np.roll(stereo, 1, axis=0) + 0.4 * np.roll(stereo, 2, axis=0)) / 2.15
    end = round(0.1 * RATE)
    stereo[-end:] *= smooth(np.linspace(1, 0, end))[:, None]
    stereo[0] = 0
    stereo[-1] = 0
    return stereo


def create(filename, label, group, duration, notes):
    dry = np.zeros((round(duration * RATE), 2))
    for start, midi, length, gain, voice, pan in notes:
        add_note(dry, start, midi, length, gain, voice, pan)
    signal = gentle_space(dry)
    # Headroom and matching peak levels for fair auditions.
    signal *= 0.26 / np.max(np.abs(signal))
    encoded = np.rint(signal * 32767).astype("<i2")
    with wave.open(str(OUTPUT / filename), "wb") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(encoded.tobytes())
    return {
        "file": filename, "label": label, "group": group,
        "duration": duration, "peak": 0.26,
        "rms": round(float(np.sqrt(np.mean(signal ** 2))), 4),
        "original": True, "enabled": False,
    }


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    candidates = [
        create("wellbeing-01-fairy.wav", "Маленькая радость", "wellbeing", 2.0, [
            (0.00, 65, 0.80, 0.80, "harp", -0.12),
            (0.15, 69, 0.85, 0.77, "harp", 0.05),
            (0.32, 72, 0.95, 0.85, "musicbox", 0.12),
            (0.52, 74, 1.00, 0.62, "musicbox", -0.05),
            (0.52, 53, 0.80, 0.15, "keys", 0.0),
        ]),
        create("wellbeing-02-ocarina.wav", "Окарина", "wellbeing", 1.95, [
            (0.00, 67, 0.36, 0.65, "ocarina", -0.04),
            (0.23, 71, 0.38, 0.59, "ocarina", 0.02),
            (0.48, 74, 0.57, 0.62, "ocarina", 0.04),
            (0.78, 76, 0.62, 0.46, "ocarina", 0.0),
            (0.00, 55, 0.70, 0.19, "harp", -0.12),
            (0.48, 59, 0.85, 0.12, "harp", 0.12),
        ]),
        create("wellbeing-03-musicbox.wav", "Музыкальная шкатулка", "wellbeing", 2.1, [
            (0.00, 72, 0.95, 0.70, "musicbox", -0.12),
            (0.16, 76, 0.95, 0.62, "musicbox", 0.08),
            (0.35, 79, 1.05, 0.43, "musicbox", 0.12),
            (0.59, 76, 1.00, 0.52, "musicbox", -0.06),
            (0.59, 60, 0.95, 0.26, "keys", 0.0),
            (0.59, 67, 0.90, 0.16, "keys", 0.0),
        ]),
        create("schedule-01-harp.wav", "Тихая арфа", "schedule", 1.55, [
            (0.00, 64, 0.85, 0.76, "harp", -0.10),
            (0.18, 67, 0.90, 0.65, "harp", 0.10),
            (0.18, 60, 0.80, 0.26, "keys", 0.0),
        ]),
        create("schedule-02-warm-keys.wav", "Тёплые клавиши", "schedule", 1.65, [
            (0.00, 58, 0.95, 0.60, "keys", -0.04),
            (0.16, 62, 0.95, 0.56, "keys", 0.04),
            (0.34, 65, 0.95, 0.49, "keys", 0.0),
            (0.34, 70, 0.75, 0.16, "harp", 0.12),
        ]),
        create("schedule-03-forest.wav", "Лесной зов", "schedule", 1.65, [
            (0.00, 69, 0.39, 0.60, "ocarina", -0.04),
            (0.28, 73, 0.50, 0.54, "ocarina", 0.04),
            (0.60, 69, 0.51, 0.37, "ocarina", 0.0),
            (0.00, 57, 0.65, 0.12, "harp", -0.08),
        ]),
    ]
    (OUTPUT / "manifest.json").write_text(json.dumps(candidates, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"created": len(candidates), "path": str(OUTPUT), "candidates": candidates}, ensure_ascii=True))


if __name__ == "__main__":
    main()
