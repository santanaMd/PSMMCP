// TODO: implement — psmmcp mcp create|link|start|stop|restart|status|logs|remove|unlink
//
// Local mode: full MCP lifecycle on the user's machine.
//   psmmcp mcp create github-mcp --from npm:@modelcontextprotocol/server-github \
//     --env GITHUB_TOKEN={{secret:github-pat}}
//   psmmcp mcp link remote-mcp --url https://...
//   psmmcp mcp start github-mcp
//   psmmcp mcp stop github-mcp
//   psmmcp mcp restart github-mcp
//   psmmcp mcp status
//   psmmcp mcp logs github-mcp
//   psmmcp mcp remove github-mcp
//
// MCPs run as local child processes with secrets injected from the local encrypted store.
// Server-side MCP management (on the gateway) via: psmmcp server mcp ...
export {};
