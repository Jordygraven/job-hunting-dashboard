"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col flex-1 items-center justify-center gap-4 bg-surface-page p-8 text-center">
      <h1 className="text-xl font-semibold text-text-primary">Couldn&apos;t load the dashboard</h1>
      <p className="max-w-md text-sm text-text-secondary">
        {error.message || "Something went wrong."}
      </p>
      <button
        onClick={() => reset()}
        className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Try again
      </button>
    </div>
  );
}
