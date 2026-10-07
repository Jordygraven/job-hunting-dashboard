import { describe, expect, test } from "vitest";
import { parseLinkedInAlert } from "../parsers/linkedin";
import { toSyncWarnings } from "./syncWarnings";

describe("toSyncWarnings", () => {
  test("maps a parse warning to {messageId, jobId, reason}, dropping the snippet", () => {
    const text = `Subject: Widget Engineer bij Acme

Widget Engineer
Acme
Remote
Nieuwe badge soort
Vacature weergeven: https://www.linkedin.com/comm/jobs/view/1000000007/?[stripped]
`;
    const { warnings } = parseLinkedInAlert(text);
    expect(warnings).toHaveLength(1);

    const result = toSyncWarnings("msg-1", warnings);

    expect(result).toEqual([
      { messageId: "msg-1", jobId: "1000000007", reason: "unrecognized extra line inside card" },
    ]);
  });

  test("returns an empty array when there are no warnings", () => {
    expect(toSyncWarnings("msg-1", [])).toEqual([]);
  });
});
