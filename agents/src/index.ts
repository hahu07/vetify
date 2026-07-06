/**
 * Entry point — starts the Supervisor agent.
 * Ensure all four MCP servers are running before starting this process:
 *   npm run mcp:canton  (terminal 1)
 *   npm run mcp:mono    (terminal 2)
 *   npm run mcp:cac     (terminal 3)
 *   npm run mcp:nibss   (terminal 4)
 *   npm run dev         (terminal 5)
 */
import "./agents/supervisor.js";
