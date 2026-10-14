import { describe, expect, test } from "vitest";
import { parseLinkedInAlert } from "../parsers/linkedin";
import { toParserFailures } from "./parserFailures";

describe("toParserFailures", () => {
  test("maps a parser failure to {messageId, jobId, reason}, dropping the snippet", () => {
    const text = `Subject: Widget Engineer bij Acme

Widget Engineer
Vacature weergeven: https://www.linkedin.com/comm/jobs/view/1000000006/?[stripped]
`;
    const { failures } = parseLinkedInAlert(text);
    expect(failures).toHaveLength(1);

    const result = toParserFailures("msg-1", failures);

    expect(result).toEqual([
      { messageId: "msg-1", jobId: "1000000006", reason: "card is missing a title or company", source: "linkedin" },
    ]);
  });

  test("carries a null jobId when the anchor link itself had no numeric id", () => {
    const text = `Subject: Widget Engineer bij Acme

Widget Engineer
Acme
Remote
Vacature weergeven: https://www.linkedin.com/comm/jobs/view/?[stripped]
`;
    const { failures } = parseLinkedInAlert(text);
    expect(failures).toHaveLength(1);

    const result = toParserFailures("msg-1", failures);

    expect(result).toEqual([
      { messageId: "msg-1", jobId: null, reason: "anchor link has no numeric job id", source: "linkedin" },
    ]);
  });

  test("returns an empty array when there are no failures", () => {
    expect(toParserFailures("msg-1", [])).toEqual([]);
  });
});
