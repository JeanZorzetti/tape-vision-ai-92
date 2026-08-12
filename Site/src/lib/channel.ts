// Referral-channel classification (data-model.md §3, research R8). `ai` is tested
// before `organic` because some AI surfaces (e.g. gemini.google.com) sit on
// search-engine domains — testing organic first would misclassify them.
export type ReferralChannel = 'organic' | 'ai' | 'direct' | 'other';

const AI_HOSTS = [
  'chatgpt.com',
  'openai.com',
  'perplexity.ai',
  'gemini.google.com',
  'claude.ai',
  'copilot.microsoft.com',
];

const AI_SOURCE_NAMES = ['chatgpt', 'openai', 'perplexity', 'gemini', 'claude', 'copilot'];

const SEARCH_HOSTS = ['google.', 'bing.com', 'duckduckgo.com', 'yahoo.', 'ecosia.org'];

function extractHost(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function hostIncludesAny(host: string | null, patterns: string[]): boolean {
  return host !== null && patterns.some((p) => host.includes(p));
}

export interface ClassifyInput {
  referrer: string | null;
  utmSource: string | null;
}

export function classifyReferralChannel({ referrer, utmSource }: ClassifyInput): ReferralChannel {
  const host = extractHost(referrer);
  const source = utmSource?.toLowerCase() ?? null;

  if (hostIncludesAny(host, AI_HOSTS) || (source && AI_SOURCE_NAMES.some((name) => source.includes(name)))) {
    return 'ai';
  }
  if (hostIncludesAny(host, SEARCH_HOSTS)) {
    return 'organic';
  }
  if (!host && !source) {
    return 'direct';
  }
  return 'other';
}
