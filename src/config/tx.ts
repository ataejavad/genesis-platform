// Inline label helper for prototype pages: Persian for fa-ir, English elsewhere until message files exist.
export const tx = (locale: string, fa: string, en: string) => (locale.startsWith("fa") ? fa : en);
