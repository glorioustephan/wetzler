# Support Reply

You are right to slow down here. A passing build is useful evidence, but it does not prove the plugin path works for someone opening the tool from their editor.

I would test the exact launcher in `plugins/codex/wetzler/scripts/start-mcp.mjs`, then check that the MCP server can list tools and prepare a revision packet. If that works, the story is much stronger: source, package, and editor-facing paths are all pointing at the same behavior.

The fix may still be tiny. The trick is proving the tiny thing is the actual thing.

