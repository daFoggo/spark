/** 12-column frame for the sign-in / sign-up pages; each page composes its rail and form column. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="grid min-h-svh grid-cols-1 bg-background lg:grid-cols-12">
      {children}
    </div>
  )
}
