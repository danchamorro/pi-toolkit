import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  mkdirSync,
  rmSync,
  writeFileSync,
  symlinkSync,
  existsSync,
  lstatSync,
  readlinkSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Replicate the checkFile logic from status.ts for testing.
 * This validates the detection patterns the status command relies on.
 */
function checkFile(path: string): { exists: boolean; detail?: string } {
  try {
    const stats = lstatSync(path);
    if (stats.isSymbolicLink()) {
      const target = readlinkSync(path);
      const dangling = !existsSync(path);
      return {
        exists: !dangling,
        detail: dangling ? `dangling symlink -> ${target}` : `symlink -> ${target}`,
      };
    }
    return { exists: true };
  } catch {
    return { exists: false };
  }
}

let testDir: string;

beforeEach(() => {
  testDir = join(
    tmpdir(),
    `pi-toolkit-status-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("checkFile", () => {
  it("reports existing regular file as ok", () => {
    const file = join(testDir, "test.ts");
    writeFileSync(file, "content");

    const result = checkFile(file);
    assert.equal(result.exists, true);
    assert.equal(result.detail, undefined);
  });

  it("reports existing directory as ok", () => {
    const dir = join(testDir, "subdir");
    mkdirSync(dir);

    const result = checkFile(dir);
    assert.equal(result.exists, true);
  });

  it("reports missing path as not existing", () => {
    const result = checkFile(join(testDir, "nonexistent"));
    assert.equal(result.exists, false);
  });

  it("reports valid symlink with target detail", () => {
    const source = join(testDir, "source.ts");
    const link = join(testDir, "link.ts");
    writeFileSync(source, "content");
    symlinkSync(source, link);

    const result = checkFile(link);
    assert.equal(result.exists, true);
    assert.ok(result.detail?.startsWith("symlink -> "));
    assert.ok(result.detail?.includes(source));
  });

  it("reports dangling symlink as not existing", () => {
    const link = join(testDir, "dangling.ts");
    symlinkSync("/nonexistent/path/file.ts", link);

    const result = checkFile(link);
    assert.equal(result.exists, false);
    assert.ok(result.detail?.startsWith("dangling symlink -> "));
  });

  it("detects symlink to directory", () => {
    const sourceDir = join(testDir, "ext");
    const link = join(testDir, "ext-link");
    mkdirSync(sourceDir);
    writeFileSync(join(sourceDir, "index.ts"), "code");
    symlinkSync(sourceDir, link);

    const result = checkFile(link);
    assert.equal(result.exists, true);
    assert.ok(result.detail?.includes(sourceDir));
  });
});
