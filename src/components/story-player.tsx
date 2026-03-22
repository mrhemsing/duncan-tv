"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { StoryItem } from "@/lib/story-data";

export function StoryPlayer({
  stories,
  className = "",
}: {
  stories: StoryItem[];
  className?: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const activeStory = stories[activeIndex];

  useEffect(() => {
    setActiveIndex(0);
  }, [stories.length]);

  useEffect(() => {
    setPaused(false);
  }, [activeIndex]);

  useEffect(() => {
    const toggleAudio = () => setMuted((value) => !value);
    const prevMedia = () => setActiveIndex((value) => (value - 1 + stories.length) % stories.length);
    const nextMedia = () => setActiveIndex((value) => (value + 1) % stories.length);

    window.addEventListener("duncan-tv-toggle-audio", toggleAudio as EventListener);
    window.addEventListener("duncan-tv-prev-media", prevMedia as EventListener);
    window.addEventListener("duncan-tv-next-media", nextMedia as EventListener);

    return () => {
      window.removeEventListener("duncan-tv-toggle-audio", toggleAudio as EventListener);
      window.removeEventListener("duncan-tv-prev-media", prevMedia as EventListener);
      window.removeEventListener("duncan-tv-next-media", nextMedia as EventListener);
    };
  }, [stories.length]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
      if (!muted) {
        videoRef.current.play().catch(() => null);
      }
    }
  }, [muted, activeIndex]);

  useEffect(() => {
    if (!videoRef.current || activeStory?.assetType !== "video") return;

    if (paused) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => null);
    }
  }, [paused, activeStory]);

  useEffect(() => {
    if (!stories.length || !activeStory || activeStory.assetType === "video" || paused) return;

    const timeout = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % stories.length);
    }, activeStory.durationSeconds * 1000);

    return () => window.clearTimeout(timeout);
  }, [activeStory, stories.length, paused]);

  const progressItems = useMemo(
    () =>
      stories.map((story, index) => ({
        id: story.id,
        active: index === activeIndex,
        complete: index < activeIndex,
      })),
    [activeIndex, stories],
  );

  const togglePlayback = () => {
    if (activeStory?.assetType !== "video") return;
    setPaused((value) => !value);
  };

  if (!activeStory) {
    return (
      <div className={`flex items-center justify-center bg-black text-xs uppercase tracking-[0.24em] text-white/60 ${className}`}>
        Awaiting archive
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-black ${className}`}>
      <div className="absolute inset-x-[5%] top-[5%] z-20 flex gap-1.5 opacity-85">
        {progressItems.map((item) => (
          <div key={item.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/12">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                item.complete ? "w-full bg-white/95" : item.active ? "w-2/3 bg-white/85" : "w-0 bg-transparent"
              }`}
            />
          </div>
        ))}
      </div>

      <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-black">
        {activeStory.assetType === "video" ? (
          <button
            type="button"
            onClick={togglePlayback}
            className="relative h-full w-full cursor-pointer"
            aria-label={paused ? "Play video" : "Pause video"}
          >
            <video
              key={activeStory.id}
              ref={videoRef}
              src={activeStory.src}
              className="h-[130%] w-[130%] max-w-none object-cover"
              autoPlay
              muted={muted}
              playsInline
              preload="auto"
              onEnded={() => setActiveIndex((current) => (current + 1) % stories.length)}
            />

            <div
              className={`pointer-events-none absolute left-1/2 top-1/2 z-30 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white/90 backdrop-blur-sm transition-all duration-200 sm:h-16 sm:w-16 ${
                paused ? "opacity-100 scale-100" : "opacity-0 scale-90"
              }`}
            >
              <span className="text-xl sm:text-2xl">▶</span>
            </div>
          </button>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={activeStory.src} alt={activeStory.title} className="h-[130%] w-[130%] max-w-none object-cover" />
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_45%,_rgba(0,0,0,0.18)_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 mix-blend-screen [background-image:linear-gradient(to_bottom,rgba(255,255,255,0.06)_0,rgba(255,255,255,0.02)_1px,transparent_1px,transparent_6px)] [background-size:100%_6px]" />

      <div className="pointer-events-none absolute bottom-[6%] left-[6%] right-[6%] z-20 flex items-center justify-between text-[9px] uppercase tracking-[0.22em] text-white/65 sm:text-[10px]">
        <span>{activeStory.sourceLabel}</span>
        <span>{activeStory.assetType}{activeStory.assetType === "video" ? muted ? " · muted" : " · audio on" : ""}</span>
      </div>
    </div>
  );
}
