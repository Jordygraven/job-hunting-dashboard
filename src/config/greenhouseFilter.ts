// All terms are matched case-insensitively as whole words.

export const INCLUDE_TITLE_TERMS = [
  "AI Consultant",
  "GenAI Product Manager",
  "Agentic AI",
  "AI Automation",
  "AI Product Manager",
  "AI Specialist",
  "Product Lead",
  "Product Owner",
  "Product Manager",
];

export const EXCLUDE_TITLE_TERMS = [
  "Head of",
  "Director",
  "VP",
  "Vice President",
  "Chief",
  "Junior",
  "Intern",
  "Internship",
];

// A location part containing any of these fails, even if it also contains a pass term.
export const LOCATION_FAIL_TERMS = ["klang", "penang", "johor", "sarawak"];

export const LOCATION_PLACE_TERMS = [
  "kuala lumpur",
  "selangor",
  "petaling jaya",
  "cyberjaya",
  "putrajaya",
  "shah alam",
  "subang",
  "bangsar",
  "mont kiara",
  "cheras",
  "ampang jaya",
  "bukit jalil",
  "puchong",
];

// A trimmed location part equal to this passes.
export const LOCATION_EXACT = "malaysia";

// A location part with "remote" passes if it also contains any of these.
export const LOCATION_REMOTE_REGION_TERMS = ["malaysia", "apac", "southeast asia"];
