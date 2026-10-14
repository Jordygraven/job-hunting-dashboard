// src/app/syncs/page.tsx
import Link from "next/link";
import { getSyncRunsPage } from "@/lib/sync/getSyncRunsPage";
import { getSyncVacancies } from "@/lib/sync/getSyncVacancies";
import { SyncsTable } from "../SyncsTable";
import { SyncsPagination } from "../SyncsPagination";

export const dynamic = "force-dynamic";

export default async function SyncsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { page: rawPage } = await searchParams;
  // getSyncRunsPage clamps the raw value with clampPage.
  const { runs, page, totalPages } = await getSyncRunsPage(rawPage);
  const vacancies = await getSyncVacancies(runs);

  return (
    <div className="flex flex-col flex-1 bg-surface-page font-sans">
      <main className="flex flex-1 w-full max-w-content mx-auto flex-col py-12 px-6 gap-6">
        <Link href="/" className="text-sm text-accent hover:text-accent-hover">
          ← Back
        </Link>
        <h1 className="text-2xl font-semibold text-text-primary">Syncs</h1>
        <SyncsTable runs={runs} vacancies={vacancies} openFirst={page === 1} />
        <SyncsPagination page={page} totalPages={totalPages} />
      </main>
    </div>
  );
}
