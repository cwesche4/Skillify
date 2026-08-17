export default function BuilderLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="h-full min-h-0 w-full min-w-0 overflow-hidden bg-slate-950">
      {children}
    </div>
  )
}
