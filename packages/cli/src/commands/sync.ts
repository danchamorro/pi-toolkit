import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { resolve } from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { PI_EXTENSIONS_DIR, PI_SKILLS_DIR, AGENTS_SKILLS_DIR } from "../lib/paths.ts";
import { getByCategory } from "../lib/registry.ts";

interface SyncOptions {
  repoPath: string;
  all: boolean;
}

/** Names of external skills (installed via npx skills add, not ours to absorb) */
function getExternalSkillNames(): Set<string> {
  return new Set(getByCategory("skills-external").map((c) => c.name));
}

function isSymlink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

interface FoundItem {
  name: string;
  sourcePath: string;
  targetDir: string;
  category: string;
  isDirectory: boolean;
}

/** Scan a directory for unmanaged entries (not symlinks) */
function findUnmanaged(
  scanDir: string,
  targetDir: string,
  category: string,
  skipNames: Set<string>,
): FoundItem[] {
  if (!existsSync(scanDir)) return [];

  const items: FoundItem[] = [];
  const entries = readdirSync(scanDir);

  for (const entry of entries) {
    const fullPath = resolve(scanDir, entry);

    // Skip symlinks (already managed)
    if (isSymlink(fullPath)) continue;

    // Skip known names
    if (skipNames.has(entry) || skipNames.has(entry.replace(/\.ts$/, ""))) continue;

    // Skip node_modules and hidden dirs
    if (entry === "node_modules" || entry.startsWith(".")) continue;

    let isDir: boolean;
    try {
      isDir = statSync(fullPath).isDirectory();
    } catch {
      continue;
    }

    // For extensions dir: accept .ts files and directories
    // For skills dirs: accept directories only
    if (category === "extensions") {
      if (!isDir && !entry.endsWith(".ts")) continue;
    } else {
      if (!isDir) continue;
    }

    items.push({
      name: entry,
      sourcePath: fullPath,
      targetDir,
      category,
      isDirectory: isDir,
    });
  }

  return items;
}

/** Absorb a single item: copy to repo, remove original, symlink back */
function absorbItem(item: FoundItem): { success: boolean; message: string } {
  const targetPath = resolve(item.targetDir, item.name);

  try {
    // Ensure target directory exists
    mkdirSync(item.targetDir, { recursive: true });

    // Copy to repo
    if (item.isDirectory) {
      cpSync(item.sourcePath, targetPath, { recursive: true });
      rmSync(item.sourcePath, { recursive: true, force: true });
    } else {
      cpSync(item.sourcePath, targetPath);
      unlinkSync(item.sourcePath);
    }

    // Symlink back
    symlinkSync(targetPath, item.sourcePath);

    return { success: true, message: "absorbed and symlinked" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: msg };
  }
}

export async function runSync(options: SyncOptions): Promise<void> {
  p.intro(pc.bold("pi-agent-toolkit sync"));

  const repoPath = resolve(options.repoPath);
  const dotfilesPath = resolve(repoPath, "dotfiles");

  if (!existsSync(dotfilesPath)) {
    p.log.error(`dotfiles/ not found at ${dotfilesPath}`);
    p.log.info("Make sure --repo-path points to your pi-toolkit repo clone.");
    process.exit(1);
  }

  p.log.info(`Repo: ${repoPath}`);
  p.log.info("Scanning for unmanaged extensions and skills...");

  const externalSkills = getExternalSkillNames();

  // Build the list of known names from the repo (already managed)
  const knownExtensions = new Set<string>();
  const extDir = resolve(dotfilesPath, "extensions");
  if (existsSync(extDir)) {
    for (const entry of readdirSync(extDir)) {
      knownExtensions.add(entry);
    }
  }

  const knownAgentSkills = new Set<string>();
  const agentSkillsDir = resolve(dotfilesPath, "agent-skills");
  if (existsSync(agentSkillsDir)) {
    for (const entry of readdirSync(agentSkillsDir)) {
      knownAgentSkills.add(entry);
    }
  }

  const knownGlobalSkills = new Set<string>();
  const globalSkillsDir = resolve(dotfilesPath, "global-skills");
  if (existsSync(globalSkillsDir)) {
    for (const entry of readdirSync(globalSkillsDir)) {
      knownGlobalSkills.add(entry);
    }
  }

  // Scan for unmanaged items
  const found: FoundItem[] = [
    ...findUnmanaged(
      PI_EXTENSIONS_DIR,
      resolve(dotfilesPath, "extensions"),
      "extensions",
      knownExtensions,
    ),
    ...findUnmanaged(
      PI_SKILLS_DIR,
      resolve(dotfilesPath, "agent-skills"),
      "agent-skills",
      new Set([...knownAgentSkills, ...externalSkills]),
    ),
    ...findUnmanaged(
      AGENTS_SKILLS_DIR,
      resolve(dotfilesPath, "global-skills"),
      "global-skills",
      new Set([...knownGlobalSkills, ...externalSkills]),
    ),
  ];

  if (found.length === 0) {
    p.log.success("No unmanaged extensions or skills found. Everything is in sync.");
    p.outro("Done.");
    return;
  }

  p.log.info(`Found ${found.length} unmanaged item(s):`);
  for (const item of found) {
    const suffix = item.isDirectory ? "/" : "";
    p.log.message(`  ${pc.yellow(item.name + suffix)} ${pc.dim(`(${item.category})`)}`);
  }

  // Select what to absorb
  let toAbsorb: FoundItem[];

  if (options.all) {
    toAbsorb = found;
  } else {
    const selected = await p.multiselect({
      message: "Select items to absorb into the repo:",
      options: found.map((item) => ({
        value: item.name,
        label: item.name + (item.isDirectory ? "/" : ""),
        hint: `${item.category} -> dotfiles/${item.category}/${item.name}`,
      })),
      required: false,
    });

    if (p.isCancel(selected)) {
      p.cancel("Sync cancelled.");
      process.exit(0);
    }

    const selectedNames = new Set(selected as string[]);
    toAbsorb = found.filter((item) => selectedNames.has(item.name));
  }

  if (toAbsorb.length === 0) {
    p.log.warn("Nothing selected to absorb.");
    p.outro("Done.");
    return;
  }

  // Absorb selected items
  const spinner = p.spinner();
  let succeeded = 0;
  let failed = 0;

  for (const item of toAbsorb) {
    spinner.start(`Absorbing ${item.name}...`);
    const result = absorbItem(item);

    if (result.success) {
      spinner.stop(`${item.name}: ${result.message}`);
      succeeded++;
    } else {
      spinner.stop(`${item.name}: FAILED - ${result.message}`);
      failed++;
    }
  }

  if (failed > 0) {
    p.log.warn(`Absorbed ${succeeded}/${toAbsorb.length}. ${failed} failed.`);
  } else {
    p.log.success(`All ${succeeded} item(s) absorbed into the repo.`);
  }

  p.outro(
    pc.green("Next steps: review the new files in dotfiles/, add to registry.ts, then commit."),
  );
}
