// src/app/api/templates/featured/route.ts
// GET /api/templates/featured — get featured/trending templates for homepage

import { NextRequest, NextResponse } from "next/server"
import { SYSTEM_TEMPLATES } from "@/lib/templates/library"

export async function GET(req: NextRequest) {
  const featured = {
    hero:    SYSTEM_TEMPLATES.find(t => t.id === "healthcare-ehr-implementation")!,
    popular: SYSTEM_TEMPLATES.filter(t => t.popular).slice(0, 6),
    premium: SYSTEM_TEMPLATES.filter(t => t.isPremium),
    newest:  SYSTEM_TEMPLATES.slice(-3),
    byMethod: {
      waterfall: SYSTEM_TEMPLATES.filter(t => t.methodology === "WATERFALL"),
      agile:     SYSTEM_TEMPLATES.filter(t => t.methodology === "AGILE"),
      scrum:     SYSTEM_TEMPLATES.filter(t => t.methodology === "SCRUM"),
    },
    stats: {
      total:      SYSTEM_TEMPLATES.length,
      free:       SYSTEM_TEMPLATES.filter(t => !t.isPremium).length,
      premium:    SYSTEM_TEMPLATES.filter(t => t.isPremium).length,
      industries: [...new Set(SYSTEM_TEMPLATES.map(t => t.industry))].length,
    },
  }

  return NextResponse.json({ data: featured })
}
