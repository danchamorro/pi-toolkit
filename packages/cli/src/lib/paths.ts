import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Root of the bundled dotfiles shipped with the npm package */
export const BUNDLED_DOTFILES = resolve(__dirname, "dotfiles");

/** Pi agent config directory */
export const PI_AGENT_DIR = resolve(homedir(), ".pi", "agent");

/** Global skills directory (shared across agents) */
export const AGENTS_SKILLS_DIR = resolve(homedir(), ".agents", "skills");

/** Manifest file path */
export const MANIFEST_PATH = resolve(PI_AGENT_DIR, ".pi-toolkit.json");

/** Pi agent extensions directory */
export const PI_EXTENSIONS_DIR = resolve(PI_AGENT_DIR, "extensions");

/** Pi agent skills directory */
export const PI_SKILLS_DIR = resolve(PI_AGENT_DIR, "skills");

/** Pi agent prompts directory */
export const PI_PROMPTS_DIR = resolve(PI_AGENT_DIR, "prompts");

/** Pi agent agents directory */
export const PI_AGENTS_DIR = resolve(PI_AGENT_DIR, "agents");

/** Pi agent themes directory */
export const PI_THEMES_DIR = resolve(PI_AGENT_DIR, "themes");
