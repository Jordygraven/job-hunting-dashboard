import "server-only";

export const SUPABASE_MAX_ROWS = 1000; // page-size hint for callers' `.limit()`; NOT assumed to be the real server cap
export const FETCH_ALL_ROWS_MAX_PAGES = 100_000; // guards a backend that never returns an empty page

export async function fetchAllRows<T>(
  fetchPage: (after: T | null) => Promise<{ data: T[] | null; error: { message: string } | null }>,
  maxPages: number = FETCH_ALL_ROWS_MAX_PAGES
): Promise<T[]> {
  const rows: T[] = [];
  let after: T | null = null;

  for (let page = 0; page < maxPages; page++) {
    const { data, error } = await fetchPage(after);

    if (error) {
      throw new Error(error.message);
    }
    if (!data || data.length === 0) {
      return rows;
    }

    rows.push(...data);
    after = data[data.length - 1];
  }

  throw new Error(`fetchAllRows: exceeded ${maxPages} pages without an empty page`);
}
