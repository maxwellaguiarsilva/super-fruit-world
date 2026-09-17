# stack-tree-compliance-reorg — docs/agent line-limit compliance

## Entry

- **Source:** loop-runner pre-session audit (`prompt.md` intake 2026-09-17)
- **Rule:** loop.md Compliance audit — every markdown under `docs/agent` under ~200 lines; `index.md` under ~150
- **Description:** 5 docs exceed the limit: `class-architecture.md` (2128), `note-frequency-calculator.md` (530), `game-design.md` (455), `technical-architecture.md` (305), `requirements.md` (205). Stack-tree nodes themselves comply (verified 2026-09-17). Split each oversized doc into child substack nodes (push; depth+1), link them from the parent, move overflow down, no information loss. Keep `index.md` under 150 lines.
- **Scope question:** offenders live in `docs/agent/`, not `docs/agent/stack-tree/`; the audit scope and the verify-command scope differ — resolve on execution (extend tree coverage vs relocate/split docs) without losing content.
- **Proposed fix:** one child substack per oversized doc; parent keeps frame + links; overflow moves down.
- **Verification:** `find -L docs/agent -name '*.md' -exec wc -l {} +` shows every file under limit.
