// src/lib/format/kualaLumpurTime.ts
const KL_TIME_ZONE = "Asia/Kuala_Lumpur";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: KL_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: KL_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatKlDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

export function formatKlDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso)).replace(" at ", ", ");
}
