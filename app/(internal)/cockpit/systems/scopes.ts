// The scopes a key can carry (mirrors SCOPES in src/server/api-keys.ts; kept here so the client form needs no server code).
export const SCOPE_LIST = ["content:draft", "content:read", "crm:write", "outreach:run", "portal:write", "partner:work"] as const;
