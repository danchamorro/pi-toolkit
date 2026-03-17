/**
 * Agent Modes - switch between code, architect, debug, ask, and review modes.
 *
 * Each mode controls which tools are visible, what bash commands are allowed,
 * what files can be edited, and injects a short behavioral prompt.
 *
 * Commands:
 *   /agent-mode <name>     Switch to a specific mode
 *   /agent-mode            Show mode selector
 *
 * Shortcuts:
 *   Ctrl+Shift+M           Cycle through modes
 *
 * CLI flag:
 *   --agent-mode <name>    Start session in a specific mode
 *
 * Config files (merged, project wins):
 *   ~/.pi/agent/agent-modes.json   Global overrides
 *   .pi/agent-modes.json           Project overrides
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { DynamicBorder, isToolCallEventType } from "@mariozechner/pi-coding-agent";
import { Container, Key, type SelectItem, SelectList, Text } from "@mariozechner/pi-tui";
import { loadModes } from "./config.ts";
import { MODE_NAMES, isSafeBash, isEditableFile, type ModeDefinition, type ModeName } from "./modes.ts";

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function agentModes(pi: ExtensionAPI) {
	let modes: Record<ModeName, ModeDefinition>;
	let activeMode: ModeName = "code";

	// ------------------------------------------------------------------
	// CLI flag
	// ------------------------------------------------------------------

	pi.registerFlag("agent-mode", {
		description: "Start in a specific agent mode (code, architect, debug, ask, review)",
		type: "string",
	});

	// ------------------------------------------------------------------
	// Helpers
	// ------------------------------------------------------------------

	function getMode(): ModeDefinition {
		return modes[activeMode];
	}

	function resolveTools(mode: ModeDefinition): string[] {
		if (mode.tools === "all") {
			return pi.getAllTools().map((t) => t.name);
		}
		// Filter to only tools that actually exist
		const allNames = new Set(pi.getAllTools().map((t) => t.name));
		return mode.tools.filter((t) => allNames.has(t));
	}

	async function applyMode(name: ModeName, ctx: ExtensionContext): Promise<void> {
		activeMode = name;
		const mode = getMode();

		// Set active tools
		pi.setActiveTools(resolveTools(mode));

		// Apply model if configured
		if (mode.provider && mode.model) {
			const model = ctx.modelRegistry.find(mode.provider, mode.model);
			if (model) {
				const ok = await pi.setModel(model);
				if (!ok) {
					ctx.ui.notify(`Mode "${mode.name}": no API key for ${mode.provider}/${mode.model}`, "warning");
				}
			} else {
				ctx.ui.notify(`Mode "${mode.name}": model ${mode.provider}/${mode.model} not found`, "warning");
			}
		}

		// Apply thinking level if configured
		if (mode.thinkingLevel) {
			pi.setThinkingLevel(mode.thinkingLevel);
		}

		updateStatus(ctx);
	}

	function updateStatus(ctx: ExtensionContext) {
		const mode = getMode();
		if (activeMode === "code") {
			ctx.ui.setStatus("agent-mode", undefined);
		} else {
			ctx.ui.setStatus("agent-mode", ctx.ui.theme.fg("accent", `mode:${mode.name.toLowerCase()}`));
		}
	}

	// ------------------------------------------------------------------
	// Mode selector UI
	// ------------------------------------------------------------------

	async function showModeSelector(ctx: ExtensionContext): Promise<void> {
		const items: SelectItem[] = MODE_NAMES.map((name) => {
			const mode = modes[name];
			const isActive = name === activeMode;
			const toolSummary = mode.tools === "all" ? "all tools" : mode.tools.join(", ");
			return {
				value: name,
				label: isActive ? `${mode.name} (active)` : mode.name,
				description: toolSummary,
			};
		});

		const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
			const container = new Container();
			container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));
			container.addChild(new Text(theme.fg("accent", theme.bold("Select Agent Mode"))));

			const selectList = new SelectList(items, Math.min(items.length, 10), {
				selectedPrefix: (text) => theme.fg("accent", text),
				selectedText: (text) => theme.fg("accent", text),
				description: (text) => theme.fg("muted", text),
				scrollInfo: (text) => theme.fg("dim", text),
				noMatch: (text) => theme.fg("warning", text),
			});

			selectList.onSelect = (item) => done(item.value);
			selectList.onCancel = () => done(null);
			container.addChild(selectList);

			container.addChild(new Text(theme.fg("dim", "up/down navigate | enter select | esc cancel")));
			container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));

			return {
				render(width: number) {
					return container.render(width);
				},
				invalidate() {
					container.invalidate();
				},
				handleInput(data: string) {
					selectList.handleInput(data);
					tui.requestRender();
				},
			};
		});

		if (!result) return;

		const name = result as ModeName;
		await applyMode(name, ctx);
		ctx.ui.notify(`Switched to ${modes[name].name} mode`, "info");
		persistState();
	}

	// ------------------------------------------------------------------
	// Cycling
	// ------------------------------------------------------------------

	async function cycleMode(ctx: ExtensionContext): Promise<void> {
		const currentIdx = MODE_NAMES.indexOf(activeMode);
		const nextIdx = (currentIdx + 1) % MODE_NAMES.length;
		const nextName = MODE_NAMES[nextIdx];

		await applyMode(nextName, ctx);
		ctx.ui.notify(`Switched to ${modes[nextName].name} mode`, "info");
		persistState();
	}

	// ------------------------------------------------------------------
	// State persistence
	// ------------------------------------------------------------------

	function persistState() {
		pi.appendEntry("agent-mode-state", { mode: activeMode });
	}

	// ------------------------------------------------------------------
	// Command: /agent-mode [name]
	// ------------------------------------------------------------------

	pi.registerCommand("agent-mode", {
		description: "Switch agent mode (code, architect, debug, ask, review)",
		getArgumentCompletions: (prefix: string) => {
			const items = MODE_NAMES.map((name) => ({
				value: name,
				label: modes[name].name,
			}));
			const filtered = items.filter((i) => i.value.startsWith(prefix));
			return filtered.length > 0 ? filtered : null;
		},
		handler: async (args, ctx) => {
			if (args?.trim()) {
				const name = args.trim().toLowerCase() as ModeName;
				if (!MODE_NAMES.includes(name)) {
					ctx.ui.notify(
						`Unknown mode "${args.trim()}". Available: ${MODE_NAMES.join(", ")}`,
						"error",
					);
					return;
				}
				await applyMode(name, ctx);
				ctx.ui.notify(`Switched to ${modes[name].name} mode`, "info");
				persistState();
				return;
			}
			await showModeSelector(ctx);
		},
	});

	// ------------------------------------------------------------------
	// Shortcut: Ctrl+Shift+M to cycle modes
	// ------------------------------------------------------------------

	pi.registerShortcut(Key.ctrlShift("m"), {
		description: "Cycle agent modes",
		handler: async (ctx) => {
			await cycleMode(ctx);
		},
	});

	// ------------------------------------------------------------------
	// Event: Inject mode prompt into system prompt
	// ------------------------------------------------------------------

	pi.on("before_agent_start", async (event) => {
		const mode = getMode();
		if (!mode.prompt) return;

		return {
			systemPrompt: `${event.systemPrompt}\n\n${mode.prompt}`,
		};
	});

	// ------------------------------------------------------------------
	// Event: Enforce bash and file restrictions
	// ------------------------------------------------------------------

	pi.on("tool_call", async (event) => {
		const mode = getMode();

		// Bash restrictions
		if (isToolCallEventType("bash", event)) {
			if (mode.bash === "none") {
				return {
					block: true,
					reason: `${mode.name} mode does not allow bash commands. Switch to code mode first.`,
				};
			}
			if (mode.bash === "restricted") {
				const command = event.input.command;
				if (!isSafeBash(command, activeMode)) {
					return {
						block: true,
						reason: `${mode.name} mode: command blocked (not in allowlist). Switch to code mode for full access.\nCommand: ${command}`,
					};
				}
			}
		}

		// File edit restrictions
		if (isToolCallEventType("edit", event) && mode.editableExtensions) {
			const path = event.input.path;
			if (!isEditableFile(path, mode)) {
				return {
					block: true,
					reason: `${mode.name} mode: can only edit ${mode.editableExtensions.join(", ")} files. Switch to code mode for full access.\nPath: ${path}`,
				};
			}
		}

		// File write restrictions
		if (isToolCallEventType("write", event) && mode.editableExtensions) {
			const path = event.input.path;
			if (!isEditableFile(path, mode)) {
				return {
					block: true,
					reason: `${mode.name} mode: can only write ${mode.editableExtensions.join(", ")} files. Switch to code mode for full access.\nPath: ${path}`,
				};
			}
		}
	});

	// ------------------------------------------------------------------
	// Event: Session start - load config and restore state
	// ------------------------------------------------------------------

	pi.on("session_start", async (_event, ctx) => {
		// Load mode definitions
		modes = loadModes(ctx.cwd);

		// Check CLI flag first
		const flagValue = pi.getFlag("agent-mode");
		if (typeof flagValue === "string" && flagValue) {
			const name = flagValue.toLowerCase() as ModeName;
			if (MODE_NAMES.includes(name)) {
				await applyMode(name, ctx);
				ctx.ui.notify(`Started in ${modes[name].name} mode`, "info");
				return;
			}
			ctx.ui.notify(
				`Unknown mode "${flagValue}". Available: ${MODE_NAMES.join(", ")}`,
				"warning",
			);
		}

		// Restore persisted state
		const entries = ctx.sessionManager.getEntries();
		const stateEntry = entries
			.filter(
				(e: { type: string; customType?: string }) =>
					e.type === "custom" && e.customType === "agent-mode-state",
			)
			.pop() as { data?: { mode: ModeName } } | undefined;

		if (stateEntry?.data?.mode && MODE_NAMES.includes(stateEntry.data.mode)) {
			await applyMode(stateEntry.data.mode, ctx);
		} else {
			updateStatus(ctx);
		}
	});
}
