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
  const [isVideoReady, setIsVideoReady] = useState(false);
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
      setIsVideoReady(false);
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

    video.play().catch(() => null);
  }, [muted, activeStory?.id]);

  useEffect(() => {
    if (!stories.length || !activeStory || activeStory.assetType === "video") return;

    const timeout = window.setTimeout(() => {
      nextMedia();
    }, activeStory.durationSeconds * 1000);

    return () => window.clearTimeout(timeout);
  }, [activeStory, stories.length, nextMedia]);

  useEffect(() => {
    setIsVideoReady(activeStory?.assetType !== "video");
  }, [activeStory?.id, activeStory?.assetType]);

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

      <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden bg-black">
        <div
          className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-200 ${isVideoReady ? "opacity-0" : "opacity-100"}`}
          style={{ backgroundImage: "url('/please-stand-by.jpg')" }}
          aria-hidden="true"
        />
        {activeStory.assetType === "video" ? (
          activeStory.src.includes(".m3u8") ? (
            <video
              ref={videoRef}
              src={activeStory.src}
              className={`h-full w-full max-w-none object-cover object-center transition-opacity duration-200 ${isVideoReady ? "opacity-100" : "opacity-0"}`}
              autoPlay
              muted={muted}
              playsInline
              preload="auto"
              onCanPlay={() => setIsVideoReady(true)}
              onPlaying={() => setIsVideoReady(true)}
              onEnded={nextMedia}
            />
          ) : (
            <video
              ref={videoRef}
              src={activeStory.src}
              className={`h-full w-full max-w-none object-cover object-center transition-opacity duration-200 ${isVideoReady ? "opacity-100" : "opacity-0"}`}
              autoPlay
              muted={muted}
              playsInline
              preload="auto"
              onCanPlay={() => setIsVideoReady(true)}
              onPlaying={() => setIsVideoReady(true)}
              onEnded={nextMedia}
            />
          )
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={activeStory.src} alt={activeStory.title} className="h-full w-full max-w-none object-cover object-center" />
        )}

        <button
          type="button"
          className="absolute inset-0 z-30 cursor-pointer bg-transparent"
          onClick={nextMedia}
          aria-label="Skip to next story"
          title="Skip to next story"
        />
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_45%,_rgba(0,0,0,0.18)_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 mix-blend-screen [background-image:linear-gradient(to_bottom,rgba(255,255,255,0.06)_0,rgba(255,255,255,0.02)_1px,transparent_1px,transparent_6px)] [background-size:100%_6px]" />

    </div>
  );
}
