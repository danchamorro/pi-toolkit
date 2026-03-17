# @danchamorro/pi-agent-modes

Agent modes for [pi](https://github.com/badlogic/pi-mono) -- switch between focused operational modes with enforced tool restrictions.

## Modes

| Mode | Tools | Bash | Edits | Purpose |
|------|-------|------|-------|---------|
| **Code** | All | Unrestricted | All files | Default. Full access, no restrictions. |
| **Architect** | read, bash, edit, write, grep, find, ls | Read-only allowlist | `.md`, `.mdx` only | Analysis and planning. |
| **Debug** | All | Unrestricted | All files | Systematic diagnosis with guided behavior. |
| **Ask** | read, grep, find, ls | None | None | Read-only Q&A. |
| **Review** | read, bash, grep, find, ls | Review-safe allowlist | None | Code review with structured feedback. |

## Install

```bash
pi install npm:@danchamorro/pi-agent-modes
```

Or add to `~/.pi/agent/settings.json`:

```json
{
  "packages": ["npm:@danchamorro/pi-agent-modes"]
}
```

## Usage

**Command:**

```
/agent-mode              Show mode selector
/agent-mode architect    Switch to architect mode
/agent-mode code         Switch back to code mode
```

**Keyboard shortcut:**

`Ctrl+Shift+M` -- cycle through modes.

**CLI flag:**

```bash
pi --agent-mode architect
```

## How enforcement works

- **Tool visibility:** `setActiveTools()` controls which tools the model can see. In ask mode, bash/edit/write simply don't exist.
- **Bash restrictions:** For architect and review modes, bash commands are validated against an allowlist at the `tool_call` level. Destructive commands are blocked before execution.
- **File restrictions:** In architect mode, edit and write are restricted to markdown files (`.md`, `.mdx`). Other file types are blocked at the `tool_call` level.
- **Prompt injection:** Each mode (except code) appends a short behavioral prompt to the system prompt via `before_agent_start`.

## Configuration

Override mode defaults with JSON config files. Project overrides take precedence over global, which take precedence over built-in defaults.

**Global:** `~/.pi/agent/agent-modes.json`
**Project:** `.pi/agent-modes.json`

### Example: assign models to modes

```json
{
  "architect": {
    "provider": "openai",
    "model": "o3",
    "thinkingLevel": "high"
  },
  "code": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-5",
    "thinkingLevel": "medium"
  },
  "debug": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-5",
    "thinkingLevel": "high"
  }
}
```

### Example: customize architect to allow shell scripts

```json
{
  "architect": {
    "editableExtensions": [".md", ".mdx", ".sh"]
  }
}
```

### Override fields

Each mode supports these overrides:

| Field | Type | Description |
|-------|------|-------------|
| `tools` | `string[]` or `"all"` | Tools visible to the model |
| `bash` | `"all"`, `"none"`, `"restricted"` | Bash access level |
| `editableExtensions` | `string[]` | File extensions allowed for edit/write |
| `prompt` | `string` | System prompt addition |
| `provider` | `string` | Model provider name |
| `model` | `string` | Model ID |
| `thinkingLevel` | `string` | `"off"`, `"minimal"`, `"low"`, `"medium"`, `"high"`, `"xhigh"` |

## State persistence

The active mode is persisted across session restarts via `appendEntry`. When you resume a session, the mode you were in is automatically restored.
