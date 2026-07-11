// src/app/api/automation/templates/route.ts
// GET /api/automation/templates  — list recipe templates

export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { withWorkspace, ok, ApiContext } from "@/lib/api"
import { RECIPES, RECIPE_CATEGORIES } from "@/lib/automation/recipes"

async function getTemplates(ctx: ApiContext) {
  const url      = new URL(ctx.req.url)
  const category = url.searchParams.get("category") || undefined
  const popular  = url.searchParams.get("popular") === "true"
  const method   = url.searchParams.get("methodology") || undefined

  let recipes = RECIPES
  if (category)  recipes = recipes.filter(r => r.category === category)
  if (popular)   recipes = recipes.filter(r => r.popular)
  if (method)    recipes = recipes.filter(r => !r.methodology || r.methodology === method || r.methodology === "ALL")

  return ok({ recipes, categories: RECIPE_CATEGORIES, total: recipes.length })
}

export async function GET(req: NextRequest) {
  return withWorkspace(req, getTemplates)
}
