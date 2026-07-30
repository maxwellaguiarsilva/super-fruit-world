# Loop Engine Design

This document describes the architecture and implementation plan for the **loop mode** —
a fourth mode in `project-mcp-tools` that orchestrates opencode in a continuous
programmer/police loop until the game specification is fully satisfied.

---

## Motivation

The project has a large, detailed specification (`docs/agent/game-design.md`,
`docs/agent/requirements.md`, `docs/agent/compliance-rules.md`,
`docs/agent/technical-architecture.md`). A single opencode session cannot reliably
implement all of it in one pass. The loop engine forces opencode to keep working
until an independent "police" agent confirms the specification is met.

The critical concern is **hangout** — a subprocess (opencode or a tool inside it)
that blocks indefinitely and never returns. The engine must be proof against this.

---

## Research Findings

### opencode non-interactive execution

`opencode run` is the non-interactive entry point. Key flags:

| Flag | Purpose |
|------|---------|
| `--auto` | Auto-approve permissions (safe for controlled environment) |
| `--agent <name>` | Use a specific agent (build, plan, or custom) |
| `--model <provider/model>` | Override the model |
| `--session <id>` | Continue a specific session |
| `--continue` / `-c` | Continue the last session |
| `--dir <path>` | Working directory |
| `--format json` | Raw JSON event stream output |
| `--title <text>` | Session title |

The existing `cpp_llm_verifier` tool already uses `opencode run --auto` as a
subprocess via `create_process` — this is the proven pattern.

### opencode interaction logging

opencode logs **every interaction** in a SQLite database at
`~/.local/share/opencode/opencode.db`. Relevant tables:

| Table | Contents |
|-------|----------|
| `session` | id, title, agent, model, time_created, time_updated, cost, tokens |
| `message` | id, session_id, time_created, time_updated, data (JSON) |
| `part` | id, message_id, session_id, time_created, data (JSON) |
| `event` | id, aggregate_id, seq, type, data — types: `session.created`, `session.updated`, `message.updated`, `message.part.updated`, `message.removed` |

CLI access: `opencode db path`, `opencode db query`, `opencode session list --format json`,
`opencode export <sessionID>`.

This confirms hangout detection is possible: if `time_updated` on the latest
message/part is stale relative to the current time, the session is hung.

### opencode SDK / Server

`opencode serve` starts a persistent HTTP backend. The JS/TS SDK exposes
`session.prompt()`, `session.abort()`, `session.messages()`. From Python, the
HTTP API can be called directly. `session.abort()` can kill a hung session.

For the loop engine, the subprocess approach (`opencode run`) is simpler and
consistent with the existing `cpp_llm_verifier` pattern. The server approach is
a future optimization (avoids MCP cold boot).

### Relevant environment variables

| Variable | Effect |
|----------|--------|
| `OPENCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS` | Default timeout for bash commands inside opencode |
| `OPENCODE_DISABLE_AUTOCOMPACT` | Disable automatic context compaction |

### project-mcp-tools architecture

Three existing modes share a `tool_manager` with a common tool registry:

```
main.py  →  tool_manager  →  run_mcp() / run_api() / run_cli()
                              \      |      /
                               run_in_subprocess()
```

The loop mode is **different**: it is an orchestrator that drives opencode, not a
transport for the tool registry. It gets its own entry point (`main_loop`) and
its own package (`loop/`), but reuses `path_manager` for target-project
resolution and `sak.common` helpers.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Loop Engine                           │
│                    (uv run loop)                          │
│                                                          │
│  ┌─────────────────┐         ┌─────────────────┐        │
│  │  Programmer     │         │     Police       │        │
│  │  Runner         │         │     Runner       │        │
│  │                 │         │                  │        │
│  │ opencode run    │         │ opencode run     │        │
│  │ --auto          │         │ --auto           │        │
│  │ --agent build   │         │ --agent police   │        │
│  │ --session <id>  │         │ (fresh session)  │        │
│  │ --continue      │         │                  │        │
│  └────────┬────────┘         └────────┬─────────┘        │
│           │                           │                   │
│           │                  ┌────────▼────────┐         │
│           │                  │ Verdict Parser  │         │
│           │                  │ (JSON extraction)│         │
│           │                  └────────┬────────┘         │
│           │                           │                   │
│           │    ┌──────────────────────▼──────────┐      │
│           │    │ satisfied?                       │      │
│           │    │   yes → stop, report success     │      │
│           │    │   no  → feed feedback to programmer│    │
│           │    └──────────────────────┬──────────┘      │
│           │                           │                   │
│           ▼                           │                   │
│  ┌─────────────────────────────────────┐                 │
│  │        Process Guard                 │                 │
│  │  - subprocess timeout (primary)      │                 │
│  │  - kill on timeout                   │                 │
│  │  - capture partial output            │                 │
│  │  - log hangout to iteration log      │                 │
│  └─────────────────────────────────────┘                 │
│                                                          │
│  ┌─────────────────────────────────────┐                 │
│  │       Session Monitor                │                 │
│  │  - query opencode.db after each run  │                 │
│  │  - log tokens, cost, duration        │                 │
│  │  - detect stale sessions             │                 │
│  └─────────────────────────────────────┘                 │
└──────────────────────────────────────────────────────────┘
```

### Two-context isolation

The programmer and police agents run in **separate opencode sessions**:

- **Programmer** uses `--session <prog-id> --continue` to preserve context across
  iterations. It receives the task + feedback from the police.
- **Police** runs in a **fresh session every time** (no `--continue`). It has no
  access to the programmer's chat history. It evaluates only:
  - The specification files (`docs/agent/*.md`)
  - The current state of the code (`git diff`, file reads)
  - Playwright screenshots of the running game

This isolation prevents the police from being "influenced" by the programmer's
reasoning or excuses.

### Police agent

Defined as a markdown file in `.opencode/agents/police.md`. It is a primary agent
with **read-only tools** (no `write`, no `edit`) plus `bash` (for `git diff`),
`read`, `glob`, `grep`, and access to the Playwright MCP server.

The police agent is instructed to:
1. Read the specification documents.
2. Inspect the current codebase state.
3. Use Playwright to launch the game and verify UI/behavior.
4. Return a structured JSON verdict.

### Verdict format

The police agent outputs a JSON block at the end of its response:

```json
{
  "satisfied": false,
  "score": 45,
  "summary": "Brief overall assessment",
  "issues": [
    {
      "severity": "critical",
      "category": "specification|compliance|functional|quality",
      "description": "What is wrong",
      "file": "path/to/file.js",
      "spec_reference": "R1.1 / game-design.md#player"
    }
  ],
  "feedback": "Actionable feedback for the programmer"
}
```

The loop engine extracts this JSON with a regex and parses it. If parsing fails,
the engine treats the verdict as "not satisfied" with a parse-error feedback.

---

## Hangout Protection

Hangout = a subprocess that blocks indefinitely. Three layers of defense:

### Layer 1 — Subprocess timeout (primary)

Every `opencode run` call uses `subprocess.Popen` with `communicate(timeout=T)`.
On `TimeoutExpired`, the process is killed and partial output is captured. The
iteration is logged as a hangout and the engine either retries or aborts.

Default timeouts:
- Programmer run: 600s (10 min) — development iterations are long
- Police run: 300s (5 min) — evaluation is shorter
- Configurable via CLI flags

### Layer 2 — Internal bash timeout

The environment variable `OPENCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS` is set
to limit bash commands executed *inside* opencode. This prevents a single bash
tool call from hanging the entire opencode session.

### Layer 3 — Max iterations safety

The engine refuses to loop more than N times (default 20). After N iterations
without satisfaction, it stops and reports the last verdict. This prevents
infinite loops caused by the programmer and police disagreeing forever.

### Layer 4 — Session monitor (diagnostic)

After each run, the engine queries `opencode.db` to log:
- Session ID, agent, model
- Token usage (input, output, reasoning, cache)
- Cost
- Duration
- Number of messages

This creates an audit trail. If a session shows 0 messages or stale timestamps,
it confirms a hangout occurred.

---

## File Structure

```
project-mcp-tools/
├── loop/                               # NEW: loop mode package
│   ├── __init__.py
│   ├── loop_engine.py                  # Entry point (thin facade)
│   └── loop_lib/                       # Domain library
│       ├── __init__.py
│       ├── engine_core.py              # Core loop logic
│       ├── opencode_runner.py          # Runs opencode run --auto with timeout
│       ├── process_guard.py            # Subprocess watchdog (timeout + kill)
│       ├── session_monitor.py          # opencode.db queries for diagnostics
│       └── verdict.py                  # Parses police JSON verdict
├── main.py                             # ADD: main_loop()
├── pyproject.toml                      # ADD: loop entry point
```

```
super-fruit-world/                      # host project
├── .opencode/
│   └── agents/
│       └── police.md                   # NEW: police agent definition
├── docs/agent/
│   └── loop-engine-design.md           # THIS FILE
```

---

## CLI Interface

```bash
uv run loop --target-project .. [options]
```

Options:

| Flag | Default | Description |
|------|---------|-------------|
| `--task` | (reads from spec) | Initial task prompt for the programmer |
| `--max-iterations` | 20 | Safety limit |
| `--programmer-timeout` | 600 | Programmer subprocess timeout (seconds) |
| `--police-timeout` | 300 | Police subprocess timeout (seconds) |
| `--programmer-model` | (opencode default) | Model for programmer |
| `--police-model` | (opencode default) | Model for police |
| `--spec-dir` | `docs/agent` | Directory with specification docs |
| `--log-file` | `loop-engine.log` | Iteration log path |
| `--dry-run` | false | Print planned commands without executing |

---

## Iteration Log Format

Each iteration is logged as JSON lines:

```json
{"iteration": 1, "phase": "programmer", "session_id": "...", "duration_s": 45, "status": "ok", "tokens_input": 12000, "tokens_output": 3000, "cost": 0.12}
{"iteration": 1, "phase": "police", "session_id": "...", "duration_s": 30, "status": "ok", "satisfied": false, "score": 45, "issues": 3}
{"iteration": 2, "phase": "programmer", "session_id": "...", "duration_s": 600, "status": "timeout", "hangout": true}
```

---

## Future Enhancements

1. **Persistent server mode** — use `opencode serve` + HTTP API to avoid MCP cold
   boot and enable `session.abort()` for hung sessions.
2. **Parallel police** — run multiple police evaluations in parallel (UI, compliance,
   functional) for faster verdicts.
3. **Caching** — skip police evaluation if no files changed since last iteration.
4. **Adaptive timeouts** — increase programmer timeout if iterations consistently
   succeed near the limit.
