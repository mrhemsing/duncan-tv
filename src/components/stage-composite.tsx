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
        <div className="pointer-events-none fixed left-1/2 top-[25px] z-50 -translate-x-1/2 text-center">
          <div
            style={{ fontFamily: "var(--font-barrio), cursive" }}
            className="text-[clamp(2rem,5vw,4.6rem)] leading-none tracking-[0.04em] text-[#7dff4d] drop-shadow-[0_2px_0_rgba(16,56,12,0.55)]"
          >
            DUNCAN TV
          </div>
        </div>

        <div className="relative h-screen w-screen overflow-hidden bg-black">
          <div className="absolute left-1/2 top-1/2 h-[max(56.14vw,100vh)] w-[max(100vw,178.12vh)] -translate-x-1/2 -translate-y-1/2 overflow-hidden bg-black">
            <div className="absolute left-[calc(39.33625%-10px)] top-[calc(16.6%+60px-80px)] z-0 w-[18.4275%] rotate-[-0.8deg] transform-gpu">
              <div className="relative aspect-[9/16] overflow-hidden bg-black">
                <StoryPlayer stories={stories} className="h-full w-full" />
              </div>
            </div>

            <button
              type="button"
              aria-label="Previous media"
              onClick={emit("duncan-tv-prev-media")}
              className="absolute left-[60.55%] top-[calc(47.15%-80px)] z-40 flex h-[7.2%] w-[4.8%] items-center justify-center rounded-full border border-[#ff9d45]/80 bg-[#ff9d45]/16 shadow-[0_0_14px_rgba(255,157,69,0.35)]"
              title="Previous"
            >
              <span className="text-xs font-bold text-[#ffb56b]">◀</span>
            </button>

            <button
              type="button"
              aria-label="Next media"
              onClick={emit("duncan-tv-next-media")}
              className="absolute left-[60.55%] top-[calc(56.0%-80px)] z-40 flex h-[7.2%] w-[4.8%] items-center justify-center rounded-full border border-[#ff9d45]/80 bg-[#ff9d45]/16 shadow-[0_0_14px_rgba(255,157,69,0.35)]"
              title="Next"
            >
              <span className="text-xs font-bold text-[#ffb56b]">▶</span>
            </button>

            <button
              type="button"
              aria-label="Toggle TV audio"
              onClick={emit("duncan-tv-toggle-audio")}
              className="absolute left-[61.45%] top-[calc(65.05%-80px)] z-40 flex h-[4.2%] w-[2.8%] items-center justify-center rounded-full border border-[#7dff4d]/80 bg-[#7dff4d]/18 shadow-[0_0_14px_rgba(125,255,77,0.45)]"
              title="Toggle audio"
            >
              <span className="h-[34%] w-[34%] rounded-full bg-[#7dff4d]/90" />
            </button>

            <Image
              src="/background.png"
              alt="Duncan TV illustrated stage"
              fill
              className="pointer-events-none z-20 object-fill"
              priority
              unoptimized
            />
          </div>
        </div>
      </div>
    </>
  );
}
