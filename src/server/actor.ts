// Who did something. Stored as "type:id" in created_by / actor columns and the audit log.
export type Actor =
  | { type: "user"; id: string }
  | { type: "agent"; id: string; apiKeyId: string }
  | { type: "telegram"; id: string }
  | { type: "system"; id: string };

export function actorRef(actor: Actor): string {
  return `${actor.type}:${actor.id}`;
}
