// TODO: implement — psmmcp secret add|list|remove|rotate
//
// Local mode secrets — stored in AES-256-GCM encrypted file.
// This is the full local credential store, used by local MCPs, local identities, etc.
//
//   psmmcp secret add github-pat         → local encrypted file
//   psmmcp secret list                   → list local secret IDs
//   psmmcp secret remove github-pat
//   psmmcp secret rotate github-pat
//
// Referenced in MCP config as {{secret:github-pat}}
//
// In server mode, local secrets still work for personal/sub-agent use.
// Server-side secrets (Vault) are managed via: psmmcp server secret ...
export {};
