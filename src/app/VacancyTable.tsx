import { formatKlDate } from "@/lib/format/kualaLumpurTime";
import type { VacancyTabRow, VacancyTabView } from "@/lib/vacancyActions/vacancyTabs";
import { REASON_LABELS } from "@/lib/vacancyActions/validation";
import { VacancyActions } from "./VacancyActions";

const EMPTY_STATE_TEXT: Record<VacancyTabView, string> = {
  todo: "No vacancies to triage.",
  applied: "No applied vacancies yet.",
  ignored: "No ignored vacancies yet.",
  all: "No vacancies yet.",
};

const STATUS_LABELS: Record<VacancyTabRow["status"], string> = {
  todo: "To do",
  applied: "Applied",
  ignored: "Ignored",
};

export function VacancyTable({ view, rows }: { view: VacancyTabView; rows: VacancyTabRow[] }) {
  if (rows.length === 0) {
    return <p className="text-zinc-600 dark:text-zinc-400">{EMPTY_STATE_TEXT[view]}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th scope="col" className="py-2 pr-4">Title</th>
            <th scope="col" className="py-2 pr-4">Company</th>
            <th scope="col" className="py-2 pr-4">Location</th>
            <th scope="col" className="py-2 pr-4 whitespace-nowrap">First seen</th>
            <th scope="col" className="py-2 pr-4">Link</th>
            {view === "applied" && (
              <th scope="col" className="py-2 pr-4 whitespace-nowrap">Applied on</th>
            )}
            {view === "ignored" && (
              <>
                <th scope="col" className="py-2 pr-4 whitespace-nowrap">Ignored on</th>
                <th scope="col" className="py-2 pr-4">Reason</th>
              </>
            )}
            {view === "all" && <th scope="col" className="py-2 pr-4">Status</th>}
            <th scope="col" className="py-2 pr-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-zinc-100 dark:border-zinc-900">
              <td className="py-2 pr-4">{row.title}</td>
              <td className="py-2 pr-4">{row.company}</td>
              <td className="py-2 pr-4">{row.location ?? ""}</td>
              <td className="py-2 pr-4 whitespace-nowrap">{formatKlDate(row.firstSeenAt)}</td>
              <td className="py-2 pr-4">
                <a
                  href={row.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 underline"
                >
                  View
                </a>
              </td>
              {view === "applied" && (
                <td className="py-2 pr-4 whitespace-nowrap">
                  {row.appliedOn ? formatKlDate(row.appliedOn) : ""}
                </td>
              )}
              {view === "ignored" && (
                <>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {row.ignoredOn ? formatKlDate(row.ignoredOn) : ""}
                  </td>
                  <td className="py-2 pr-4">
                    {row.ignoreReason ? REASON_LABELS[row.ignoreReason] : "—"}
                  </td>
                </>
              )}
              {view === "all" && <td className="py-2 pr-4">{STATUS_LABELS[row.status]}</td>}
              <td className="py-2 pr-4">
                <VacancyActions vacancyId={row.id} status={row.status} appliedOn={row.appliedOn} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
