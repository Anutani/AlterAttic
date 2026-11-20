"""Placeholder 120 BPM track for the Molar reel (timing only, not the real song).

Beats every 0.5 s, accents on downbeats (every 2 s), riser 12.0-13.5 s, silence
13.5-14.0 s, louder "drop" 14-26 s, stabs at 26.0/26.5/27.0 s, final hit at 28.0 s.
Run: python make_placeholder.py  ->  placeholder_120bpm.wav
"""
import wave
import numpy as np

SR = 44100
DUR = 30.0
n = int(SR * DUR)
y = np.zeros(n)


def add(sig, t):
    i = int(t * SR)
    j = min(n, i + len(sig))
    y[i:j] += sig[: j - i]


def env(length, decay):
    t = np.arange(int(SR * length)) / SR
    return t, np.exp(-t * decay)


def kick(gain=0.9, length=0.35, f0=110, f1=45):
    t, e = env(length, 9)
    f = f1 + (f0 - f1) * np.exp(-t * 25)
    return gain * np.sin(2 * np.pi * np.cumsum(f) / SR) * e


def noise(length, gain, decay, seed=1):
    t, e = env(length, decay)
    return gain * np.random.default_rng(seed).standard_normal(len(t)) * e


def tone(freq, length, gain, decay):
    t, e = env(length, decay)
    return gain * np.sin(2 * np.pi * freq * t) * e


def mix(*sigs):
    out = np.zeros(max(len(s) for s in sigs))
    for s in sigs:
        out[: len(s)] += s
    return out


for i in range(60):
    t = i * 0.5
    if 13.5 <= t < 14.0 or t >= 28.0:
        continue
    drop = 14.0 <= t < 26.0
    if 26.0 <= t < 28.0:
        if t in (26.0, 26.5, 27.0):
            add(mix(kick(1.0, 0.4), noise(0.15, 0.4, 30)), t)
        continue
    add(kick(0.95 if drop else 0.6), t)
    if i % 4 == 0:
        add(mix(noise(0.12, 0.35 if drop else 0.2, 40), tone(880, 0.1, 0.15, 30)), t)
    add(noise(0.04, 0.08 if drop else 0.05, 120), t + 0.25)
    if drop and i % 2 == 1:
        add(tone(55, 0.45, 0.35, 4), t)

L = int(1.5 * SR)
tt = np.arange(L) / SR
add(np.random.default_rng(2).standard_normal(L) * (tt / 1.5) ** 2 * 0.25, 12.0)
for k in range(12):
    add(noise(0.05, 0.1 + 0.02 * k, 60, seed=k + 3), 12.0 + k * 0.125)
add(mix(kick(1.0, 1.0, 90, 35), noise(0.4, 0.5, 10), tone(43.65, 1.2, 0.4, 3)), 28.0)
y[int(13.5 * SR) : int(14.0 * SR)] = 0
y[int(29.4 * SR) :] = 0
y /= max(1e-9, np.abs(y).max()) / 0.89

w = wave.open("placeholder_120bpm.wav", "wb")
w.setnchannels(1)
w.setsampwidth(2)
w.setframerate(SR)
w.writeframes((y * 32767).astype("<i2").tobytes())
w.close()
