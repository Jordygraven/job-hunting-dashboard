export interface LinkedInCard {
  jobId: string;
  title: string;
  company: string;
  location: string | null;
  url: string;
}

export interface ParseFailure {
  reason: string;
  snippet: string;
}

export interface ParseWarning {
  reason: string;
  snippet: string;
}

export interface ParseResult {
  cards: LinkedInCard[];
  failures: ParseFailure[];
  warnings: ParseWarning[];
}

const ANCHOR_RE = /^Vacature weergeven:\s*(.*)$/;
const JOB_ID_RE = /jobs\/view\/(\d+)/;
const SEPARATOR_RE = /^-{5,}$/;

const BADGE_PATTERNS = [
  /^Dit bedrijf werft actief nieuwe medewerkers$/,
  /^Solliciteren met cv en profiel$/,
  /^\d+ connecties?$/,
];

// Fixed Dutch boilerplate that never appears inside a card. Matched on the
// trimmed line, independent of any trailing URL, so it still works in
// production once links are full tracking URLs instead of the clean
// samples' "[link]" placeholder.
const JUNK_EXACT = new Set([
  'Nieuwe vacatures komen overeen met uw voorkeuren.',
  'Een nieuwe vacature komt overeen met uw voorkeuren.',
  'Nieuwe vacatures uit uw andere meldingen',
  'Val op en laat wervingspersoneel weten wanneer een functie die ze hebben geplaatst uw eerste keuze is.',
  'Zoek slimmer naar een baan met Premium',
  'U ontvangt e-mails met vacaturemeldingen.',
]);

// A line that is nothing but a link is never card content: in the clean
// samples it's the "[link]" redaction placeholder, in production it will be
// a bare tracking URL on its own line (e.g. under the premium promo text).
// Title/company/location are never a bare URL, so either form is safe to
// treat as a reset rather than card content.
const BARE_LINK_RE = /^(\[link\]|https?:\/\/\S+)$/;

const JUNK_PREFIXES = [
  'Subject:',
  'Uw vacaturemelding voor ',
  'Alle vacatures op LinkedIn weergeven',
  'Alle vacatures weergeven',
  'Melding bewerken',
  'Meldingen beheren',
  'Deze e-mail is bedoeld voor',
  'Lees waarom dit belangrijk is',
  'Uw vacaturemeldingen beheren',
  'Uitschrijven',
  '©',
  'LinkedIn en het',
];

function isJunkLine(trimmed: string): boolean {
  return (
    SEPARATOR_RE.test(trimmed) ||
    trimmed.includes('<strong') ||
    BARE_LINK_RE.test(trimmed) ||
    JUNK_EXACT.has(trimmed) ||
    JUNK_PREFIXES.some((prefix) => trimmed.startsWith(prefix))
  );
}

function snippetOf(lines: string[]): string {
  return lines.join(' | ').slice(0, 120);
}

function finalizeCard(
  buffer: string[],
  urlRemainder: string,
): { card?: LinkedInCard; failure?: ParseFailure; warning?: ParseWarning } {
  const jobIdMatch = urlRemainder.match(JOB_ID_RE);
  if (!jobIdMatch) {
    return {
      failure: {
        reason: 'anchor link has no numeric job id',
        snippet: snippetOf(buffer),
      },
    };
  }
  const jobId = jobIdMatch[1];

  const items = [...buffer];
  while (items.length > 0 && BADGE_PATTERNS.some((re) => re.test(items[items.length - 1]))) {
    items.pop();
  }

  if (items.length < 2) {
    return {
      failure: {
        reason: 'card is missing a title or company',
        snippet: snippetOf(buffer),
      },
    };
  }

  const [title, company, location, ...extras] = items;
  const card: LinkedInCard = {
    jobId,
    title,
    company,
    location: location ?? null,
    url: `https://www.linkedin.com/jobs/view/${jobId}/`,
  };

  if (extras.length > 0) {
    return {
      card,
      warning: {
        reason: 'unrecognized extra line inside card',
        snippet: snippetOf(extras),
      },
    };
  }

  return { card };
}

export function parseLinkedInAlert(text: string): ParseResult {
  const cards: LinkedInCard[] = [];
  const failures: ParseFailure[] = [];
  const warnings: ParseWarning[] = [];

  let buffer: string[] = [];

  for (const rawLine of text.split('\n')) {
    const trimmed = rawLine.trim();

    const anchorMatch = trimmed.match(ANCHOR_RE);
    if (anchorMatch) {
      const result = finalizeCard(buffer, anchorMatch[1]);
      if (result.card) cards.push(result.card);
      if (result.failure) failures.push(result.failure);
      if (result.warning) warnings.push(result.warning);
      buffer = [];
      continue;
    }

    if (trimmed === '') continue;

    if (isJunkLine(trimmed)) {
      buffer = [];
      continue;
    }

    buffer.push(trimmed);
  }

  return { cards, failures, warnings };
}

export function uniqueByJobId(cards: LinkedInCard[]): LinkedInCard[] {
  const seen = new Set<string>();
  const result: LinkedInCard[] = [];
  for (const card of cards) {
    if (seen.has(card.jobId)) continue;
    seen.add(card.jobId);
    result.push(card);
  }
  return result;
}
