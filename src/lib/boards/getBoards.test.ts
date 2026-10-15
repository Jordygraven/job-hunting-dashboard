import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getBoards } from "./getBoards";

const ALL = [
  { id: 1, portal: "greenhouse", identifier: "acme", display_name: "Acme" },
  { id: 2, portal: "lever", identifier: "acme", display_name: "Acme" },
];

function fakeClient(pages?: { data: unknown; error: unknown }[]) {
  const eqMock = vi.fn();
  const gtMock = vi.fn();
  let portal = "";
  let call = 0;
  const b: any = {
    select: () => b,
    eq: (col: string, val: string) => { eqMock(col, val); portal = val; return b; },
    order: () => b,
    limit: () => b,
    gt: (...args: any[]) => { gtMock(...args); return b; },
    then: (resolve: any, reject: any) =>
      Promise.resolve(
        pages ? pages[Math.min(call++, pages.length - 1)] : { data: call++ === 0 ? ALL.filter((r) => r.portal === portal) : [], error: null }
      ).then(resolve, reject),
  };
  return { client: { from: () => b } as any, eqMock, gtMock };
}

describe("getBoards", () => {
  test("filters by portal and maps display_name", async () => {
    const { client, eqMock } = fakeClient();
    expect(await getBoards(client, "greenhouse")).toEqual([
      { id: 1, portal: "greenhouse", identifier: "acme", displayName: "Acme" },
    ]);
    expect(eqMock).toHaveBeenCalledWith("portal", "greenhouse");
  });

  test("pages by id ascending keyset", async () => {
    const { client, gtMock } = fakeClient([
      { data: [ALL[0]], error: null },
      { data: [], error: null },
    ]);
    await getBoards(client, "greenhouse");
    expect(gtMock).toHaveBeenCalledWith("id", 1);
  });

  test("throws on a database error", async () => {
    const { client } = fakeClient([{ data: null, error: { message: "boom" } }]);
    await expect(getBoards(client, "greenhouse")).rejects.toThrow("boom");
  });
});
