export const dynamic = "force-static";

import { StageComposite } from "@/components/stage-composite";
import { loadLatestStoryArchive } from "@/lib/story-data";

export default async function Home() {
  const archive = await loadLatestStoryArchive();
  const storyQueue = archive.stories;

  return (
    <main className="h-[100dvh] min-h-screen overflow-hidden bg-black">
      <section className="relative flex h-[100dvh] min-h-screen items-center justify-center overflow-hidden bg-black">
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-40 px-3 py-[23px] sm:px-5 sm:py-5 lg:px-6 lg:py-6">
          <div className="flex flex-col gap-1 text-center leading-[1.15] sm:gap-0.5 sm:text-left sm:leading-none">
            <div className="text-[14px] font-bold uppercase text-white/85 sm:text-sm">Duncan TV</div>
          </div>
        </div>

        <StageComposite stories={storyQueue} />
      </section>
    </main>
  );
}
