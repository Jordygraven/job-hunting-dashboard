import Link from "next/link";

const LINK_CLASS =
  "rounded-full border border-border-subtle px-4 py-1.5 text-text-secondary transition-colors hover:border-accent hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

export function SyncsPagination({ page, totalPages }: { page: number; totalPages: number }) {
  return (
    <nav className="flex items-center justify-center gap-4 text-sm text-text-secondary">
      {page > 1 && (
        <Link href={`/syncs?page=${page - 1}`} className={LINK_CLASS}>
          Previous
        </Link>
      )}
      <span>
        Page {page} of {totalPages}
      </span>
      {page < totalPages && (
        <Link href={`/syncs?page=${page + 1}`} className={LINK_CLASS}>
          Next
        </Link>
      )}
    </nav>
  );
}
