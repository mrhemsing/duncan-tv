"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastStoryIdsRef = useRef<string>("");
  const activeStory = stories[activeIndex];

  const clampIndex = useCallback(
    (index: number) => {
      if (!stories.length) return 0;
      return ((index % stories.length) + stories.length) % stories.length;
    },
    [stories.length],
  );

  const goToIndex = useCallback(
    (index: number) => {
      setActiveIndex(clampIndex(index));
    },
    [clampIndex],
  );

  const nextMedia = useCallback(() => {
    setActiveIndex((current) => clampIndex(current + 1));
  }, [clampIndex]);

  const prevMedia = useCallback(() => {
    setActiveIndex((current) => clampIndex(current - 1));
  }, [clampIndex]);

  useEffect(() => {
    const storyIds = stories.map((story) => story.id).join("|");
    if (storyIds !== lastStoryIdsRef.current) {
      lastStoryIdsRef.current = storyIds;
      setActiveIndex(0);
    }
  }, [stories]);

  useEffect(() => {
    const toggleAudio = () => setMuted((value) => !value);

    window.addEventListener("duncan-tv-toggle-audio", toggleAudio as EventListener);
    window.addEventListener("duncan-tv-prev-media", prevMedia as EventListener);
    window.addEventListener("duncan-tv-next-media", nextMedia as EventListener);

    return () => {
      window.removeEventListener("duncan-tv-toggle-audio", toggleAudio as EventListener);
      window.removeEventListener("duncan-tv-prev-media", prevMedia as EventListener);
      window.removeEventListener("duncan-tv-next-media", nextMedia as EventListener);
    };
  }, [nextMedia, prevMedia]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = muted;
    video.defaultMuted = muted;

    if (!muted) {
      video.play().catch(() => null);
    }
  }, [muted, activeStory?.id]);

  useEffect(() => {
    if (!stories.length || !activeStory || activeStory.assetType === "video") return;

    const timeout = window.setTimeout(() => {
      nextMedia();
    }, activeStory.durationSeconds * 1000);

    return () => window.clearTimeout(timeout);
  }, [activeStory, stories.length, nextMedia]);

  const progressItems = useMemo(
    () =>
      stories.map((story, index) => ({
        id: story.id,
        active: index === activeIndex,
        complete: index < activeIndex,
      })),
    [activeIndex, stories],
  );

  if (!activeStory) {
    return (
      <div className={`flex items-center justify-center bg-black text-xs uppercase tracking-[0.24em] text-white/60 ${className}`}>
        Awaiting archive
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-black ${className}`}>
      <button
        type="button"
        onClick={() => setMuted((value) => !value)}
        className="absolute right-[5%] top-[7%] z-30 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white/90 backdrop-blur-sm transition hover:bg-black/60 sm:h-10 sm:w-10"
        aria-label={muted ? "Turn sound on" : "Turn sound off"}
        title={muted ? "Turn sound on" : "Turn sound off"}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 sm:h-5 sm:w-5" fill="currentColor">
          <path d="M3 10v4h4l5 4V6L7 10H3z" />
          {muted ? (
            <path d="M18.3 8.3 16.89 6.89 14.8 8.98l-2.09-2.09-1.41 1.41 2.09 2.09-2.09 2.09 1.41 1.41 2.09-2.09 2.09 2.09 1.41-1.41-2.09-2.09 2.09-2.09z" />
          ) : (
            <>
              <path d="M16.5 12a4.5 4.5 0 0 0-2.2-3.86v7.72A4.5 4.5 0 0 0 16.5 12z" />
              <path d="M14.3 3.23v2.06a7.5 7.5 0 0 1 0 13.42v2.06a9.5 9.5 0 0 0 0-17.54z" />
            </>
          )}
        </svg>
      </button>

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
            onClick={nextMedia}
            className="relative h-full w-full cursor-pointer"
            aria-label="Skip to next story"
          >
            <video
              ref={videoRef}
              src={activeStory.src}
              className="h-[90%] w-[90%] max-w-none object-cover"
              autoPlay
              muted={muted}
              playsInline
              preload="auto"
              onEnded={nextMedia}
            />
          </button>
        ) : (
          <button type="button" onClick={nextMedia} className="relative h-full w-full cursor-pointer" aria-label="Skip to next story">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={activeStory.src} alt={activeStory.title} className="h-[90%] w-[90%] max-w-none object-cover" />
          </button>
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_45%,_rgba(0,0,0,0.18)_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 mix-blend-screen [background-image:linear-gradient(to_bottom,rgba(255,255,255,0.06)_0,rgba(255,255,255,0.02)_1px,transparent_1px,transparent_6px)] [background-size:100%_6px]" />

      <div className="pointer-events-none absolute bottom-[6%] left-[6%] right-[6%] z-20 flex items-center justify-between text-[9px] uppercase tracking-[0.22em] text-white/65 sm:text-[10px]">
        <span>{activeStory.sourceLabel}</span>
        <span>
          {activeStory.assetType}
          {activeStory.assetType === "video" ? (muted ? " · muted" : " · audio on") : ""}
        </span>
      </div>
    </div>
  );
}
