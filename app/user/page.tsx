// app/user/page.tsx
import { currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

export default async function UserPage() {
  const user = await currentUser()
  const role = user?.publicMetadata?.role

  // Only allow user, manager, admin
  if (!["user", "manager", "admin"].includes(String(role))) {
    return redirect("/dashboard")
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold">User Dashboard</h1>
      <p className="mt-2 text-zinc-600">Standard user area.</p>
    </div>
  )
}
