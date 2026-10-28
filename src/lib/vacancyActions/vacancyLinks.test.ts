import { describe, expect, test } from "vitest";
import { buildVacancyHref } from "./vacancyLinks";

describe("buildVacancyHref", () => {
  test("a bare view produces just the view param", () => {
    expect(buildVacancyHref({ view: "todo" })).toBe("/?view=todo");
  });

  test("includes reasonFilter when set", () => {
    expect(buildVacancyHref({ view: "ignored", reasonFilter: "language" })).toBe(
      "/?view=ignored&reason=language"
    );
  });

  test("omits reasonFilter when null or absent", () => {
    expect(buildVacancyHref({ view: "ignored", reasonFilter: null })).toBe("/?view=ignored");
    expect(buildVacancyHref({ view: "ignored" })).toBe("/?view=ignored");
  });

  test("includes status only on the all/interest views, even if passed for another view", () => {
    expect(buildVacancyHref({ view: "all", status: "applied" })).toBe("/?view=all&status=applied");
    expect(buildVacancyHref({ view: "interest", status: "applied" })).toBe(
      "/?view=interest&status=applied"
    );
    expect(buildVacancyHref({ view: "todo", status: "applied" })).toBe("/?view=todo");
  });

  test("includes pilot=1 only when pilot is true", () => {
    expect(buildVacancyHref({ view: "todo", pilot: true })).toBe("/?view=todo&pilot=1");
    expect(buildVacancyHref({ view: "todo", pilot: false })).toBe("/?view=todo");
  });

  test("omits show at the default (10), includes it otherwise", () => {
    expect(buildVacancyHref({ view: "todo", show: 10 })).toBe("/?view=todo");
    expect(buildVacancyHref({ view: "todo", show: 20 })).toBe("/?view=todo&show=20");
    expect(buildVacancyHref({ view: "todo", show: "all" })).toBe("/?view=todo&show=all");
  });

  test("includes q, company, from, to when set, omits them when null or empty", () => {
    expect(
      buildVacancyHref({ view: "todo", q: "engineer", company: "Acme", from: "2026-10-01", to: "2026-10-31" })
    ).toBe("/?view=todo&q=engineer&company=Acme&from=2026-10-01&to=2026-10-31");
    expect(buildVacancyHref({ view: "todo", q: null, company: null, from: null, to: null })).toBe(
      "/?view=todo"
    );
  });

  test("combines every param together, in a stable order", () => {
    expect(
      buildVacancyHref({
        view: "all",
        reasonFilter: null,
        status: "ignored",
        show: 20,
        q: "engineer",
        company: "Acme",
        from: "2026-10-01",
        to: "2026-10-31",
        sort: "status",
        dir: "desc",
      })
    ).toBe(
      "/?view=all&status=ignored&show=20&q=engineer&company=Acme&from=2026-10-01&to=2026-10-31&sort=status&dir=desc"
    );
  });

  test("includes sort and dir when the column is sortable on the view", () => {
    expect(buildVacancyHref({ view: "todo", sort: "title", dir: "asc" })).toBe(
      "/?view=todo&sort=title&dir=asc"
    );
  });

  test("drops sort and dir when the column isn't sortable on the target view", () => {
    expect(buildVacancyHref({ view: "todo", sort: "status", dir: "asc" })).toBe("/?view=todo");
    expect(buildVacancyHref({ view: "todo", sort: "appliedOn", dir: "asc" })).toBe("/?view=todo");
  });

  test("omits sort and dir when null or absent, or when only one of the pair is set", () => {
    expect(buildVacancyHref({ view: "todo", sort: null, dir: null })).toBe("/?view=todo");
    expect(buildVacancyHref({ view: "todo" })).toBe("/?view=todo");
    expect(buildVacancyHref({ view: "todo", sort: "title" })).toBe("/?view=todo");
    expect(buildVacancyHref({ view: "todo", dir: "asc" })).toBe("/?view=todo");
  });
});
