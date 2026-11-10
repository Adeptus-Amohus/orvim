"""Close variations of Fairy Short and Warm Keys Velvet, selected by the user.

Python 3 + NumPy. Outputs v4 audition files, retaining previous versions.
"""
import importlib.util
import json
from pathlib import Path

SOURCE = Path(__file__).with_name("refine-notification-candidates.py")
SPEC = importlib.util.spec_from_file_location("refined_audio", SOURCE)
AUDIO = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIO)
OUTPUT = Path(__file__).resolve().parents[1] / "public" / "sounds" / "candidates" / "v4"


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    AUDIO.OUTPUT = OUTPUT
    variants = [
        AUDIO.create("short-01-smooth.wav", "Плавнее", "Fairy", 1.25, [
            (0.00, 65, 0.53, 0.80, "harp", -0.045),
            (0.10, 69, 0.57, 0.72, "harp", 0.015),
            (0.22, 72, 0.62, 0.73, "musicbox", 0.045),
            (0.35, 74, 0.64, 0.46, "musicbox", -0.015),
            (0.35, 53, 0.57, 0.16, "keys", 0.0),
        ], softness=1.5, brightness=0.6, decay=1.18, space=0.42),
        AUDIO.create("short-02-resolved.wav", "Ясный финал", "Fairy", 1.25, [
            (0.00, 65, 0.51, 0.80, "harp", -0.045),
            (0.10, 69, 0.55, 0.72, "harp", 0.015),
            (0.22, 72, 0.58, 0.71, "musicbox", 0.045),
            (0.35, 77, 0.60, 0.41, "musicbox", -0.015),
            (0.35, 53, 0.56, 0.17, "keys", 0.0),
            (0.35, 60, 0.52, 0.07, "keys", 0.0),
        ], softness=1.4, brightness=0.65, decay=1.2, space=0.4),
        AUDIO.create("short-03-compact.wav", "Ещё короче", "Fairy", 1.05, [
            (0.00, 65, 0.42, 0.80, "harp", -0.035),
            (0.08, 69, 0.44, 0.71, "harp", 0.01),
            (0.18, 72, 0.46, 0.72, "musicbox", 0.035),
            (0.29, 74, 0.49, 0.45, "musicbox", -0.01),
            (0.29, 53, 0.44, 0.15, "keys", 0.0),
        ], softness=1.35, brightness=0.64, decay=1.3, space=0.25),
        AUDIO.create("velvet-01-warm.wav", "Теплее", "Warm Keys", 1.9, [
            (0.00, 58, 1.05, 0.60, "keys", -0.025),
            (0.17, 62, 1.08, 0.53, "keys", 0.025),
            (0.36, 65, 1.08, 0.46, "keys", 0.0),
            (0.36, 58, 1.00, 0.14, "keys", 0.0),
            (0.36, 70, 0.82, 0.09, "harp", 0.05),
        ], softness=1.85, brightness=0.44, decay=0.9, space=0.65),
        AUDIO.create("velvet-02-full.wav", "Объёмнее", "Warm Keys", 2.05, [
            (0.00, 58, 1.10, 0.60, "keys", -0.035),
            (0.16, 62, 1.15, 0.53, "keys", 0.035),
            (0.33, 65, 1.15, 0.46, "keys", 0.0),
            (0.33, 58, 1.10, 0.12, "keys", -0.025),
            (0.33, 62, 1.05, 0.10, "keys", 0.025),
            (0.33, 70, 0.86, 0.08, "harp", 0.06),
            (0.00, 53, 0.90, 0.055, "keys", 0.0),
        ], softness=1.7, brightness=0.57, decay=0.8, space=0.88),
        AUDIO.create("velvet-03-simple.wav", "Лаконичнее", "Warm Keys", 1.7, [
            (0.00, 58, 0.98, 0.60, "keys", -0.02),
            (0.16, 62, 0.98, 0.53, "keys", 0.02),
            (0.34, 65, 0.98, 0.46, "keys", 0.0),
            (0.34, 58, 0.90, 0.085, "keys", 0.0),
        ], softness=1.72, brightness=0.5, decay=0.93, space=0.35),
    ]
    for item in variants:
        item["source"] = "v3/fairy-03-short.wav" if item["family"] == "Fairy" else "v3/warm-keys-01-velvet.wav"
        item["selected_family"] = "Short" if item["family"] == "Fairy" else "Velvet"
    (OUTPUT / "manifest.json").write_text(json.dumps(variants, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"created": len(variants), "path": str(OUTPUT), "variants": variants}, ensure_ascii=True))


if __name__ == "__main__":
    main()
