// src/app/page.tsx
import { getVacancies } from "@/lib/vacancies/getVacancies";
import { formatKlDate } from "@/lib/format/kualaLumpurTime";

export const dynamic = "force-dynamic";

export default async function Home() {
  const vacancies = await getVacancies();

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-5xl mx-auto flex-col py-12 px-6">
        <h1 className="text-2xl font-semibold mb-6 text-black dark:text-zinc-50">
          Vacancies
        </h1>

        {vacancies.length === 0 ? (
          <p className="text-zinc-600 dark:text-zinc-400">No vacancies yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="py-2 pr-4">Title</th>
                <th className="py-2 pr-4">Company</th>
                <th className="py-2 pr-4">Location</th>
                <th className="py-2 pr-4">First seen</th>
                <th className="py-2 pr-4">Link</th>
              </tr>
            </thead>
            <tbody>
              {vacancies.map((vacancy) => (
                <tr key={vacancy.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-4">{vacancy.title}</td>
                  <td className="py-2 pr-4">{vacancy.company}</td>
                  <td className="py-2 pr-4">{vacancy.location ?? ""}</td>
                  <td className="py-2 pr-4">{formatKlDate(vacancy.firstSeenAt)}</td>
                  <td className="py-2 pr-4">
                    <a
                      href={vacancy.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 underline"
                    >
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}
