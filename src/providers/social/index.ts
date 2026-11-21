import type { Env } from "../registry";
import { chosen } from "../registry";
import { manualPublisher } from "./manual";

/*
 * Where an approved social post goes. SOCIAL_PROVIDER = manual | mock (auto: manual).
 * - manual (free, default): no posting API; the post is handed to the founder as a one-tap link that opens the
 *   network's composer with the text filled in. He presses Post there and confirms with one tap.
 * - A posting API (LinkedIn "Share on LinkedIn", a scheduler such as Buffer) is one more adapter file here.
 * Newsletter issues go through the email provider (src/providers/email), not through this kind.
 */

export type SocialPost = { id: string; channel: "linkedin" | "youtube"; text: string; link: string | null };

/** posted: the network has it now. handed: a person finishes it (`shareUrl` opens the filled-in composer, null = copy the text). */
export type PublishResult = { mode: "posted"; ref: string; url?: string } | { mode: "handed"; shareUrl: string | null };

export type SocialPublisher = { provider: string; publish: (p: SocialPost) => Promise<PublishResult> };

export function mockPublisher(mode: "posted" | "handed" = "handed"): SocialPublisher & { published: SocialPost[] } {
  const published: SocialPost[] = [];
  return {
    provider: "mock",
    published,
    async publish(p) {
      published.push(p);
      return mode === "posted" ? { mode, ref: `mock-${published.length}` } : { mode, shareUrl: `https://share.test/${p.id}` };
    },
  };
}

export function socialFromEnv(env: Env = process.env): SocialPublisher {
  switch (chosen("social", env)) {
    case "mock":
      return mockPublisher();
    default:
      return manualPublisher();
  }
}
