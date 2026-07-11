// src/app/(app)/reports/page.tsx
// Report Templates moved to Settings — keep old links working.
import { redirect } from "next/navigation"

export default function ReportsRedirect() {
  redirect("/settings/report-templates")
}
