import { describe, it, expect } from 'vitest';
import { parseLeadInput } from '../../src/lib/lead';

const validBase = {
  name: 'Maria Souza',
  email: 'maria@exemplo.com.br',
  consent: true,
  empresa: '',
  renderedAt: Date.now() - 10_000,
  sourcePage: '/',
};

describe('parseLeadInput (contracts/waitlist-api.md test cases 6-8)', () => {
  it('case 6: consent false rejects with a consent error only', () => {
    const result = parseLeadInput({ ...validBase, consent: false });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.consent).toBeTruthy();
      expect(result.errors.email).toBeUndefined();
      expect(result.errors.name).toBeUndefined();
    }
  });

  it('case 7: invalid email rejects with an email error', () => {
    const result = parseLeadInput({ ...validBase, email: 'não-é-email' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.email).toBeTruthy();
    }
  });

  it('case 8: name too short rejects with a name error', () => {
    const result = parseLeadInput({ ...validBase, name: 'a' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.name).toBeTruthy();
    }
  });

  it('accepts a valid body and normalizes email/name', () => {
    const result = parseLeadInput({
      ...validBase,
      email: '  MARIA@EXEMPLO.COM.BR  ',
      name: '  Maria Souza  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('maria@exemplo.com.br');
      expect(result.data.name).toBe('Maria Souza');
    }
  });

  it('strips unknown fields instead of rejecting', () => {
    const result = parseLeadInput({ ...validBase, unexpectedField: 'whatever' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).unexpectedField).toBeUndefined();
    }
  });
});
