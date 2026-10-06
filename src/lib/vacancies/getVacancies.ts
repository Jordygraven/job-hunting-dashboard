// src/lib/vacancies/getVacancies.ts
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";

export interface Vacancy {
  id: number;
  title: string;
  company: string;
  location: string | null;
  url: string;
  firstSeenAt: string;
}

type VacancyRow = {
  id: number;
  title: string;
  company: string;
  location: string | null;
  url: string;
  first_seen_at: string;
};

export async function getVacancies(): Promise<Vacancy[]> {
  const supabase = getSupabaseServerClient();

  const rows = await fetchAllRows<VacancyRow>(async (from, to) =>
    supabase
      .from("vacancies")
      .select("id, title, company, location, url, first_seen_at")
      .order("first_seen_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to)
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    url: row.url,
    firstSeenAt: row.first_seen_at,
  }));
}
