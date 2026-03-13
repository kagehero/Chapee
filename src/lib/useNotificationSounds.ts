"use client";

import { useCallback, useEffect, useRef } from "react";
import { getNotificationSoundsEnabled } from "@/lib/notification-sound-settings";

/**
 * Notification sounds for:
 * - New incoming message (ピロリン)
 * - Order related events (シャーキーン)
 *
 * Respects user preference from Settings (notification sound ON/OFF).
 * Currently works with mock data / polling.
 * Later, Shopee webhook or realtime events can call the same handlers.
 */
export function useNotificationSounds() {
  const messageAudioRef = useRef<HTMLAudioElement | null>(null);
  const orderAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    messageAudioRef.current = new Audio("/sounds/message.wav");
    orderAudioRef.current = new Audio("/sounds/order.wav");
  }, []);

  const playMessageSound = useCallback(() => {
    if (!getNotificationSoundsEnabled()) return;
    const audio = messageAudioRef.current;
    if (!audio) return;
    try {
      audio.currentTime = 0;
      void audio.play();
    } catch {
      // ignore play errors (e.g. autoplay restrictions)
    }
  }, []);

  const playOrderSound = useCallback(() => {
    if (!getNotificationSoundsEnabled()) return;
    const audio = orderAudioRef.current;
    if (!audio) return;
    try {
      audio.currentTime = 0;
      void audio.play();
    } catch {
      // ignore play errors (e.g. autoplay restrictions)
    }
  }, []);

  return {
    playMessageSound,
    playOrderSound,
  };
}

