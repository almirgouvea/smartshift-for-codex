# Changelog

## 1.0.0

First public release.

- Automatic model and reasoning effort per request (simple, medium, complex), using local rules and no extra model calls.
- Conversation tier that only goes up, to keep the model's prompt cache.
- Plan → execute: the strong model plans in read-only mode and the mid-tier model executes after you confirm.
- Signals after each request (failure, failed commands at the end, failed changes, many files) raise the tier for the next requests. When executing a plan, the number of files doesn't count.
- "Will use: …" preview with visible warnings for model switches and unavailable models.
- Token usage, model calls and cache hit rate after each request.
- English and Portuguese, following the VS Code language or the `smartShift.language` setting.
- On Windows: sandbox check and an instruction that makes Codex wait for commands instead of polling every second.
- Finds Codex from the official extension, the CLI or portable VS Code, and offers to install it if missing.
