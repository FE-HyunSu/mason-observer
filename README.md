# mason-observer

**mason-observer** is an open-source Claude Code plugin that observes Claude Code's execution through official Hooks and reconstructs how a request was handled — using only observable evidence (prompts, tool calls, file paths, subagent activity, the final answer). It never extracts Claude's private chain-of-thought, makes no network calls, and stores everything locally under your project's `.mason-observer/` directory.

한국어 문서는 [README_ko.md](./README_ko.md)를 참고하세요.

---

## 1. Introduction

`mason-observer` is an open-source Claude Code plugin that observes Claude Code's execution through **official Hooks**, and reconstructs — from that observed evidence alone — how Claude handled a given request. It makes no external LLM calls and runs no server: Claude Code itself reads the logs and writes the analysis report.

## 2. The problem it addresses

While handling one request, Claude Code calls multiple tools, reads or edits files, and sometimes spawns subagents. That process flashes by in the chat transcript and is hard to reconstruct precisely afterward — which files were actually touched, which instructions applied, why a particular approach was taken. `mason-observer` records the **observable** part of that execution locally, then later explains it from that record alone, carefully separating fact from inference.

## 3. What can be confirmed

- The user's submitted prompt (masked, length-limited)
- Session/prompt identifiers
- The **paths** of loaded instruction files such as `CLAUDE.md`
- Tool names called, and a minimal input summary (e.g. a Bash command, a file path)
- A safe summary of each tool's result (success/failure, masked and length-limited text or a structural summary)
- **Paths** of files read or modified
- Bash commands executed (masked)
- Subagent execution traces (type, identifier)
- Claude's final answer (masked, length-limited)
- Reconstructed reasoning built from the above, explicitly labeled `observed` / `inferred` / `unknown`

## 4. What cannot be confirmed

- Claude's private chain-of-thought, or the model's internal comparison of candidate approaches
- Any reasoning not reflected in the logs (can be inferred, never confirmed)
- Full file contents, original diffs, or complete raw tool output (not stored, by policy)
- The full distinction between a Skill file being loaded into context and that Skill's procedure actually having been followed (only estimable via evidence tiers)

See [docs/limitations.md](./docs/limitations.md) for the complete list.

## 5. It does not provide Claude's private chain-of-thought

**mason-observer is not a tool for extracting or bypassing Claude's private internal reasoning.** Every analysis is grounded only in facts officially exposed through Hooks and the transcript. Reports are designed to never assert "Claude thought this," and instead phrase things as "based on the observed behavior, it appears Claude judged X" (see `skills/decision-analysis/SKILL.md`).

## 6. How it works

```text
User Prompt
  → UserPromptSubmit Hook
  → Claude Agent Loop
  → Tool/Subagent Hooks
  → Stop Hook
  → Local JSONL (.mason-observer/events/)
  → inspect Command
  → decision-analysis Skill
  → Mason Observer Report
```

See [docs/architecture.md](./docs/architecture.md) for details.

## 7. Hook events collected

Only the following 10 events are used, each confirmed as currently supported in the official docs (`code.claude.com/docs/en/hooks.md`):

`SessionStart`, `UserPromptSubmit`, `InstructionsLoaded`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `SubagentStart`, `SubagentStop`, `Stop`, `SessionEnd`

The exact fields stored per event are defined in [docs/event-schema.md](./docs/event-schema.md). **Under no circumstances does a hook block a tool call, modify Claude's or a tool's input, or print anything to stdout** — it is a pure observer.

## 8. Requirements

- Claude Code, a version that supports Plugins/Marketplaces/Hooks (see [§17](#17-supported-claude-code-versions))
- Node.js 18+ (the hook/query scripts are plain Node.js and run without any extra install step)
- macOS, Linux, or Windows

Before doing anything else, confirm your `claude` actually runs:

```bash
claude --version
```

This must print a real version string (e.g. `2.1.178 (Claude Code)`). If you use `nvm` with several Node versions, each version keeps its own separate global npm install of `@anthropic-ai/claude-code` — an incomplete install manifests as a tiny placeholder script that errors with "claude native binary not installed." If that happens, either switch to a Node version with a working install, or reinstall cleanly:

```bash
npm install -g @anthropic-ai/claude-code
```

## 9. Publishing your own marketplace on GitHub

If you're maintaining a fork or your own copy of this plugin:

1. Push this repository to GitHub as a **public** repo (`.claude-plugin/marketplace.json` must sit at the repo root).
2. Replace the `name`/`owner.name` in `.claude-plugin/marketplace.json`, and the `author`/`homepage`/`repository` fields in each plugin entry and in `plugins/mason-observer/.claude-plugin/plugin.json`, with your own values.
3. Tag releases explicitly (see the [release checklist](#release-checklist-tag-based-versioning) below).

## 10. Installing the plugin

Once the marketplace repo is public, anyone can install it — but **how you type the install commands depends on where you're running Claude Code.** This is the part that trips people up most, so read this table first:

| Where Claude Code is running | What to type | Where to type it |
|---|---|---|
| A normal terminal shell, Claude Code not already running interactively | `claude plugin marketplace add fe-hyunsu/mason-observer`, then `claude plugin install mason-observer@mason-observer` | Directly at the shell prompt — **no leading `/`**. These are ordinary CLI subcommands of the `claude` binary, not slash commands, so a plain shell understands them. |
| Interactive terminal REPL (you already ran `claude` and are inside its own prompt) | `/plugin marketplace add fe-hyunsu/mason-observer`, then `/plugin install mason-observer@mason-observer` | Inside that session's own input box. |
| VS Code extension | `/plugins` (**plural** — `/plugin` singular is not available on this surface) | In the chat box; it opens a GUI dialog where you add the marketplace and install from there. |
| A surface with no interactive UI at all (cloud sessions, headless/CI) | Declare it in `.claude/settings.json` (see below) | It's a config file, not something you type. |

### Step by step (shell command — works almost everywhere, recommended)

1. Confirm Claude Code works (see [§8](#8-requirements)): `claude --version`.

2. Add the marketplace and install the plugin:
   ```bash
   claude plugin marketplace add fe-hyunsu/mason-observer
   claude plugin install mason-observer@mason-observer
   ```
   The part before `@` is the **plugin name**; the part after `@` is the **marketplace name**. In this repo both happen to be the string `mason-observer` — that's a naming coincidence, not a rule, so don't read the repeated word as a typo.

3. **Activate it in a session that's already open.** A shell-level install does not automatically show up in a Claude Code session you already had running (for example, a VS Code chat panel open before you ran the command above). Inside that already-open session, run:
   ```
   /reload-plugins
   ```
   A brand-new session started *after* the install will load the plugin automatically — no reload needed there.

4. **Verify it's actually active:**
   ```
   /mason-observer:status
   ```
   If this returns a real status report instead of "unknown command," it's active. Send a couple of ordinary prompts or tool calls, then run `/mason-observer:status` again — `totalEvents` should now be greater than 0.

### Alternative: declare it in `.claude/settings.json` (no interactive step needed)

Useful for team setups, or any environment without an interactive UI:

```json
{
  "extraKnownMarketplaces": {
    "mason-observer": {
      "source": { "source": "github", "repo": "fe-hyunsu/mason-observer" }
    }
  },
  "enabledPlugins": {
    "mason-observer@mason-observer": true
  }
}
```

### Testing locally without publishing anywhere

```bash
claude plugin marketplace add ./path/to/mason-observer
claude plugin install mason-observer@mason-observer
```
(the same shell-vs-REPL-vs-VS-Code distinction from the table above still applies)

## 11. Using `/mason-observer:inspect-last`

Reconstructs a report of the most recently completed user turn, using observed evidence only.

```text
/mason-observer:inspect-last
```

See [examples/sample-report.md](./examples/sample-report.md) for the output format and a worked example.

## 12. Using `/mason-observer:inspect-session`

Summarizes the entire current session: turn list, tool usage patterns, failures, loaded instructions, estimated Skill usage, and so on.

```text
/mason-observer:inspect-session
```

## 13. Using `/mason-observer:status`

Shows log collection status: location, most recent event, session count, whether masking has been applied, log size, supported hook events, and diagnostic warnings.

```text
/mason-observer:status
```

## 14. Where logs are stored

```text
<project-root>/.mason-observer/
├── events/    # Hook event JSONL
├── reports/   # (reserved — for future report storage)
├── state/     # internal state (e.g. a marker for whether .gitignore was already patched)
└── config.json  # (reserved — for future configuration)
```

No log is ever written to the plugin's install directory or plugin cache. If the project root can't be safely determined (no `CLAUDE_PROJECT_DIR` and no valid `cwd` in the hook input), nothing is written anywhere.

## 15. Deleting logs

```bash
rm -rf .mason-observer/
```

This is an ordinary file deletion you run yourself in your own project; `mason-observer` provides no remote-deletion feature or separate deletion API of its own.

## 16. Privacy and security policy

- **No network access, by default.**
- File content is never stored — only paths and operation types (this includes `.env` files).
- API keys, access/bearer tokens, Authorization/Cookie headers, passwords, PEM/private keys, and AWS/GitHub/Anthropic/OpenAI-style tokens are masked before anything is written to disk.
- Tool results are stored as safe, size-limited summaries, never as raw full output.
- Log size and retention count are capped (roughly 5MB per file, with a cap on the number of files per project).
- If `.mason-observer/` is a symlink pointing outside the project root, writes are refused.
- If `.mason-observer/` is missing from `.gitignore`, it's added safely — existing content is preserved.
- A hook failure, or an analysis failure, never blocks Claude Code's normal operation.

See [docs/privacy.md](./docs/privacy.md) for details.

## 17. Supported Claude Code versions

This plugin was built against the Plugin / Marketplace / Hooks / Skill specifications currently documented at `code.claude.com/docs/en/`.

**On 2026-09-06, this plugin was installed into a real Claude Code instance (v2.1.178, VS Code extension + Agent SDK backend) via `claude plugin marketplace add` / `claude plugin install`, and verified end-to-end** by running `/reload-plugins` followed by `/mason-observer:status`. `SessionStart`, `UserPromptSubmit`, `PreToolUse`, and `PostToolUse` events were confirmed to be recorded correctly in `.mason-observer/events/`, and `sessionId`/`promptId` correlation, the masking pipeline, and project-relative path conversion were all confirmed against real, live logs.

- Plugin/Marketplace/Hooks/Skill core structure: confirmed both in the docs and via a real install and load.
- `prompt_id` (used for turn correlation) — the official docs state "requires Claude Code v2.1.196 or later," but **it was observed to be populated correctly on v2.1.178.** This documented minimum version requirement therefore does not match reality; the true minimum is left as unknown. The time-window-based fallback (for when `promptId` is absent) is still kept regardless.
- The `UserPromptSubmit` prompt-text field name (`prompt`) was confirmed populated correctly in real logs (see [docs/event-schema.md](./docs/event-schema.md) for details).
- `/reload-plugins` reported "1 error during load," but since the loaded component counts (1 plugin · 4 skills · 10 hooks) exactly matched what this plugin declares, that error is likely unrelated to mason-observer itself — though the exact cause was not confirmed (unknown). The VS Code extension doesn't expose a `/plugin` Errors tab, so confirming the cause requires an interactive terminal `claude` session's `/plugin` → Errors tab, or `claude plugin details mason-observer`.

Running `/mason-observer:status` after installing is the recommended way to directly confirm events are being collected correctly in your own environment.

## 18. Known limitations

The full list is in [docs/limitations.md](./docs/limitations.md). Key points:

- Chain-of-thought and the model's internal comparison of candidates are fundamentally inaccessible.
- A file being accessed, or an instruction being loaded, does not mean it was actually applied.
- The Observer's own analysis (the report-generation step) is also Claude's interpretation, and can itself be wrong.
- Masking is pattern-based and therefore not exhaustive.
- End-to-end verification against a real Claude Code process has now been done (see §17 above), but the exact cause of the "1 error during load" reported by `/reload-plugins` remains unconfirmed (unknown).

## 19. Development and testing

```bash
git clone https://github.com/fe-hyunsu/mason-observer.git
cd mason-observer

npm test         # run unit/integration tests via Node's built-in test runner
npm run validate # check the manifests/hooks.json/command & skill frontmatter/script syntax, then run tests
```

No external dependencies — only the Node.js standard library and `node:test`.

## 20. Contributing

1. Open an issue first to discuss, especially for changes with privacy implications (adding a hook event, changing masking rules).
2. Fork the repo and create a branch.
3. Make sure `npm run validate` passes before opening a PR.
4. A PR that adds or changes masking rules must include a corresponding test in `tests/redact.test.js`.
5. Please report security vulnerabilities privately to the repo owner rather than as a public issue (see the GitHub profile for `fe-hyunsu` for contact — fill in a concrete security contact here once the repo is public).

### Release checklist (tag-based versioning)

- [ ] `npm test` and `npm run validate` pass
- [ ] Changes recorded in `CHANGELOG.md`
- [ ] `version` bumped together in `.claude-plugin/marketplace.json` and `plugins/mason-observer/.claude-plugin/plugin.json`
- [ ] `git tag vX.Y.Z` and push (a marketplace's `github` source type can pin a specific tag/branch via `ref`)

## 21. License

[MIT License](./LICENSE)
