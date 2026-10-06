import "server-only";

export const SUPABASE_MAX_ROWS = 1000;

export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await fetchPage(from, from + SUPABASE_MAX_ROWS - 1);

    if (error) {
      throw new Error(error.message);
    }

    rows.push(...(data ?? []));

    if (!data || data.length < SUPABASE_MAX_ROWS) {
      break;
    }
    from += SUPABASE_MAX_ROWS;
  }

  return rows;
}
