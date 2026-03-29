import { defineConfig } from "tsup";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dotfilesSource = resolve(__dirname, "../../dotfiles");
const dotfilesDest = resolve(__dirname, "dist/dotfiles");

/** Copy filter: skip node_modules directories */
const skipNodeModules = (src: string): boolean => {
  return !src.includes("node_modules");
};

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  clean: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
  onSuccess: async () => {
    // Bundle dotfiles into dist/ so they ship with the npm package
    if (existsSync(dotfilesSource)) {
      mkdirSync(dotfilesDest, { recursive: true });

      // Copy extensions (excluding node_modules)
      cpSync(resolve(dotfilesSource, "extensions"), resolve(dotfilesDest, "extensions"), {
        recursive: true,
        filter: skipNodeModules,
      });

      // Copy agent-skills (bundled skills)
      cpSync(resolve(dotfilesSource, "agent-skills"), resolve(dotfilesDest, "agent-skills"), {
        recursive: true,
        filter: skipNodeModules,
      });

      // Copy global-skills
      cpSync(resolve(dotfilesSource, "global-skills"), resolve(dotfilesDest, "global-skills"), {
        recursive: true,
        filter: skipNodeModules,
      });

      // Copy intercepted-commands
      if (existsSync(resolve(dotfilesSource, "intercepted-commands"))) {
        cpSync(
          resolve(dotfilesSource, "intercepted-commands"),
          resolve(dotfilesDest, "intercepted-commands"),
          { recursive: true },
        );
      }

      // Copy config files
      const configs = [
        "AGENTS.md",
        "APPEND_SYSTEM.md",
        "settings.json",
        "models.json",
        "agent-modes.json",
        "damage-control-rules.yaml",
        "auth.json.template",
        "mcp.json.template",
      ];
      for (const cfg of configs) {
        const src = resolve(dotfilesSource, cfg);
        if (existsSync(src)) {
          cpSync(src, resolve(dotfilesDest, cfg));
        }
      }

      console.log("Bundled dotfiles into dist/dotfiles/");
    }
  },
});
