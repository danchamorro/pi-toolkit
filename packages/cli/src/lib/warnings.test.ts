import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findMissingRecommendations } from "./warnings.ts";
import type { Component } from "./registry.ts";

function makeComponent(name: string, recommends?: string[]): Component {
  return {
    name,
    category: "extensions",
    description: "test",
    method: "copy",
    source: `extensions/${name}.ts`,
    recommends,
  };
}

describe("findMissingRecommendations", () => {
  it("returns empty array when no components have recommends", () => {
    const selected = [makeComponent("a"), makeComponent("b")];
    assert.deepEqual(findMissingRecommendations(selected), []);
  });

  it("returns empty when all recommendations are satisfied", () => {
    const selected = [
      makeComponent("exa-enforce", ["exa-search-tool"]),
      makeComponent("exa-search-tool"),
    ];
    assert.deepEqual(findMissingRecommendations(selected), []);
  });

  it("returns warnings for missing recommendations", () => {
    const selected = [makeComponent("exa-enforce", ["exa-search-tool"])];
    const warnings = findMissingRecommendations(selected);

    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes("exa-enforce"));
    assert.ok(warnings[0].includes("exa-search-tool"));
  });

  it("handles multiple missing recommendations", () => {
    const selected = [makeComponent("a", ["b", "c"]), makeComponent("d", ["e"])];
    const warnings = findMissingRecommendations(selected);
    assert.equal(warnings.length, 3);
  });

  it("handles partial satisfaction", () => {
    const selected = [makeComponent("a", ["b", "c"]), makeComponent("b")];
    const warnings = findMissingRecommendations(selected);

    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes("c"));
  });

  it("handles empty selection", () => {
    assert.deepEqual(findMissingRecommendations([]), []);
  });
});
