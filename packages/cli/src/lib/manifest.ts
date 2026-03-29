import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { MANIFEST_PATH } from "./paths.ts";

export interface Manifest {
  version: string;
  installed: {
    extensions: string[];
    skills: {
      bundled: string[];
      external: string[];
    };
    prompts: string[];
    agents: string[];
    themes: string[];
    packages: string[];
    configs: string[];
  };
  installedAt: string;
  updatedAt: string;
}

function emptyManifest(): Manifest {
  return {
    version: "",
    installed: {
      extensions: [],
      skills: { bundled: [], external: [] },
      prompts: [],
      agents: [],
      themes: [],
      packages: [],
      configs: [],
    },
    installedAt: "",
    updatedAt: "",
  };
}

/** Read the manifest file, returning an empty manifest if it doesn't exist */
export function readManifest(path: string = MANIFEST_PATH): Manifest {
  if (!existsSync(path)) return emptyManifest();

  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw);
    const defaults = emptyManifest();

    // Backfill any fields missing from older or hand-edited manifests
    const installed = parsed.installed ?? {};
    return {
      version: parsed.version ?? defaults.version,
      installed: {
        extensions: installed.extensions ?? defaults.installed.extensions,
        skills: {
          bundled: installed.skills?.bundled ?? defaults.installed.skills.bundled,
          external: installed.skills?.external ?? defaults.installed.skills.external,
        },
        prompts: installed.prompts ?? defaults.installed.prompts,
        agents: installed.agents ?? defaults.installed.agents,
        themes: installed.themes ?? defaults.installed.themes,
        packages: installed.packages ?? defaults.installed.packages,
        configs: installed.configs ?? defaults.installed.configs,
      },
      installedAt: parsed.installedAt ?? defaults.installedAt,
      updatedAt: parsed.updatedAt ?? defaults.updatedAt,
    };
  } catch {
    return emptyManifest();
  }
}

/** Write the manifest file */
export function writeManifest(manifest: Manifest, path: string = MANIFEST_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
}

/** Get the array for a given category within the manifest */
function getList(manifest: Manifest, category: string): string[] | null {
  switch (category) {
    case "extensions":
      return manifest.installed.extensions;
    case "skills-bundled":
      return manifest.installed.skills.bundled;
    case "skills-external":
      return manifest.installed.skills.external;
    case "packages":
      return manifest.installed.packages;
    case "prompts":
      return manifest.installed.prompts;
    case "agents":
      return manifest.installed.agents;
    case "themes":
      return manifest.installed.themes;
    case "configs":
      return manifest.installed.configs;
    default:
      return null;
  }
}

/** Add installed components to the manifest */
export function recordInstall(
  names: string[],
  category: string,
  cliVersion: string,
  path: string = MANIFEST_PATH,
): void {
  const manifest = readManifest(path);
  const now = new Date().toISOString();

  if (!manifest.installedAt) manifest.installedAt = now;
  manifest.updatedAt = now;
  manifest.version = cliVersion;

  const list = getList(manifest, category);
  if (list) {
    for (const name of names) {
      if (!list.includes(name)) list.push(name);
    }
  }

  writeManifest(manifest, path);
}
