import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Eurostat dissemination API (JSON-stat 2.0), free and keyless:
 * https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/{dataset}?{dim}={code}&...
 * Every response is saved as a snapshot, so a run can be repeated offline and every number on a
 * card can be traced back to the exact file it came from.
 */

const BASE = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data";

export type JsonStat = {
  id: string[];
  size: number[];
  value: Record<string, number> | (number | null)[];
  status?: Record<string, string>;
  dimension: Record<string, { label?: string; category: { index: Record<string, number> | string[]; label?: Record<string, string> } }>;
  updated?: string;
  label?: string;
};

export type Query = Record<string, string | string[] | number>;

export type Fetcher = (dataset: string, query: Query) => Promise<JsonStat>;

export function buildUrl(dataset: string, query: Query) {
  const p = new URLSearchParams({ format: "JSON", lang: "EN" });
  for (const [k, v] of Object.entries(query)) {
    for (const one of Array.isArray(v) ? v : [v]) p.append(k, String(one));
  }
  return `${BASE}/${dataset}?${p}`;
}

export function snapshotName(dataset: string, query: Query) {
  const key = Object.entries(query)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join("+") : v}`)
    .join("&");
  const safe = key.replace(/[^A-Za-z0-9=+&_-]/g, "_");
  // long code lists would exceed file-name limits: keep a readable prefix plus a hash of the full query
  if (safe.length <= 120) return `${dataset}__${safe}.json`;
  return `${dataset}__${safe.slice(0, 80)}__${createHash("sha1").update(key).digest("hex").slice(0, 12)}.json`;
}

/**
 * Online fetcher with snapshots. `offline: true` reads only from the snapshot folder; a missing
 * snapshot then fails loudly instead of inventing data.
 */
export function eurostatFetcher(opts: { snapshotDir: string; offline?: boolean; log?: (m: string) => void }): Fetcher {
  return async (dataset, query) => {
    const file = join(opts.snapshotDir, snapshotName(dataset, query));
    if (opts.offline) return JSON.parse(await readFile(file, "utf8")) as JsonStat;
    const url = buildUrl(dataset, query);
    opts.log?.(`GET ${url}`);
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, { headers: { accept: "application/json" } });
        if (!res.ok) throw new Error(`Eurostat ${dataset}: HTTP ${res.status} ${await res.text().then((t) => t.slice(0, 300))}`);
        const json = (await res.json()) as JsonStat;
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, JSON.stringify(json));
        return json;
      } catch (e) {
        lastError = e;
        await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
      }
    }
    throw lastError;
  };
}

function categoryCodes(js: JsonStat, dim: string): string[] {
  const idx = js.dimension[dim]?.category.index;
  if (!idx) return [];
  if (Array.isArray(idx)) return idx;
  return Object.entries(idx)
    .sort(([, a], [, b]) => a - b)
    .map(([code]) => code);
}

export function labels(js: JsonStat, dim: string): Record<string, string> {
  return js.dimension[dim]?.category.label ?? {};
}

/** Every observation as { dimension → code } plus its value; empty cells are left out. */
export function observations(js: JsonStat) {
  const codes = js.id.map((d) => categoryCodes(js, d));
  const out: { at: Record<string, string>; value: number; flag?: string }[] = [];
  const entries: [number, number | null][] = Array.isArray(js.value)
    ? js.value.map((v, i) => [i, v])
    : Object.entries(js.value).map(([k, v]) => [Number(k), v]);
  for (const [flat, value] of entries) {
    if (value === null || value === undefined || !Number.isFinite(value)) continue;
    let rest = flat;
    const at: Record<string, string> = {};
    for (let d = js.id.length - 1; d >= 0; d--) {
      const size = js.size[d];
      at[js.id[d]] = codes[d][rest % size];
      rest = Math.floor(rest / size);
    }
    out.push({ at, value, flag: js.status?.[String(flat)] });
  }
  return out;
}

/**
 * Collapses a response to one number per `by` code (e.g. per geo or per nace_r2): filters on
 * `where`, then keeps the latest time period that has a value for that code.
 */
export function latestBy(js: JsonStat, by: string, where: Record<string, string> = {}) {
  const best = new Map<string, { value: number; time: string }>();
  for (const o of observations(js)) {
    if (Object.entries(where).some(([d, c]) => o.at[d] !== undefined && o.at[d] !== c)) continue;
    const code = o.at[by];
    const time = o.at.time ?? "";
    const prev = best.get(code);
    if (!prev || time > prev.time) best.set(code, { value: o.value, time });
  }
  return best;
}

/** Value for a given time period, per `by` code. */
export function atTime(js: JsonStat, by: string, time: string, where: Record<string, string> = {}) {
  const out = new Map<string, number>();
  for (const o of observations(js)) {
    if (o.at.time !== time) continue;
    if (Object.entries(where).some(([d, c]) => o.at[d] !== undefined && o.at[d] !== c)) continue;
    out.set(o.at[by], o.value);
  }
  return out;
}

export function times(js: JsonStat) {
  return categoryCodes(js, "time");
}

export function codes(js: JsonStat, dim: string) {
  return categoryCodes(js, dim);
}
