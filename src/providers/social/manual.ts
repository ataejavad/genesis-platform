import type { SocialPublisher } from "./index";

/*
 * Free, legal default: LinkedIn's personal-profile posting API needs an approved developer app and a token that
 * expires every 60 days, and posting tools charge for it. So the post is handed over: the link opens LinkedIn's
 * composer with the text already written; the founder presses Post. YouTube scripts are recorded by a person.
 */
const LINKEDIN_SHARE = "https://www.linkedin.com/feed/?shareActive=true&text=";

export function manualPublisher(): SocialPublisher {
  return {
    provider: "manual",
    async publish(p) {
      if (p.channel !== "linkedin") return { mode: "handed", shareUrl: null };
      const text = p.link ? `${p.text}\n\n👉 ${p.link}` : p.text;
      return { mode: "handed", shareUrl: LINKEDIN_SHARE + encodeURIComponent(text) };
    },
  };
}
