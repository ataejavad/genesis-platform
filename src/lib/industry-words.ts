// Words that tell the chat which trade a visitor is in (any site language). One entry per live hub.
export const industryWords: Record<string, RegExp> = {
  glass: /glass|glas|window|fenster|vetr|finestr|شیشه|پنجره/i,
  installers: /install|idraul|elettric|impiant|caldai|pompa di calore|plumb|heating|electrician|sanitär|heizung|elektro|klima|تأسیسات|لوله‌کش|برق‌کار|نصاب/i,
  metal: /metal|metall|carpenter|acciaio|steel|stahl|schwei|sald|lamier|cnc|فلز|فولاد|جوش/i,
};

export const detectIndustry = (text: string, among: string[]) => among.find((slug) => industryWords[slug]?.test(text));
