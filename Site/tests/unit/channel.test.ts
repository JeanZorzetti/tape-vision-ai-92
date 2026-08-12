import { describe, it, expect } from 'vitest';
import { classifyReferralChannel } from '../../src/lib/channel';

describe('classifyReferralChannel (data-model.md §3, research R8)', () => {
  it('classifies known AI answer engines as ai', () => {
    expect(classifyReferralChannel({ referrer: 'https://chatgpt.com/c/123', utmSource: null })).toBe('ai');
    expect(classifyReferralChannel({ referrer: 'https://www.perplexity.ai/search', utmSource: null })).toBe('ai');
    expect(classifyReferralChannel({ referrer: 'https://claude.ai/chat/1', utmSource: null })).toBe('ai');
  });

  it('ai is tested before organic — gemini.google.com is ai, not organic', () => {
    expect(classifyReferralChannel({ referrer: 'https://gemini.google.com/app', utmSource: null })).toBe('ai');
  });

  it('classifies traditional search engines as organic', () => {
    expect(classifyReferralChannel({ referrer: 'https://www.google.com/search?q=x', utmSource: null })).toBe(
      'organic',
    );
    expect(classifyReferralChannel({ referrer: 'https://www.bing.com/search?q=x', utmSource: null })).toBe(
      'organic',
    );
  });

  it('classifies no referrer and no utm_source as direct', () => {
    expect(classifyReferralChannel({ referrer: null, utmSource: null })).toBe('direct');
  });

  it('classifies anything else as other, keeping the raw referrer for reclassification', () => {
    expect(classifyReferralChannel({ referrer: 'https://news.ycombinator.com/', utmSource: null })).toBe('other');
  });

  it('classifies a utm_source naming an AI engine as ai even without a matching referrer', () => {
    expect(classifyReferralChannel({ referrer: null, utmSource: 'perplexity' })).toBe('ai');
  });
});
