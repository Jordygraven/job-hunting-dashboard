import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { parseLinkedInAlert, uniqueByJobId, type LinkedInCard } from './linkedin';

const SAMPLES_DIR = path.join(process.cwd(), 'samples', 'linkedin-clean');
const URL_RE = /^https:\/\/www\.linkedin\.com\/jobs\/view\/\d+\/$/;
const SUBJECT_RE = /^Subject:\s*(.+?)\s+bij\s+(.+?)\s*$/;

describe.skipIf(!existsSync(SAMPLES_DIR))('parseLinkedInAlert against real samples', () => {
  const files = readdirSync(SAMPLES_DIR).filter((f) => f.endsWith('.txt'));

  test('samples/linkedin-clean/ exists and has files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  test('parses exactly 72 cards with 0 failures across all samples, 45 unique', () => {
    const allCards: LinkedInCard[] = [];
    const allFailures: unknown[] = [];

    for (const file of files) {
      const text = readFileSync(path.join(SAMPLES_DIR, file), 'utf8');
      const { cards, failures } = parseLinkedInAlert(text);
      allCards.push(...cards);
      allFailures.push(...failures);
    }

    expect(allFailures).toHaveLength(0);
    expect(allCards).toHaveLength(72);
    expect(uniqueByJobId(allCards)).toHaveLength(45);
  });

  test('every card url is in the rebuilt https://www.linkedin.com/jobs/view/<id>/ format', () => {
    for (const file of files) {
      const text = readFileSync(path.join(SAMPLES_DIR, file), 'utf8');
      const { cards } = parseLinkedInAlert(text);
      for (const card of cards) {
        expect(card.url).toMatch(URL_RE);
        expect(card.url).toBe(`https://www.linkedin.com/jobs/view/${card.jobId}/`);
      }
    }
  });

  test('the first card in each file matches the subject "<title> bij <company>"', () => {
    for (const file of files) {
      const text = readFileSync(path.join(SAMPLES_DIR, file), 'utf8');
      const subjectLine = text.split('\n', 1)[0];
      const subjectMatch = subjectLine.match(SUBJECT_RE);
      expect(subjectMatch, `${file}: no Subject line match`).not.toBeNull();

      const { cards } = parseLinkedInAlert(text);
      expect(cards.length, `${file}: no cards parsed`).toBeGreaterThan(0);

      const [, expectedTitle, expectedCompany] = subjectMatch!;
      expect(cards[0].title, file).toBe(expectedTitle);
      expect(cards[0].company, file).toBe(expectedCompany);
    }
  });
});
