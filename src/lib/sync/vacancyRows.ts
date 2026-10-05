import type { LinkedInCard } from "@/lib/parsers/linkedin";

export interface VacancyRow {
  source: "linkedin";
  source_job_id: string;
  title: string;
  company: string;
  location: string | null;
  url: string;
  first_seen_at: string;
  source_message_id: string;
}

export function toVacancyRows(
  cards: LinkedInCard[],
  messageId: string,
  emailDate: Date
): VacancyRow[] {
  const firstSeenAt = emailDate.toISOString();

  return cards.map((card) => ({
    source: "linkedin",
    source_job_id: card.jobId,
    title: card.title,
    company: card.company,
    location: card.location,
    url: card.url,
    first_seen_at: firstSeenAt,
    source_message_id: messageId,
  }));
}

export function uniqueVacancyRows(rows: VacancyRow[]): VacancyRow[] {
  const seen = new Set<string>();
  const result: VacancyRow[] = [];
  for (const row of rows) {
    if (seen.has(row.source_job_id)) continue;
    seen.add(row.source_job_id);
    result.push(row);
  }
  return result;
}
