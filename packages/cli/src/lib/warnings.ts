import * as p from "@clack/prompts";
import type { Component } from "./registry.ts";

/** Find missing recommendations for a set of selected components */
export function findMissingRecommendations(selected: Component[]): string[] {
  const selectedNames = new Set(selected.map((c) => c.name));
  const warnings: string[] = [];

  for (const component of selected) {
    if (!component.recommends) continue;
    for (const rec of component.recommends) {
      if (!selectedNames.has(rec)) {
        warnings.push(`${component.name} works best with ${rec}, which you didn't select.`);
      }
    }
  }

  return warnings;
}

/**
 * Check selected components against their `recommends` lists.
 * Returns true if the user wants to proceed, false to go back.
 */
export async function checkRecommendations(selected: Component[]): Promise<boolean> {
  const warnings = findMissingRecommendations(selected);

  if (warnings.length === 0) return true;

  p.log.warn("Some selected components have recommendations:");
  for (const warning of warnings) {
    p.log.message(`  - ${warning}`);
  }

  const proceed = await p.confirm({
    message: "Continue anyway?",
    initialValue: true,
  });

  if (p.isCancel(proceed)) {
    p.cancel("Installation cancelled.");
    process.exit(0);
  }

  return proceed;
}
