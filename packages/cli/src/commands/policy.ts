// TODO: implement — psmmcp policy add|list|remove
//
// Local mode: full ACL policy management (stored in local config).
//   psmmcp policy add --id eng-github \
//     --subjects "group:engineers" --resources "mcp:github-mcp" \
//     --actions "*" --effect allow
//   psmmcp policy add --id deny-drop \
//     --subjects "*" --resources "mcp:postgres-mcp" \
//     --actions "tools/call" --effect deny \
//     --condition "tool.name in drop_table,truncate"
//   psmmcp policy list
//   psmmcp policy remove eng-github
//
// Server-side policies (on the gateway) via: psmmcp server policy ...
export {};
