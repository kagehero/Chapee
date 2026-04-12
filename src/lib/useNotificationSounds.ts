"use client";

import { useCallback, useEffect, useRef } from "react";
import { getNotificationSoundsEnabled } from "@/lib/notification-sound-settings";

/**
 * 通知音（Web Audio API のソフトなサイン波。甲高い WAV を廃止）
 * - メッセージ: やや低めの短いチャイム
 * - 注文系: 別の低めの音程で区別
 */
function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  return new Ctx();
}

function playTone(
  ctx: AudioContext,
  frequencyHz: number,
  durationSec: number,
  peakGain: number
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(frequencyHz, ctx.currentTime);

  const t0 = ctx.currentTime;
  const attack = 0.02;
  const release = Math.max(0.04, durationSec * 0.35);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peakGain, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(
    0.0008,
    t0 + durationSec - release
  );
  gain.gain.linearRampToValueAtTime(0, t0 + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + durationSec + 0.02);
}

export function useNotificationSounds() {
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    ctxRef.current = getAudioContext();
    return () => {
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, []);

  const playMessageSound = useCallback(() => {
    if (!getNotificationSoundsEnabled()) return;
    const ctx = ctxRef.current ?? getAudioContext();
    if (!ctx) return;
    ctxRef.current = ctx;
    try {
      void ctx.resume();
      // 約 F4 — 落ち着いた短いチャイム
      playTone(ctx, 349.23, 0.14, 0.11);
    } catch {
      /* ignore */
    }
  }, []);

  const playOrderSound = useCallback(() => {
    if (!getNotificationSoundsEnabled()) return;
    const ctx = ctxRef.current ?? getAudioContext();
    if (!ctx) return;
    ctxRef.current = ctx;
    try {
      void ctx.resume();
      // 約 C4 — メッセージより低く、短く
      playTone(ctx, 261.63, 0.16, 0.1);
    } catch {
      /* ignore */
    }
  }, []);

  return {
    playMessageSound,
    playOrderSound,
  };
}
