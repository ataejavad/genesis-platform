/**
 * Which channel may reach which contact, per country (doc 13 §2.6 ح). Every planned touch passes through
 * `channelCheck` when it is planned and again right before it is sent or called; a blocked touch keeps the
 * reason so the cockpit can show it.
 *
 * Javad (2026-10-23): every channel is built fully, including cold email and AI voice calls in Italy. The
 * risky ones are switched per country in the cockpit (off by default) and, once on, still need a legal basis
 * recorded on each contact. The risk labels below are what Javad sees next to each switch; not legal advice.
 */

export type Channel = "email" | "linkedin" | "phone";
// channel modes Javad switches on per country
// call-warm: a person calls right after a company replies or opens its page (optional, Javad 2026-10-23)
export const SWITCHES = ["email-cold", "voice-ai", "call-warm"] as const;
export type Switch = (typeof SWITCHES)[number];
export type Switches = Partial<Record<Switch, boolean>>;

/** LinkedIn's own weekly limits, spread over the working days (research 2026-10-23: 20–25 invites, 30–50 messages). */
export const LINKEDIN_DAILY = { invites: 25, messages: 40 } as const;

export const LEGAL_BASES = ["consent", "legitimate_interest", "existing_customer"] as const;
export type LegalBasis = (typeof LEGAL_BASES)[number];

export type Risk = { risk: "low" | "medium" | "high"; why: string };

type CountryRules = {
  email: Risk; // consented email (site form, imported consented list)
  "email-cold": Risk;
  linkedin: Risk;
  phone: Risk; // a person calls
  "voice-ai": Risk;
  "call-warm": Risk;
  // human cold calls need a do-not-call register check (Italy: RPO)
  rpo: boolean;
  // human cold calls only with presumed interest (Germany)
  phoneNeedsInterest: boolean;
  // first sentence of every AI voice call (AI Act art. 50)
  aiVoiceDisclosure: string;
};

const LINKEDIN: Risk = {
  risk: "medium",
  why: "LinkedIn's User Agreement (8.2) bans bots and automated messaging: the agent writes, a person sends from their own account within LinkedIn's limits.",
};

export const COUNTRY_RULES: Record<string, CountryRules> = {
  IT: {
    email: { risk: "low", why: "Consent recorded (site form or consented list)." },
    "email-cold": {
      risk: "high",
      why: "Codice privacy art. 130: promotional email needs prior consent, for companies too (Garante, May 2023); no marketing to PEC. Sends only to contacts with a recorded legal basis.",
    },
    linkedin: LINKEDIN,
    phone: {
      risk: "medium",
      why: "A person calls with the AI script. Check the number in the Registro Pubblico delle Opposizioni (covers companies too) before each campaign and monthly; a check is valid 15 days.",
    },
    "voice-ai": {
      risk: "high",
      why: "Automated calls without a human operator need prior consent (art. 130 c.1). The AI says it is an AI in its first sentence (AI Act art. 50). Calls only contacts with a recorded legal basis, or requested callbacks.",
    },
    "call-warm": { risk: "low", why: "A person calls a company that replied or opened its page; still checks the Registro unless they asked for the call." },
    rpo: true,
    phoneNeedsInterest: false,
    aiVoiceDisclosure: "Buongiorno, sono l'assistente virtuale di {brand}, una intelligenza artificiale.",
  },
  DE: {
    email: { risk: "low", why: "Consent recorded." },
    "email-cold": { risk: "high", why: "UWG §7(2)3: advertising email needs prior consent, also between companies." },
    linkedin: LINKEDIN,
    phone: { risk: "high", why: "UWG §7(2)1: B2B calls only with presumed consent (a concrete reason the firm wants it). Fines up to €300,000." },
    "voice-ai": { risk: "high", why: "Automated calls need prior consent; the AI discloses itself in the first sentence." },
    "call-warm": { risk: "medium", why: "Allowed once the firm showed interest (reply, page visit with contact request)." },
    rpo: false,
    phoneNeedsInterest: true,
    aiVoiceDisclosure: "Guten Tag, hier spricht der virtuelle Assistent von {brand}, eine künstliche Intelligenz.",
  },
};

// Strict default for countries we have not reviewed yet.
const DEFAULT: CountryRules = {
  email: { risk: "low", why: "Consent recorded." },
  "email-cold": { risk: "high", why: "Country not reviewed yet." },
  linkedin: LINKEDIN,
  phone: { risk: "high", why: "Country not reviewed yet: no cold calls." },
  "voice-ai": { risk: "high", why: "Country not reviewed yet." },
  "call-warm": { risk: "medium", why: "Country not reviewed yet." },
  rpo: false,
  phoneNeedsInterest: true,
  aiVoiceDisclosure: "This is an AI assistant calling on behalf of {brand}.",
};

export const rulesFor = (country: string) => COUNTRY_RULES[country.toUpperCase()] ?? DEFAULT;

export type Reach = {
  country: string;
  email?: string | null;
  emailConsent?: boolean;
  legalBasis?: string | null;
  phone?: string | null;
  rpoCheckedAt?: Date | null;
  rpoListed?: boolean | null;
  // a check-up call request, a reply, or another concrete reason the firm wants to hear from us
  presumedInterest?: boolean;
  callbackRequested?: boolean;
  doNotContact?: boolean;
  switches?: Switches;
};

const RPO_VALID_DAYS = 15;

// Reasons that can never clear for this contact; anything else (switch off, basis missing, Registro not yet
// checked) can change, so the touch waits instead of being skipped.
export const PERMANENT = new Set(["no email", "no phone number", "opted out", "cold calls not allowed here"]);

function rpoCheck(r: Reach, now: Date) {
  if (r.callbackRequested || !rulesFor(r.country).rpo) return null;
  if (!r.rpoCheckedAt || now.getTime() - r.rpoCheckedAt.getTime() > RPO_VALID_DAYS * 864e5) return "check the number in the Registro delle Opposizioni first";
  if (r.rpoListed) return "number is in the Registro delle Opposizioni";
  return null;
}

/** null = allowed; otherwise the reason it is blocked now. `ai` = the AI voice agent makes the call. */
export function channelCheck(channel: Channel, r: Reach, now = new Date(), ai = false): string | null {
  if (r.doNotContact) return "opted out";
  const rules = rulesFor(r.country);
  if (channel === "email") {
    if (!r.email) return "no email";
    if (r.emailConsent) return null;
    if (!r.switches?.["email-cold"]) return `cold email is switched off for ${r.country.toUpperCase()}`;
    if (!r.legalBasis) return "no legal basis recorded for this contact";
    return null;
  }
  if (channel === "phone") {
    if (!r.phone) return "no phone number";
    if (ai) {
      if (!r.switches?.["voice-ai"]) return `AI voice calls are switched off for ${r.country.toUpperCase()}`;
      if (!r.callbackRequested && !r.legalBasis) return "no legal basis recorded for an AI call";
      return rpoCheck(r, now);
    }
    if (rules.phoneNeedsInterest && !r.presumedInterest) return "cold calls not allowed here";
    return rpoCheck(r, now);
  }
  return null;
}
