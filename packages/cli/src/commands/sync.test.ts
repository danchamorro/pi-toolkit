import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  cpSync,
  mkdirSync,
  rmSync,
  readdirSync,
  statSync,
  writeFileSync,
  existsSync,
  lstatSync,
  readFileSync,
  readlinkSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Replicate the core sync logic for testing:
 * - findUnmanaged: detect non-symlinked items
 * - absorbItem: copy to repo, remove original, symlink back
 */

interface FoundItem {
  name: string;
  sourcePath: string;
  targetDir: string;
  isDirectory: boolean;
}

function findUnmanagedFiles(scanDir: string, skipNames: Set<string>): FoundItem[] {
  if (!existsSync(scanDir)) return [];

  const items: FoundItem[] = [];
  const entries = readdirSync(scanDir);

  for (const entry of entries) {
    const fullPath = join(scanDir, entry);

    // Skip symlinks
    if (lstatSync(fullPath).isSymbolicLink()) continue;

    // Skip known names
    if (skipNames.has(entry)) continue;

    // Skip node_modules and hidden
    if (entry === "node_modules" || entry.startsWith(".")) continue;

    let isDir: boolean;
    try {
      isDir = statSync(fullPath).isDirectory();
    } catch {
      continue;
    }

    items.push({
      name: entry,
      sourcePath: fullPath,
      targetDir: "",
      isDirectory: isDir,
    });
  }

  return items;
}

let testDir: string;
let piExtDir: string;
let repoExtDir: string;

beforeEach(() => {
  testDir = join(
    tmpdir(),
    `pi-agent-toolkit-sync-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  piExtDir = join(testDir, "pi-extensions");
  repoExtDir = join(testDir, "repo-extensions");
  mkdirSync(piExtDir, { recursive: true });
  mkdirSync(repoExtDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("findUnmanaged", () => {
  it("finds regular files that are not symlinks", () => {
    writeFileSync(join(piExtDir, "new-ext.ts"), "code");
    const found = findUnmanagedFiles(piExtDir, new Set());
    assert.equal(found.length, 1);
    assert.equal(found[0].name, "new-ext.ts");
  });

  it("skips symlinked files", () => {
    const source = join(repoExtDir, "managed.ts");
    writeFileSync(source, "code");
    symlinkSync(source, join(piExtDir, "managed.ts"));

    const found = findUnmanagedFiles(piExtDir, new Set());
    assert.equal(found.length, 0);
  });

  it("skips names in the skip set", () => {
    writeFileSync(join(piExtDir, "known.ts"), "code");
    const found = findUnmanagedFiles(piExtDir, new Set(["known.ts"]));
    assert.equal(found.length, 0);
  });

  it("skips node_modules", () => {
    mkdirSync(join(piExtDir, "node_modules"));
    const found = findUnmanagedFiles(piExtDir, new Set());
    assert.equal(found.length, 0);
  });

  it("skips hidden directories", () => {
    mkdirSync(join(piExtDir, ".hidden"));
    const found = findUnmanagedFiles(piExtDir, new Set());
    assert.equal(found.length, 0);
  });

  it("finds unmanaged directories", () => {
    const dir = join(piExtDir, "new-skill");
    mkdirSync(dir);
    writeFileSync(join(dir, "SKILL.md"), "# skill");

    const found = findUnmanagedFiles(piExtDir, new Set());
    assert.equal(found.length, 1);
    assert.equal(found[0].name, "new-skill");
    assert.equal(found[0].isDirectory, true);
  });

  it("returns empty for nonexistent directory", () => {
    const found = findUnmanagedFiles(join(testDir, "nope"), new Set());
    assert.equal(found.length, 0);
  });

  it("finds mix of managed and unmanaged", () => {
    // Managed (symlink)
    const managedSource = join(repoExtDir, "managed.ts");
    writeFileSync(managedSource, "managed");
    symlinkSync(managedSource, join(piExtDir, "managed.ts"));

    // Unmanaged (regular file)
    writeFileSync(join(piExtDir, "new.ts"), "new");

    const found = findUnmanagedFiles(piExtDir, new Set());
    assert.equal(found.length, 1);
    assert.equal(found[0].name, "new.ts");
  });
});

describe("absorb mechanics", () => {
  it("absorbs a file: copies to repo, replaces with symlink", () => {
    const sourceFile = join(piExtDir, "my-ext.ts");
    const targetFile = join(repoExtDir, "my-ext.ts");
    writeFileSync(sourceFile, "export const x = 1;");

    // Simulate absorb
    cpSync(sourceFile, targetFile);
    unlinkSync(sourceFile);
    symlinkSync(targetFile, sourceFile);

    // Verify: repo has the content
    assert.equal(readFileSync(targetFile, "utf-8"), "export const x = 1;");

    // Verify: original location is now a symlink
    assert.ok(lstatSync(sourceFile).isSymbolicLink());
    assert.equal(readlinkSync(sourceFile), targetFile);

    // Verify: content accessible through symlink
    assert.equal(readFileSync(sourceFile, "utf-8"), "export const x = 1;");
  });

  it("absorbs a directory: copies to repo, replaces with symlink", () => {
    const sourceDir = join(piExtDir, "my-skill");
    mkdirSync(sourceDir);
    writeFileSync(join(sourceDir, "SKILL.md"), "# My Skill");
    writeFileSync(join(sourceDir, "helper.ts"), "code");

    const targetDir = join(repoExtDir, "my-skill");

    // Simulate absorb
    cpSync(sourceDir, targetDir, { recursive: true });
    rmSync(sourceDir, { recursive: true, force: true });
    symlinkSync(targetDir, sourceDir);

    // Verify: repo has the content
    assert.ok(existsSync(join(targetDir, "SKILL.md")));
    assert.ok(existsSync(join(targetDir, "helper.ts")));

    // Verify: original location is now a symlink
    assert.ok(lstatSync(sourceDir).isSymbolicLink());

    // Verify: content accessible through symlink
    assert.equal(readFileSync(join(sourceDir, "SKILL.md"), "utf-8"), "# My Skill");
  });
});
