import math
import os
import struct
import wave

SAMPLE_RATE = 44100


def _tone(freq: float, duration: float, volume: float = 0.35):
    n = int(SAMPLE_RATE * duration)
    return [
        volume * math.sin(2.0 * math.pi * freq * (i / SAMPLE_RATE))
        for i in range(n)
    ]


def _silence(duration: float):
    n = int(SAMPLE_RATE * duration)
    return [0.0] * n


def _fade(samples, fade_in: float = 0.01, fade_out: float = 0.02):
    n = len(samples)
    in_n = min(n, int(SAMPLE_RATE * fade_in))
    out_n = min(n, int(SAMPLE_RATE * fade_out))
    out = samples[:]
    for i in range(in_n):
        out[i] *= i / max(1, in_n)
    for i in range(out_n):
        idx = n - 1 - i
        out[idx] *= i / max(1, out_n)
    return out


def _write_wav(path: str, samples):
    pcm = bytearray()
    for s in samples:
        s = max(-1.0, min(1.0, s))
        pcm.extend(struct.pack("<h", int(s * 32767)))
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(pcm)


def make_message_sound():
    # "ピロリン": short two-tone chime
    s = []
    s += _fade(_tone(1046.5, 0.10, 0.30))   # C6
    s += _silence(0.03)
    s += _fade(_tone(1318.5, 0.16, 0.34))   # E6
    return s


def make_order_sound():
    # "シャーキーン": rising celebratory shimmer
    s = []
    # quick rising steps
    for f, d, v in [
        (784.0, 0.06, 0.26),   # G5
        (988.0, 0.06, 0.28),   # B5
        (1174.7, 0.07, 0.30),  # D6
        (1568.0, 0.18, 0.34),  # G6
    ]:
        s += _fade(_tone(f, d, v), 0.004, 0.02)
        s += _silence(0.01)
    return s


def main():
    out_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public", "sounds")
    os.makedirs(out_dir, exist_ok=True)

    message_path = os.path.join(out_dir, "message.wav")
    order_path = os.path.join(out_dir, "order.wav")

    _write_wav(message_path, make_message_sound())
    _write_wav(order_path, make_order_sound())

    print(f"Generated: {message_path}")
    print(f"Generated: {order_path}")


if __name__ == "__main__":
    main()

