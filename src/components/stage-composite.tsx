"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import BAverageBadge from "@/components/BAverageBadge";
import { StoryPlayer } from "@/components/story-player";
import type { StoryItem } from "@/lib/story-data";

function useMobileOrientationState() {
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const coarseMedia = window.matchMedia("(pointer: coarse)");
    const landscapeMedia = window.matchMedia("(orientation: landscape)");
    const narrowMedia = window.matchMedia("(max-width: 899px)");

    const check = () => {
      const nextIsMobile = coarseMedia.matches && narrowMedia.matches;
      const nextIsLandscape = nextIsMobile && landscapeMedia.matches;
      setIsMobile(nextIsMobile);
      setIsMobileLandscape(nextIsLandscape);
      setIsReady(true);
    };

    check();
    coarseMedia.addEventListener?.("change", check);
    landscapeMedia.addEventListener?.("change", check);
    narrowMedia.addEventListener?.("change", check);
    window.addEventListener("orientationchange", check);

    return () => {
      coarseMedia.removeEventListener?.("change", check);
      landscapeMedia.removeEventListener?.("change", check);
      narrowMedia.removeEventListener?.("change", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  return { isMobile, isMobileLandscape, isReady };
}

function RotateAnimationCircle({ sizeClass = "h-28 w-28 sm:h-32 sm:w-32" }: { sizeClass?: string }) {
  return (
    <div className={`flex ${sizeClass} items-center justify-center overflow-hidden rounded-full border border-[#d7d0bc]/45 bg-black/35 backdrop-blur-sm`}>
      <video
        className="h-full w-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        poster="/mobile-rotate-poster.jpg"
        aria-hidden="true"
      >
        <source src="/mobile-rotate-loop.webm" type="video/webm" />
        <source src="/mobile-rotate-loop.mp4" type="video/mp4" />
      </video>
    </div>
  );
}

function AudioButton({ muted, onToggle }: { muted: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label={muted ? "Turn sound on" : "Turn sound off"}
      onClick={onToggle}
      className="fixed right-3 top-3 z-[999] flex h-[39px] w-[39px] items-center justify-center rounded-full border-2 border-white/35 bg-black/75 text-white shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-md transition hover:bg-black/85 sm:right-5 sm:top-5 sm:h-16 sm:w-16"
      title={muted ? "Turn sound on" : "Turn sound off"}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[28px] w-[28px] sm:h-8 sm:w-8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 5 8.5 9H5a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3.5L14 19V5Z" fill="currentColor" stroke="none" />
        {muted ? (
          <>
            <path d="M17 9l4 4" />
            <path d="M21 9l-4 4" />
          </>
        ) : (
          <>
            <path d="M17.5 8.5a5 5 0 0 1 0 7" />
            <path d="M19.75 6a8.5 8.5 0 0 1 0 12" />
          </>
        )}
      </svg>
    </button>
  );
}

function LandscapeRotateGate() {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center overflow-hidden bg-black" aria-label="Rotate phone to continue">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_58%)]" />
      <div className="absolute inset-0 opacity-15 mix-blend-screen [background-image:linear-gradient(to_bottom,rgba(255,255,255,0.08)_0,rgba(255,255,255,0.02)_1px,transparent_1px,transparent_6px)] [background-size:100%_6px]" />
      <div className="relative z-10 flex max-w-[80%] flex-col items-center gap-5 text-center text-[#d7d0bc]">
        <RotateAnimationCircle />
        <div className="text-[11px] uppercase tracking-[0.32em]">
          HUMAN DETECTED.
          <br />
          ROTATE DEVICE TO CONTINUE.
        </div>
      </div>
    </div>
  );
}

function MobilePortraitIntro({ onDone }: { onDone: () => void }) {
  return (
    <div className="fixed inset-0 z-[250] bg-black">
      <video
        className="h-full w-full object-cover"
        autoPlay
        playsInline
        muted
        preload="auto"
        poster="/mobile-intro-poster.jpg"
        onEnded={onDone}
      >
        <source src="/mobile-intro.mp4" type="video/mp4" />
      </video>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="animate-pulse text-[clamp(1.2rem,4vw,2rem)] font-semibold uppercase tracking-[0.28em] text-[#4cff72] drop-shadow-[0_0_18px_rgba(76,255,114,0.45)]">
          LOADING...
        </div>
      </div>
    </div>
  );
}

function FooterBadge() {
  return (
    <div className="fixed bottom-5 left-1/2 z-[999] -translate-x-1/2">
      <BAverageBadge variant="white" />
    </div>
  );
}

export function StageComposite({ stories }: { stories: StoryItem[] }) {
  const [muted, setMuted] = useState(true);
  const [showMobileIntro, setShowMobileIntro] = useState(true);
  const [canPlayStories, setCanPlayStories] = useState(false);
  const { isMobile, isMobileLandscape, isReady } = useMobileOrientationState();
  const toggleAudio = () => window.dispatchEvent(new Event("duncan-tv-toggle-audio"));

  useEffect(() => {
    const handleToggle = () => setMuted((value) => !value);
    window.addEventListener("duncan-tv-toggle-audio", handleToggle as EventListener);
    return () => window.removeEventListener("duncan-tv-toggle-audio", handleToggle as EventListener);
  }, []);

  useEffect(() => {
    if (!isMobile || isMobileLandscape) {
      setShowMobileIntro(true);
      setCanPlayStories(false);
    }
  }, [isMobile, isMobileLandscape]);

  useEffect(() => {
    if (!isReady || isMobileLandscape) {
      setCanPlayStories(false);
      return;
    }

    if (isMobile) {
      if (showMobileIntro) {
        setCanPlayStories(false);
        return;
      }

      const timeout = window.setTimeout(() => {
        setCanPlayStories(true);
      }, 100);

      return () => window.clearTimeout(timeout);
    }

    const timeout = window.setTimeout(() => {
      setCanPlayStories(true);
    }, 1700);

    return () => window.clearTimeout(timeout);
  }, [isReady, isMobile, isMobileLandscape, showMobileIntro]);

  if (!isReady) {
    return <div className="fixed inset-0 bg-black" />;
  }

  if (isMobileLandscape) {
    return <LandscapeRotateGate />;
  }

  return (
    <>
      {!isMobile ? (
        <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-black animate-[preloaderFade_0.9s_ease_1.2s_forwards]">
          <div className="relative z-10 flex flex-col items-center gap-5 text-center text-[#d7d0bc]">
            <RotateAnimationCircle sizeClass="h-24 w-24 sm:h-28 sm:w-28" />
            <div className="text-[clamp(1rem,2.2vw,1.5rem)] font-normal uppercase tracking-[0.28em] text-[#c7c7c7]">
              LOADING
            </div>
          </div>
        </div>
      ) : null}

      {isMobile && showMobileIntro ? <MobilePortraitIntro onDone={() => setShowMobileIntro(false)} /> : null}

      <div className={`animate-[stageReveal_0.5s_ease_1.2s_forwards] ${isMobile && showMobileIntro ? "opacity-0" : "opacity-100"}`}>
        <AudioButton muted={muted} onToggle={toggleAudio} />
        <FooterBadge />

        <div className="relative h-[100dvh] max-h-[100dvh] w-screen overflow-hidden bg-black">
          <div className={`absolute left-1/2 top-1/2 h-[max(56.14vw,100vh)] w-[max(100vw,178.12vh)] -translate-x-1/2 -translate-y-1/2 overflow-hidden bg-black ${isMobile ? "scale-[1.2] -translate-y-[calc(50%+60px)]" : "scale-100"}`}>
            <div className="absolute left-[calc(39.33625%+18px)] top-[calc(16.6%+60px-40px)] z-0 w-[18.792%] rotate-[0deg] transform-gpu">
              <div className="relative aspect-[9/16] overflow-hidden bg-black">
                <StoryPlayer stories={stories} className="h-full w-full" canPlay={canPlayStories} />
              </div>
            </div>

            <Image
              src={isMobile ? "/duncan-bg-mobile-4.webp" : "/duncan-tv-bg-998.webp"}
              alt="Duncan TV illustrated stage"
              fill
              className="pointer-events-none z-20 object-contain object-center"
              priority
              unoptimized
            />

            <div className="pointer-events-none absolute inset-y-0 left-0 z-30 w-[18vw] bg-gradient-to-r from-black via-black/72 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-30 w-[18vw] bg-gradient-to-l from-black via-black/72 to-transparent" />
          </div>
        </div>
      </div>
    </>
  );
}
