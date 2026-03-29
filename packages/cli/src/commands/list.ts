import pc from "picocolors";
import {
  getByCategory,
  getExtensionGroups,
  GROUP_LABELS,
  type ExtensionGroup,
} from "../lib/registry.ts";

export function runList(): void {
  console.log();
  console.log(pc.bold("pi-agent-toolkit: available components"));
  console.log();

  // Extensions (grouped)
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

  // Bundled skills
  const bundled = getByCategory("skills-bundled");
  if (bundled.length > 0) {
    console.log(pc.bold(pc.cyan("Bundled Skills")));
    for (const c of bundled) {
      console.log(`  ${pc.green(c.name.padEnd(38))} ${pc.dim(c.description)}`);
    }
    console.log();
  }

  // External skills
  const external = getByCategory("skills-external");
  if (external.length > 0) {
    console.log(pc.bold(pc.cyan("External Skills")) + pc.dim(" (installed from source repos)"));
    for (const c of external) {
      const source = c.remote ? pc.dim(` [${c.remote}]`) : "";
      console.log(`  ${pc.green(c.name.padEnd(38))} ${pc.dim(c.description)}${source}`);
    }
    console.log();
  }

  // Packages
  const pkgs = getByCategory("packages");
  if (pkgs.length > 0) {
    console.log(pc.bold(pc.cyan("Packages")) + pc.dim(" (installed via pi install)"));
    for (const c of pkgs) {
      console.log(`  ${pc.green(c.name.padEnd(38))} ${pc.dim(c.description)}`);
    }
    console.log();
  }

  // Configs
  const configs = getByCategory("configs");
  if (configs.length > 0) {
    console.log(pc.bold(pc.cyan("Starter Configs")) + pc.dim(" (copied as templates)"));
    for (const c of configs) {
      console.log(`  ${pc.green(c.name.padEnd(38))} ${pc.dim(c.description)}`);
    }
    console.log();
  }
}
