"""Hakyol Instagram fon müzikleri: özgün, telifsiz, ney benzeri sentez + dem (drone) + yankı.

    python3 instagram/music/synth.py        # numpy gerekir; instagram/music/*.m4a üretir

Telifli müzik Instagram'da sessize alınır ya da gönderiyi düşürür; bu yüzden müzik burada
üretilir. Makam dizileri 12-TET yaklaşımı (Rast'ta segâh çeyrek ses pesleştirilir).
Üretilen dosyalar repoya girer; workflow yalnız ffmpeg ile karıştırır, numpy gerekmez.
"""
import subprocess
import wave
from pathlib import Path

import numpy as np

SR = 44100
HERE = Path(__file__).resolve().parent

# Yarım ses adımları (karar sesinden), 0.5 = çeyrek ses yaklaşımı.
MAKAM = {
    "hicaz": [0, 1, 4, 5, 7, 8, 10, 12],
    "rast": [0, 2, 3.5, 5, 7, 9, 10.5, 12],
    "ussak": [0, 1.5, 3, 5, 7, 8, 10, 12],
    "segah": [0, 1.5, 3.5, 5, 7, 8.5, 10, 12],
}


def hz(tonic, step):
    return tonic * 2 ** (step / 12)


def env(n, attack, release):
    e = np.ones(n)
    a, r = int(attack * SR), int(release * SR)
    e[:a] = np.linspace(0, 1, a) ** 1.5
    e[-r:] *= np.linspace(1, 0, r) ** 1.5
    return e


def bandnoise(n, center, width, rng):
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    spec *= np.exp(-((f - center) / width) ** 2)
    out = np.fft.irfft(spec, n)
    return out / (np.abs(out).max() + 1e-9)


def ney(freq, dur, rng):
    n = int(dur * SR)
    t = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t) * np.clip((t - 0.6) / 0.8, 0, 1)
    phase = 2 * np.pi * np.cumsum(freq * vib) / SR
    tone = np.sin(phase) + 0.35 * np.sin(2 * phase) + 0.12 * np.sin(3 * phase) + 0.05 * np.sin(4 * phase)
    breath = bandnoise(n, freq * 2, freq * 0.8, rng) * 0.22 + bandnoise(n, 2500, 1500, rng) * 0.05
    swell = 0.85 + 0.15 * np.sin(2 * np.pi * t / max(dur, 1.5))
    return (tone * 0.6 + breath) * swell * env(n, 0.45, min(0.9, dur * 0.4))


def drone(tonic, dur, rng):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for f, a in ((tonic / 2, 0.5), (tonic / 2 * 1.5, 0.25), (tonic, 0.18)):
        for det in (-0.6, 0.6):
            lfo = 0.75 + 0.25 * np.sin(2 * np.pi * t / (11 + det * 3) + rng.uniform(0, 6))
            out += a * lfo * (np.sin(2 * np.pi * (f + det) * t) + 0.2 * np.sin(4 * np.pi * (f + det) * t))
    return out / np.abs(out).max() * env(n, 4, 5)


def reverb(x, secs=3.2, mix=0.35, seed=7):
    rng = np.random.default_rng(seed)
    n = int(secs * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * 3 / secs)
    ir[0] = 1
    size = 1 << int(np.ceil(np.log2(len(x) + n)))
    wet = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)]
    wet /= np.abs(wet).max() + 1e-9
    return (1 - mix) * x / (np.abs(x).max() + 1e-9) + mix * wet


def melody(makam, tonic, dur, rng):
    steps = MAKAM[makam]
    out = np.zeros(int(dur * SR))
    t, idx = 2.5, 0
    while t < dur - 5:
        # Seyir: karar sesi çevresinde gezin, güçlüye (5. derece) çık, karara in.
        idx = int(np.clip(idx + rng.choice([-2, -1, -1, 0, 1, 1, 2]), 0, len(steps) - 1))
        if rng.random() < 0.12:
            idx = 0
        d = rng.choice([1.6, 2.2, 2.8, 3.6, 4.4])
        note = ney(hz(tonic, steps[idx]), d, rng)
        i = int(t * SR)
        out[i : i + len(note)] += note[: len(out) - i]
        t += d * rng.choice([0.85, 1.0, 1.0, 1.25]) + rng.choice([0, 0, 0.6, 1.4])
    return out


def track(name, makam, tonic, dur, seed):
    rng = np.random.default_rng(seed)
    mix = 0.75 * melody(makam, tonic, dur, rng) / 1.0 + 0.55 * drone(tonic, dur, rng)
    mix = reverb(mix)
    fade = env(len(mix), 2.5, 4)
    mix = mix * fade
    mix = mix / np.abs(mix).max() * 0.8
    pcm = (np.repeat(mix[:, None], 2, axis=1) * 32767).astype("<i2")
    wav = HERE / f"{name}.wav"
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(wav), "-c:a", "aac", "-b:a", "128k", str(HERE / f"{name}.m4a")], check=True)
    wav.unlink()


if __name__ == "__main__":
    track("hicaz", "hicaz", 293.66, 75, 11)  # Re karar
    track("rast", "rast", 196.0, 75, 23)  # Sol karar
    track("ussak", "ussak", 220.0, 75, 37)  # La karar
    track("segah", "segah", 246.94, 75, 41)  # Si karar
