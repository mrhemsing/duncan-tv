export const dynamic = "force-static";

import Image from "next/image";
import { StageComposite } from "@/components/stage-composite";
import { loadLatestStoryArchive } from "@/lib/story-data";

export default async function Home() {
  const archive = await loadLatestStoryArchive();
  const storyQueue = archive.stories;

  return (
    <main className="min-h-screen overflow-hidden bg-black">
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black">
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-40 px-3 py-3 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
          <div className="flex flex-col gap-1 text-center leading-[1.15] sm:gap-0.5 sm:text-left sm:leading-none">
            <div className="text-[10px] uppercase tracking-[0.28em] text-[#c7c7c7] sm:text-xs">B Average presents...</div>
            <div className="flex justify-center sm:justify-start">
              <Image src="/dtv-logo.jpg" alt="DTV" width={72} height={36} className="h-auto w-[52px] sm:w-[60px]" priority unoptimized />
            </div>
            <div className="text-[14px] font-bold uppercase text-white/85 sm:text-sm">Duncan TV</div>
          </div>
        </div>

        <StageComposite stories={storyQueue} />
      </section>
    </main>
  );
}
