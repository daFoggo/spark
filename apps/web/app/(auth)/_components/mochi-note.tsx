import { Mochi } from "@/features/pet/components/mochi"

/** Rail footnote under the terminal: the cat and one line about it (same words as the Guide). */
export function MochiNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex max-w-xl items-end gap-5">
      <Mochi name="Mochi" fatness={0.2} mood="happy" stage={1} scale={3} />
      <p className="pb-1 text-ink-2">{children}</p>
    </div>
  )
}
