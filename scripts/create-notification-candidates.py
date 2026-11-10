"""Original notification candidates. Uses only Python's standard library.

No candidate is enabled in the app until the user chooses one.
Run: python scripts/create-notification-candidates.py
"""
import json
import math
from pathlib import Path
import struct
import wave

RATE = 44100
OUTPUT = Path(__file__).resolve().parents[1] / "public" / "sounds" / "candidates"


def note(frequency, elapsed, duration, timbre):
    if elapsed < 0 or elapsed >= duration:
        return 0.0
    attack = min(1.0, elapsed / 0.006)
    release = min(1.0, (duration - elapsed) / 0.035)
    decay = math.exp(-elapsed * (4.2 if timbre == "bell" else 7.5))
    phase = 2 * math.pi * frequency * elapsed
    if timbre == "bell":
        tone = math.sin(phase) + 0.18 * math.sin(phase * 2.01) * math.exp(-elapsed * 8) + 0.06 * math.sin(phase * 3.9) * math.exp(-elapsed * 14)
    elif timbre == "glass":
        tone = math.sin(phase) + 0.24 * math.sin(phase * 2.76) * math.exp(-elapsed * 12)
    else:
        tone = math.sin(phase + 0.8 * math.sin(phase * 2) * math.exp(-elapsed * 24))
    return tone * attack * release * decay


def create(filename, label, group, duration, notes, timbre):
    samples = []
    for i in range(round(duration * RATE)):
        time = i / RATE
        value = sum(gain * note(hz, time - start, length, timbre) for start, hz, length, gain in notes)
        samples.append(value)
    peak = max(abs(value) for value in samples) or 1
    # Consistent headroom, gentle transients, no clipping.
    scale = 0.28 / peak
    with wave.open(str(OUTPUT / filename), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(RATE)
        wav.writeframes(b"".join(struct.pack("<h", round(value * scale * 32767)) for value in samples))
    return {"file": filename, "label": label, "group": group, "duration": duration, "peak": 0.28}


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    candidates = [
        create("wellbeing-01.wav", "Две ноты", "wellbeing", 1.15, [(0, 659.25, 0.95, 1), (0.15, 880, 0.9, 0.8)], "bell"),
        create("wellbeing-02.wav", "Капля", "wellbeing", 0.95, [(0, 783.99, 0.7, 1), (0.09, 1174.66, 0.75, 0.5)], "glass"),
        create("wellbeing-03.wav", "Мягкий аккорд", "wellbeing", 1.35, [(0, 523.25, 1.2, 0.9), (0.07, 659.25, 1.15, 0.75), (0.14, 783.99, 1.1, 0.65)], "bell"),
        create("schedule-01.wav", "Двойной сигнал", "schedule", 0.7, [(0, 1046.5, 0.32, 1), (0.2, 1046.5, 0.45, 0.9)], "pulse"),
        create("schedule-02.wav", "Стекло", "schedule", 0.8, [(0, 1318.51, 0.7, 1), (0.04, 659.25, 0.65, 0.4)], "glass"),
        create("schedule-03.wav", "Три ноты", "schedule", 0.95, [(0, 783.99, 0.5, 0.75), (0.13, 987.77, 0.6, 0.85), (0.26, 1174.66, 0.65, 1)], "pulse"),
    ]
    (OUTPUT / "manifest.json").write_text(json.dumps(candidates, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"created": len(candidates), "path": str(OUTPUT)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
