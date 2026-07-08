// src/app/page.tsx
// Root redirect — authenticated users go to dashboard, others see landing
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import LandingPage from "@/components/landing/LandingPage"

export default async function RootPage() {
  const session = await auth()
  if (session?.user?.id) redirect("/dashboard")
  return <LandingPage />
}
