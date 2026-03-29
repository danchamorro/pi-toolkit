import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { matchesBtwDismissKey } from "../../../../dotfiles/extensions/btw.ts";

describe("matchesBtwDismissKey", () => {
  it("matches the namespaced cancel keybinding id", () => {
    const calls: string[] = [];
    const keybindings = {
      matches(data: string, binding: string) {
        calls.push(`${data}:${binding}`);
        return binding === "tui.select.cancel";
      },
    };

    assert.equal(matchesBtwDismissKey(keybindings as never, "escape"), true);
    assert.deepEqual(calls, ["escape:tui.select.cancel"]);
  });

  it("falls back to the legacy cancel keybinding id", () => {
    const calls: string[] = [];
    const keybindings = {
      matches(data: string, binding: string) {
        calls.push(`${data}:${binding}`);
        return binding === "selectCancel";
      },
    };

    assert.equal(matchesBtwDismissKey(keybindings as never, "escape"), true);
    assert.deepEqual(calls, ["escape:tui.select.cancel", "escape:selectCancel"]);
  });

  it("returns false when neither keybinding matches", () => {
    const keybindings = {
      matches() {
        return false;
      },
    };

    assert.equal(matchesBtwDismissKey(keybindings as never, "escape"), false);
  });
});
