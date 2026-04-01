// TODO: implement — psmmcp identity add|list|remove
//
// Local mode: full identity management (stored in local config/encrypted file).
//   psmmcp identity add alice --groups engineers,devops
//   psmmcp identity list
//   psmmcp identity remove alice
//
// Identities in local mode are used with self-issued JWT tokens.
// Server-side identities (backed by OIDC IdP) via: psmmcp server identity ...
export {};
