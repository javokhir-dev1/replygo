#!/usr/bin/env python3
"""
Video/audio → matn (faster-whisper, lokal, internetga hech narsa ketmaydi).

Foydalanish:  transcribe.py <fayl> [model]
Natija (stdout, JSON): {"language": "uz", "probability": 0.93, "duration": 41.2,
                        "text": "...", "segments": [{"start": 0.0, "end": 3.1, "text": "..."}]}

Backend (ai/media-prep) chaqiradi. Model birinchi marta ~/.cache/huggingface ga yuklanadi.
"""
import json, os, sys

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "fayl ko'rsatilmagan"})); sys.exit(2)
    path = sys.argv[1]
    model_name = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("WHISPER_MODEL", "large-v3-turbo")

    # Audioni ffmpeg o'qiydi (16 kHz, mono, float32) — faster-whisper'ning PyAV
    # orqali o'qishi yangi PyAV versiyalari bilan mos kelmaydi, ffmpeg esa
    # har qanday formatni ishonchli o'qiydi.
    import subprocess
    import numpy as np
    raw = subprocess.run(
        ["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
        check=True, capture_output=True,
    ).stdout
    audio = np.frombuffer(raw, dtype=np.float32)
    if audio.size == 0:
        print(json.dumps({"language": None, "probability": 0, "duration": 0, "text": "", "segments": []}))
        return

    from faster_whisper import WhisperModel
    # GPU yo'q — int8 CPU'da eng tez va xotirani tejaydi
    model = WhisperModel(model_name, device="cpu", compute_type="int8",
                         cpu_threads=int(os.environ.get("WHISPER_THREADS", "8")))

    # Til: WHISPER_LANGUAGE (standart "uz"). Avtomatik aniqlash o'zbek nutqini
    # deyarli tanimaydi (sinovda arab/ingliz deb adashtirdi va ma'nosiz matn
    # chiqardi), shuning uchun til aniq beriladi. "auto" — WHISPER_LANGS
    # ro'yxatidan eng ehtimollisini tanlaydi.
    language = os.environ.get("WHISPER_LANGUAGE", "uz").strip() or "uz"
    lang_prob = 1.0
    if language == "auto":
        allowed = [l.strip() for l in os.environ.get("WHISPER_LANGS", "uz,ru,en").split(",") if l.strip()]
        _, _, probs = model.detect_language(audio, vad_filter=True, language_detection_segments=3)
        scored = [(lang, p) for lang, p in probs if lang in allowed]
        language, lang_prob = max(scored, key=lambda x: x[1]) if scored else (allowed[0], 0.0)

    # condition_on_previous_text=False — "2.2.2.2…" kabi takrorlanish halqalarini to'xtatadi
    segments, info = model.transcribe(audio, language=language, vad_filter=True, beam_size=5,
                                      condition_on_previous_text=False, repetition_penalty=1.1)
    segs = [{"start": round(s.start, 1), "end": round(s.end, 1), "text": s.text.strip()} for s in segments]
    print(json.dumps({
        "language": language,
        "probability": round(lang_prob, 2),
        "duration": round(info.duration, 1),
        "text": " ".join(s["text"] for s in segs).strip(),
        "segments": segs,
    }, ensure_ascii=False))

if __name__ == "__main__":
    main()
