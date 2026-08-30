# Agent harness and MCP boundary

The agent runtime owns model selection, verified context, cost budget, tool classification, approval policy and structured proposals. Providers implement an OpenAI-compatible interface, so deterministic, local Ollama/vLLM and external models can be exchanged without changing restaurant business logic.

MCP is an integration surface, not the domain layer. The MCP server authenticates as a tenant-scoped TableNow Node and calls the Core API. It has no database credential. Current tools read the daily workspace, list decisions and ask the copilot; any proposal remains blocked by the same API authorization and human approval flow as the UI.

Before adding a tool:

1. define a typed contract and least-privilege permission;
2. classify risk and whether approval is mandatory;
3. make execution idempotent and auditable;
4. test wrong tenant, wrong role, retry and partial failure;
5. document external side effects and reversal;
6. keep a deterministic test double.
