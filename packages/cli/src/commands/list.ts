import pc from "picocolors";
import {
  getByCategory,
  getExtensionGroups,
  GROUP_LABELS,
  type ComponentCategory,
  type ExtensionGroup,
} from "../lib/registry.ts";

/** Print a section of components if any exist */
function printSection(category: ComponentCategory, title: string, subtitle?: string): void {
  const items = getByCategory(category);
  if (items.length === 0) return;

  const header = subtitle
    ? pc.bold(pc.cyan(title)) + pc.dim(` (${subtitle})`)
    : pc.bold(pc.cyan(title));
  console.log(header);

  for (const c of items) {
    const suffix = c.remote ? pc.dim(` [${c.remote}]`) : "";
    console.log(`  ${pc.green(c.name.padEnd(38))} ${pc.dim(c.description)}${suffix}`);
  }
  console.log();
}

export function runList(): void {
  console.log();
  console.log(pc.bold("pi-agent-toolkit: available components"));
  console.log();

  // Extensions get special grouped display
  console.log(pc.bold(pc.cyan("Extensions")));
  const groups = getExtensionGroups();

  for (const group of Object.keys(GROUP_LABELS) as ExtensionGroup[]) {
    const components = groups[group];
    if (!components?.length) continue;

    console.log(`  ${pc.dim(GROUP_LABELS[group])}`);
    for (const c of components) {
      console.log(`    ${pc.green(c.name.padEnd(36))} ${pc.dim(c.description)}`);
    }
  }
  console.log();

  // All other categories use the standard section format
  printSection("skills-bundled", "Bundled Skills");
  printSection("skills-external", "External Skills", "installed from source repos");
  printSection("prompts", "Prompts", "custom prompt templates");
  printSection("agents", "Agents", "custom agent definitions");
  printSection("themes", "Themes", "TUI color themes");
  printSection("packages", "Packages", "installed via pi install");
  printSection("configs", "Starter Configs", "copied as templates");
}
