// src/lib/vacancies/getVacancies.ts
import { getSupabaseServerClient } from "@/lib/supabase/server";

export interface Vacancy {
  id: number;
  title: string;
  company: string;
  location: string | null;
  url: string;
  firstSeenAt: string;
}

export async function getVacancies(): Promise<Vacancy[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("vacancies")
    .select("id, title, company, location, url, first_seen_at")
    .order("first_seen_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    url: row.url,
    firstSeenAt: row.first_seen_at,
  }));
}
