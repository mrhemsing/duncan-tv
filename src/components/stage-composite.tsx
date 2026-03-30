"use client";

import Image from "next/image";
import { StoryPlayer } from "@/components/story-player";
import type { StoryItem } from "@/lib/story-data";

export function StageComposite({ stories }: { stories: StoryItem[] }) {
  const emit = (name: string) => () => window.dispatchEvent(new Event(name));

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-black animate-[preloaderFade_0.9s_ease_1.2s_forwards]">
        <div
          style={{ fontFamily: "var(--font-barrio), cursive" }}
          className="text-[clamp(1.6rem,4vw,3.68rem)] leading-none tracking-[0.04em] text-[#8b7c61] drop-shadow-[0_2px_0_rgba(30,24,18,0.35)]"
        >
          LOADING<span className="inline-flex w-[1.6em] justify-start">
            <span className="animate-[loadingDots_1.2s_steps(4,end)_infinite] overflow-hidden whitespace-nowrap">...</span>
          </span>
        </div>
      </div>

      <div className="animate-[stageReveal_0.5s_ease_1.2s_forwards] opacity-0">
        <div className="relative h-screen w-screen overflow-hidden bg-black">
          <div className="absolute left-1/2 top-1/2 h-[max(56.14vw,100vh)] w-[max(100vw,178.12vh)] -translate-x-1/2 -translate-y-1/2 overflow-hidden bg-black">
            <div className="absolute left-[calc(39.33625%+18px)] top-[calc(16.6%+60px-40px)] z-0 w-[15.66%] rotate-[-0.8deg] transform-gpu">
              <div className="relative aspect-[9/16] overflow-hidden bg-black">
                <StoryPlayer stories={stories} className="h-full w-full" />
              </div>
            </div>

            <button
              type="button"
              aria-label="Toggle screen audio"
              onClick={emit("duncan-tv-toggle-audio")}
              className="absolute right-[1.8%] top-[3.2%] z-50 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white/90 backdrop-blur-sm transition hover:bg-black/70"
              title="Toggle sound"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
                <path d="M3 10v4h4l5 4V6L7 10H3z" />
                <path d="M16.5 12a4.5 4.5 0 0 0-2.2-3.86v7.72A4.5 4.5 0 0 0 16.5 12z" />
                <path d="M14.3 3.23v2.06a7.5 7.5 0 0 1 0 13.42v2.06a9.5 9.5 0 0 0 0-17.54z" />
              </svg>
            </button>


            <Image
              src="/duncan-tv-bg-998.webp"
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
