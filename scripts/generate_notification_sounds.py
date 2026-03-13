import math
import os
import struct
import wave
import random

SAMPLE_RATE = 44100


def _tone(freq, duration, volume=0.3):
    n = int(SAMPLE_RATE * duration)
    return [volume * math.sin(2.0 * math.pi * freq * (i / SAMPLE_RATE)) for i in range(n)]


def _silence(duration):
    return [0.0] * int(SAMPLE_RATE * duration)


def _fade(samples, fade_in=0.01, fade_out=0.02):
    n = len(samples)
    in_n = min(n, int(SAMPLE_RATE * fade_in))
    out_n = min(n, int(SAMPLE_RATE * fade_out))
    out = samples[:]
    for i in range(in_n):
        out[i] *= i / max(1, in_n)
    for i in range(out_n):
        out[n - 1 - i] *= i / max(1, out_n)
    return out


def _mix(*tracks):
    length = max(len(t) for t in tracks)
    result = [0.0] * length
    for t in tracks:
        for i in range(len(t)):
            result[i] += t[i]
    peak = max(abs(s) for s in result) or 1.0
    if peak > 0.95:
        result = [s / peak * 0.9 for s in result]
    return result


def _delay(samples, delay_sec, decay=0.3):
    delay_n = int(SAMPLE_RATE * delay_sec)
    out = samples[:]
    out.extend([0.0] * delay_n)
    for i in range(len(samples)):
        out[i + delay_n] += samples[i] * decay
    return out


def _envelope_exp(samples, attack=0.005, decay_time=0.3):
    n = len(samples)
    atk_n = min(n, int(SAMPLE_RATE * attack))
    out = samples[:]
    for i in range(n):
        if i < atk_n:
            env = i / max(1, atk_n)
        else:
            t = (i - atk_n) / SAMPLE_RATE
            env = math.exp(-t / decay_time)
        out[i] *= env
    return out


def _rich_chime(freq, duration, volume=0.25):
    n = int(SAMPLE_RATE * duration)
    samples = [0.0] * n
    harmonics = [
        (1.0, volume),
        (2.0, volume * 0.35),
        (3.0, volume * 0.15),
        (4.0, volume * 0.08),
    ]
    for mult, vol in harmonics:
        for i in range(n):
            samples[i] += vol * math.sin(2.0 * math.pi * freq * mult * (i / SAMPLE_RATE))
    return samples


def _metallic_hit(freq, duration, volume=0.3):
    n = int(SAMPLE_RATE * duration)
    samples = [0.0] * n
    partials = [
        (1.0, volume),
        (2.756, volume * 0.5),
        (4.09, volume * 0.25),
        (5.41, volume * 0.18),
        (6.12, volume * 0.12),
    ]
    for mult, vol in partials:
        for i in range(n):
            samples[i] += vol * math.sin(2.0 * math.pi * freq * mult * (i / SAMPLE_RATE))
    return samples


def _noise_burst(duration, volume=0.08):
    random.seed(42)
    n = int(SAMPLE_RATE * duration)
    return [volume * (random.random() * 2 - 1) for _ in range(n)]


def _write_wav(path, samples):
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
    """Rich two-note chime with harmonics and echo."""
    note1 = _envelope_exp(_rich_chime(1046.5, 0.20, 0.28), attack=0.005, decay_time=0.15)
    note2 = _envelope_exp(_rich_chime(1318.5, 0.30, 0.32), attack=0.005, decay_time=0.25)

    track = note1 + _silence(0.04) + note2

    echoed = _delay(track, 0.08, 0.2)
    echoed2 = _delay(track, 0.16, 0.1)

    return _fade(_mix(echoed, echoed2), fade_in=0.003, fade_out=0.05)


def make_order_sound():
    """Coin / cash register sound with metallic shimmer."""
    # Initial metallic coin hit
    hit1 = _envelope_exp(_metallic_hit(2200, 0.12, 0.30), attack=0.002, decay_time=0.08)
    # Higher coin ring
    hit2 = _envelope_exp(_metallic_hit(3300, 0.10, 0.25), attack=0.002, decay_time=0.06)
    # Noise for "cash" texture
    noise = _envelope_exp(_noise_burst(0.03, 0.12), attack=0.001, decay_time=0.02)

    # Rising shimmer tail
    shimmer1 = _envelope_exp(_rich_chime(1568, 0.25, 0.22), attack=0.005, decay_time=0.20)
    shimmer2 = _envelope_exp(_rich_chime(2093, 0.30, 0.18), attack=0.005, decay_time=0.25)

    # Build the sequence
    coin_part = _mix(hit1, hit2, noise)
    coin_part = coin_part + _silence(0.02)

    shimmer_part = _mix(shimmer1, shimmer2)
    shimmer_with_echo = _delay(shimmer_part, 0.06, 0.25)

    full = coin_part + shimmer_with_echo

    return _fade(full, fade_in=0.001, fade_out=0.08)


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
