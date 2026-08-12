#!/usr/bin/env node
// Build-time content freshness gate (SC-005, Edge Case 1, research R11). Fails the
// build when a non-draft concept page's `updated` frontmatter is older than 6 months,
// turning the review cadence into a CI failure instead of a calendar reminder.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = join(__dirname, '..', 'src', 'content', 'conceitos');
const MAX_AGE_MONTHS = 6;

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split('\n')) {
    const fieldMatch = line.match(/^(\w+):\s*(.*)$/);
    if (!fieldMatch) continue;
    const [, key, rawValue] = fieldMatch;
    fields[key] = rawValue.replace(/^"|"$/g, '');
  }
  return fields;
}

function monthsSince(date) {
  const now = new Date();
  return (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
}

let files;
try {
  files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md'));
} catch {
  files = [];
}

let hasStale = false;

for (const file of files) {
  const raw = readFileSync(join(CONTENT_DIR, file), 'utf8');
  const fm = parseFrontmatter(raw);
  if (!fm || fm.draft === 'true') continue;

  const updated = new Date(fm.updated);
  if (Number.isNaN(updated.getTime())) {
    console.error(`check-freshness: ${file} has no valid "updated" date`);
    hasStale = true;
    continue;
  }

  const age = monthsSince(updated);
  if (age > MAX_AGE_MONTHS) {
    console.error(
      `check-freshness: ${file} was last updated ${age} months ago (${fm.updated}) — ` +
        `exceeds the ${MAX_AGE_MONTHS}-month review cadence (SC-005)`,
    );
    hasStale = true;
  }
}

if (hasStale) {
  process.exit(1);
}

console.log(
  `check-freshness: ${files.length} concept page(s) within the ${MAX_AGE_MONTHS}-month review window`,
);
