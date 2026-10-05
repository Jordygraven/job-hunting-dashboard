import { describe, expect, test } from "vitest";
import { parseLinkedInAlert } from "../parsers/linkedin";
import { toParserFailures } from "./parserFailures";

describe("toParserFailures", () => {
  test("maps a parser failure to {messageId, reason}, dropping the snippet", () => {
    const text = `Subject: Widget Engineer bij Acme

Widget Engineer
Vacature weergeven: https://www.linkedin.com/comm/jobs/view/1000000006/?[stripped]
`;
    const { failures } = parseLinkedInAlert(text);
    expect(failures).toHaveLength(1);

    const result = toParserFailures("msg-1", failures);

    expect(result).toEqual([
      { messageId: "msg-1", reason: "card is missing a title or company" },
    ]);
  });

  test("returns an empty array when there are no failures", () => {
    expect(toParserFailures("msg-1", [])).toEqual([]);
  });
});
