# loop.md — Multi-Session Work Contract

Single file governing the infinity loop: a fresh opencode session per iteration, one responsibility each, clean handoffs. Read it fully at session start; it is the only routing doc you need.

## Loop mindset

- One small task per session; there is no rush. A single chat session is never a deadline.
- If the context is polluted or the task grew, do not fail: write a small next task into the stack-tree, hand off, and end cleanly.
- Always split a problem into smaller problems. Never avoid a problem because it would deepen the resolution tree — depth is absorbed across sessions, never a reason to defer.
- Creating tools (MCP, scripts, symlinks) is encouraged when it compounds progress.
- Violating a principle is not yet a failure; the discipline is cleaning up and handing off.

## Stack-tree

The stack-tree is the contract's single data structure and its only persistent state. Divide and conquer is **mandatory** and is executed through it.

- **Structure** — the tree is a single flat folder of markdown files: `stack-tree/index.md` is the root; every other node is one more markdown in the same folder. The hierarchy is purely logical, carried by links between the markdowns — never by subfolders. `depth` is a field in the node, not a path. There are no control registers beyond the tree. **Node file names are semantic and `lower-kebab-case`** (e.g. `slope-collision.md`, never codes or numbers like `0001.md`).
- **Levels & substacks** — each node holds a stack of tasks at its level. A task that needs decomposition gains a substack: a child node (a sibling markdown, linked from the parent) one level deeper. Descending into a child is a **push**; finishing a substack and returning to the parent is a **pop**. `depth` is the node's level in the tree — the divide-and-conquer metric. **A node must stay under ~200 lines; if it outgrows that, split its stack into a substack instead of growing the file.**
- **Active path** — exactly one node is active at a time. `stack-tree/index.md` keeps the current path (breadcrumb); the active node's markdown holds the session frame: Active Role, Stack Depth, Mandate, Target Artifact. A session reads only the nodes on the current path, never the whole tree.
- **One tree, all state** — the session frame, pending work, and debt are all just tasks in the tree: the active node holds the frame, pending nodes are the backlog, debt entries are tasks to fix later.

## Session start (every iteration)

1. If `prompt.md` exists at the project root, this session is dedicated to intake — run "User prompt intake" below and nothing else.
2. Read `stack-tree/index.md` — the root; follow the current path to the active node and read its frame (Role, Depth, Mandate, Target Artifact).
3. Read this `loop.md` (attached by the loop runner).
4. As orchestrator with no active mandate: pick ONE pending task from the root or the active node.
5. Read project docs scoped, on demand only.
6. Update the tree — mark done, prune, or write the next task — before ending.

## User prompt intake

When `prompt.md` exists, it is the user's new request and this dedicated session does only this:

1. **Enhance** — restate the request sharply: goal, scope, constraints, acceptance criteria. Resolve ambiguities before committing it to the tree.
2. **Internalize** — write the request into the stack-tree: add its tasks to `stack-tree/index.md`, decomposing into substack nodes as the request demands (divide and conquer).
3. **Remove** — delete `prompt.md`.

Once `prompt.md` is gone, the loop resumes the normal flow below.

## Roles

| Role | Scope |
| --- | --- |
| orchestrator | Strategy, backlog, sequencing. Default. Delegates large or isolated work. |
| loop-explore | Read-only mapping/investigation. Never edits code. |
| loop-worker | Scoped implementation/diagnosis within a strict mandate. |

## Pipeline

Run the phase that matches the mandate; a session runs only the phases in scope and hands the rest off.

| Phase | Goal | Output |
| --- | --- | --- |
| Mapping | Map the area without changing it | Summary / mapping note |
| Diagnosis | Root cause of a bug/violation | Report with file:line |
| Analysis | Decide how to solve | Written decision |
| Implementation | Ship a scoped change | Code + tests + docs |
| Verification | Prove it works and complies | Pass/fail + evidence |
| Handoff | Leave a clean state | stack-tree updated |

## Delegation (push/pop)

A task that spans > 3 steps or multiple files, or that the session cannot finish inside budget, MUST be decomposed into a substack — this is the mandatory divide-and-conquer, executed through the stack-tree, never with in-session background agents:

1. **Push** — create a child node linked from the current node; set its frame (role, depth+1, mandate, target artifact); update the root's current path. End the session.
2. **Execute** — the child session follows the path, assumes the role, works strictly in scope, writes to the target artifact.
3. **Pop** — mark the child's work done, update the parent node, restore the parent frame, shorten the path. End the session.
4. **Resume** — the next session follows the path to the resumed frame and continues.

## Context hygiene

- Attach only what the task needs, on demand: check sizes (`du -hd1`), search with `git ls-files`/grep, read scoped regions (see global AGENTS.md). In the stack-tree, load only the current path.
- **Budget:** hard cap 100k tokens, wrap up at 70k. Measure with the `session_context_usage` tool (project-mcp-tools); never guess. At 70k finish the in-flight unit, record status in the tree, hand off. At 100k stop and hand off.
- When the nodes on your path reach ~20k tokens, run a dedicated cleanup session: condense each node to one line, close resolved tasks, prune completed substacks.

## Compliance

Follow standard practice: DRY single source of truth, layered one-way dependencies, DI with no global state, fail fast without silent fallback, config externalization, consistent naming, no dead code, no secrets, small focused commits, docs ship with code.

Numbered rule IDs (R1.1, ...) may be referenced from stack-tree task nodes; see `docs/agent/compliance-rules.md` only when a numbered reference is needed.
