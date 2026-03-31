export const dynamic = "force-static";

import { StageComposite } from "@/components/stage-composite";
import { loadLatestStoryArchive } from "@/lib/story-data";

export default async function Home() {
  const archive = await loadLatestStoryArchive();
  const storyQueue = archive.stories;

  return (
    <main className="min-h-screen overflow-hidden bg-black">
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black">
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-40 flex items-start justify-between px-3 py-3 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
          <div className="text-[10px] uppercase tracking-[0.28em] text-white/45 sm:text-xs">Duncan TV</div>
        </div>

        <div className="absolute bottom-3 left-3 z-40 sm:bottom-5 sm:left-5 lg:bottom-6 lg:left-6">
          <a
            href="https://b-average.com"
            target="_blank"
            rel="noreferrer"
            className="text-[10px] uppercase tracking-[0.22em] text-[#c7c7c7] transition hover:text-white sm:text-xs"
          >
            B Average
          </a>
        </div>

        <StageComposite stories={storyQueue} />
      </section>
    </main>
  );
}
