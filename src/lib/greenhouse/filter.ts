import {
  EXCLUDE_TITLE_TERMS,
  INCLUDE_TITLE_TERMS,
  LOCATION_EXACT,
  LOCATION_FAIL_TERMS,
  LOCATION_PLACE_TERMS,
  LOCATION_REMOTE_REGION_TERMS,
} from "../../config/greenhouseFilter";

const WORD_CHAR = "\\p{L}\\p{N}";

function wholeWord(term: string): RegExp {
  const escaped = term
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  return new RegExp(`(?<![${WORD_CHAR}])${escaped}(?![${WORD_CHAR}])`, "iu");
}

function compile(terms: string[]): RegExp[] {
  return terms.map(wholeWord);
}

const includeTitle = compile(INCLUDE_TITLE_TERMS);
const excludeTitle = compile(EXCLUDE_TITLE_TERMS);
const failLocation = compile(LOCATION_FAIL_TERMS);
const placeLocation = compile(LOCATION_PLACE_TERMS);
const remoteWord = wholeWord("remote");
const remoteRegions = compile(LOCATION_REMOTE_REGION_TERMS);

const anyMatch = (patterns: RegExp[], text: string) => patterns.some((p) => p.test(text));

export function passesTitle(title: string): boolean {
  return anyMatch(includeTitle, title) && !anyMatch(excludeTitle, title);
}

function locationPartPasses(rawPart: string): boolean {
  const part = rawPart.trim();
  if (part === "") return false;
  if (anyMatch(failLocation, part)) return false;
  if (anyMatch(placeLocation, part)) return true;
  if (part.toLowerCase() === LOCATION_EXACT) return true;
  return remoteWord.test(part) && anyMatch(remoteRegions, part);
}

export function passesLocation(location: string | null): boolean {
  if (!location) return false;
  return location.split(";").some(locationPartPasses);
}

export function passesFilter(title: string, location: string | null): boolean {
  return passesTitle(title) && passesLocation(location);
}
