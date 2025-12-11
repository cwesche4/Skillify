// app/dashboard/layout.tsx

export const metadata = {
  title: 'Dashboard',
}

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
