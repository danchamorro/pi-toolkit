import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readManifest, writeManifest, recordInstall, type Manifest } from "./manifest.ts";

let testDir: string;
let manifestPath: string;

beforeEach(() => {
  testDir = join(
    tmpdir(),
    `pi-agent-toolkit-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(testDir, { recursive: true });
  manifestPath = join(testDir, ".pi-agent-toolkit.json");
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("readManifest", () => {
  it("returns empty manifest when file doesn't exist", () => {
    const manifest = readManifest(manifestPath);
    assert.equal(manifest.version, "");
    assert.deepEqual(manifest.installed.extensions, []);
    assert.deepEqual(manifest.installed.skills.bundled, []);
    assert.deepEqual(manifest.installed.skills.external, []);
    assert.deepEqual(manifest.installed.prompts, []);
    assert.deepEqual(manifest.installed.agents, []);
    assert.deepEqual(manifest.installed.themes, []);
    assert.deepEqual(manifest.installed.packages, []);
    assert.deepEqual(manifest.installed.configs, []);
    assert.equal(manifest.installedAt, "");
    assert.equal(manifest.updatedAt, "");
  });

  it("reads a valid manifest file", () => {
    const data: Manifest = {
      version: "1.0.0",
      installed: {
        extensions: ["tilldone"],
        skills: { bundled: ["brainstorm"], external: ["docx"] },
        prompts: [],
        agents: [],
        themes: [],
        packages: ["agent-modes"],
        configs: ["AGENTS.md"],
      },
      installedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    writeFileSync(manifestPath, JSON.stringify(data));

    const manifest = readManifest(manifestPath);
    assert.equal(manifest.version, "1.0.0");
    assert.deepEqual(manifest.installed.extensions, ["tilldone"]);
    assert.deepEqual(manifest.installed.skills.bundled, ["brainstorm"]);
    assert.deepEqual(manifest.installed.packages, ["agent-modes"]);
    assert.equal(manifest.installedAt, "2026-01-01T00:00:00.000Z");
  });

  it("returns empty manifest for invalid JSON", () => {
    writeFileSync(manifestPath, "not json{{{");
    const manifest = readManifest(manifestPath);
    assert.equal(manifest.version, "");
    assert.deepEqual(manifest.installed.extensions, []);
  });

  it("backfills missing fields from older manifests", () => {
    writeFileSync(
      manifestPath,
      JSON.stringify({
        version: "0.5.0",
        installed: { extensions: ["loop"] },
      }),
    );

    const manifest = readManifest(manifestPath);
    assert.equal(manifest.version, "0.5.0");
    assert.deepEqual(manifest.installed.extensions, ["loop"]);
    assert.deepEqual(manifest.installed.skills.bundled, []);
    assert.deepEqual(manifest.installed.skills.external, []);
    assert.deepEqual(manifest.installed.prompts, []);
    assert.deepEqual(manifest.installed.agents, []);
    assert.deepEqual(manifest.installed.themes, []);
    assert.deepEqual(manifest.installed.packages, []);
    assert.deepEqual(manifest.installed.configs, []);
    assert.equal(manifest.installedAt, "");
  });
});

describe("writeManifest", () => {
  it("writes manifest as formatted JSON", () => {
    const manifest: Manifest = {
      version: "1.0.0",
      installed: {
        extensions: ["tilldone"],
        skills: { bundled: [], external: [] },
        prompts: [],
        agents: [],
        themes: [],
        packages: [],
        configs: [],
      },
      installedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    writeManifest(manifest, manifestPath);

    const raw = readFileSync(manifestPath, "utf-8");
    assert.ok(raw.endsWith("\n"), "Should end with newline");

    const parsed = JSON.parse(raw);
    assert.equal(parsed.version, "1.0.0");
    assert.deepEqual(parsed.installed.extensions, ["tilldone"]);
  });

  it("creates parent directories if needed", () => {
    const nested = join(testDir, "a", "b", ".pi-agent-toolkit.json");
    const manifest: Manifest = {
      version: "1.0.0",
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

    writeManifest(manifest, nested);

    const raw = readFileSync(nested, "utf-8");
    assert.equal(JSON.parse(raw).version, "1.0.0");
  });
});

describe("recordInstall", () => {
  it("records extensions to manifest", () => {
    recordInstall(["tilldone", "loop"], "extensions", "1.0.0", manifestPath);

    const manifest = readManifest(manifestPath);
    assert.deepEqual(manifest.installed.extensions, ["tilldone", "loop"]);
    assert.equal(manifest.version, "1.0.0");
    assert.ok(manifest.installedAt);
    assert.ok(manifest.updatedAt);
  });

  it("records bundled skills", () => {
    recordInstall(["brainstorm"], "skills-bundled", "1.0.0", manifestPath);

    const manifest = readManifest(manifestPath);
    assert.deepEqual(manifest.installed.skills.bundled, ["brainstorm"]);
  });

  it("records external skills", () => {
    recordInstall(["docx", "pdf"], "skills-external", "1.0.0", manifestPath);

    const manifest = readManifest(manifestPath);
    assert.deepEqual(manifest.installed.skills.external, ["docx", "pdf"]);
  });

  it("records packages", () => {
    recordInstall(["agent-modes"], "packages", "1.0.0", manifestPath);

    const manifest = readManifest(manifestPath);
    assert.deepEqual(manifest.installed.packages, ["agent-modes"]);
  });

  it("records configs", () => {
    recordInstall(["AGENTS.md"], "configs", "1.0.0", manifestPath);

    const manifest = readManifest(manifestPath);
    assert.deepEqual(manifest.installed.configs, ["AGENTS.md"]);
  });

  it("records prompts", () => {
    recordInstall(["my-prompt"], "prompts", "1.0.0", manifestPath);

    const manifest = readManifest(manifestPath);
    assert.deepEqual(manifest.installed.prompts, ["my-prompt"]);
  });

  it("records agents", () => {
    recordInstall(["my-agent"], "agents", "1.0.0", manifestPath);

    const manifest = readManifest(manifestPath);
    assert.deepEqual(manifest.installed.agents, ["my-agent"]);
  });

  it("records themes", () => {
    recordInstall(["dark-pro"], "themes", "1.0.0", manifestPath);

    const manifest = readManifest(manifestPath);
    assert.deepEqual(manifest.installed.themes, ["dark-pro"]);
  });

  it("does not duplicate names on repeated calls", () => {
    recordInstall(["tilldone"], "extensions", "1.0.0", manifestPath);
    recordInstall(["tilldone", "loop"], "extensions", "1.0.0", manifestPath);

    const manifest = readManifest(manifestPath);
    assert.deepEqual(manifest.installed.extensions, ["tilldone", "loop"]);
  });

  it("preserves installedAt on subsequent calls", () => {
    recordInstall(["tilldone"], "extensions", "1.0.0", manifestPath);
    const first = readManifest(manifestPath).installedAt;

    recordInstall(["loop"], "extensions", "1.1.0", manifestPath);
    const second = readManifest(manifestPath);

    assert.equal(second.installedAt, first);
    assert.equal(second.version, "1.1.0");
  });

  it("ignores unknown categories gracefully", () => {
    recordInstall(["something"], "unknown-category", "1.0.0", manifestPath);

    const manifest = readManifest(manifestPath);
    assert.deepEqual(manifest.installed.extensions, []);
    assert.deepEqual(manifest.installed.skills.bundled, []);
  });
});
