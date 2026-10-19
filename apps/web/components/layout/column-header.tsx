/** Header cell shared by every dashboard column so the hairline runs straight across. */
export function ColumnHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-4 border-b px-4">
      {children}
    </div>
  )
}
