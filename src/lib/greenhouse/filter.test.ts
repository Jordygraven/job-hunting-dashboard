import { describe, expect, test } from "vitest";
import { passesFilter } from "./filter";

const KL = "Kuala Lumpur, Malaysia";

const cases: [string, string | null, boolean][] = [
  ["Data Product Manager", KL, true],
  ["Platform Product Manager", "Kuala Lumpur, Malaysia ", true],
  ["Spot Product Manager", "Abu Dhabi, UAE", false],
  ["Head of Platform Product", KL, false],
  ["Senior Product Manager", "Abu Dhabi, UAE; Kuala Lumpur, Malaysia", true],
  ["Product Owner", "APAC - Remote, Remote - SEA, Malaysia", true],
  ["Product Owner", "Germany - Remote, LATAM - Remote, Seattle, WA Remote", false],
  ["Product Owner", "Klang, Selangor, Malaysia", false],
  ["International Product Manager", "Kuala Lumpur", true],
  ["Junior Product Manager", "Kuala Lumpur", false],
  ["Product Manager Intern", "Kuala Lumpur", false],
  ["Product Manager Internship", "Kuala Lumpur", false],
  ["Associate Product Manager", "Kuala Lumpur", true],
  ["AI Specialist", "Cyberjaya, Selangor", true],
  ["Principal AI Agent Development Engineer/Architect", KL, false],
  ["Principal Product Manager", KL, true],
  ["Lead Product Manager", KL, true],
  ["Vice President, Product Manager", KL, false],
  ["VP Product Manager", KL, false],
  ["Director, Product Manager", KL, false],
  ["Chief Product Manager", KL, false],
  ["product manager", "KUALA LUMPUR", true],
  ["Product Manager", "Penang, Malaysia", false],
  ["Product Manager", "Johor Bahru, Malaysia", false],
  ["Product Manager", "Kuching, Sarawak, Malaysia", false],
  ["Product Manager", "Malaysia", true],
  ["Product Manager", " Malaysia ; Dubai", true],
  ["Product Manager", "Malaysia Airlines Hub", false],
  ["Product Manager", "Seattle, WA; Remote - Seattle", false],
  ["Product Manager", "SF, SEA, NY, Remote-US", false],
  ["Product Manager", "Remote - Southeast Asia", true],
  ["Product Manager", "Remote", false],
  ["Product Manager", "", false],
  ["Product Manager", null, false],
];

describe("passesFilter", () => {
  test.each(cases)("%s | %s -> %s", (title, location, expected) => {
    expect(passesFilter(title, location)).toBe(expected);
  });
});
