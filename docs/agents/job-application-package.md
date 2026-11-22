# CV and cover letter agent

This is the Claude skill I used to produce a tailored CV and cover letter for each vacancy. One skill does both.

**Read this first.** I set this up to meet my own requirements. It reflects my document layout, my writing style and my way of keeping proof of my work. Treat it as a starting point and change it to fit yours. The next section lists what I chose and how you can adapt each choice.

## How it works

A Claude skill is a plain Markdown file with instructions. When you paste a job description and ask for a CV and cover letter, Claude follows the steps in the file. There is no code to run. The skill relies on three things you keep up to date yourself:

1. **A library of your achievements.** Short case studies with the facts, the numbers and a note on what you may and may not claim. This is the single source of truth for everything the agent writes.
2. **A master CV.** The full version of your CV. The agent copies it and never edits the original.
3. **A cover letter template.** The layout and sign-off you want. The agent copies it and only replaces the body.

For each vacancy the agent compares the job description with your library and master CV, asks about real gaps in one message, then drafts both documents as copies of your master files.

## What I chose and how to adapt it

| My choice | Why I made it | How you can adapt it |
| --- | --- | --- |
| The agent stops if it cannot read my achievements library | I never want invented claims in an application | Keep this rule. It protects you more than anything else here |
| Cover letter of about 150 words | Short letters get read | Change the length, or the structure of hook, bullets and closing line |
| CV bullets of at most 20 words, with the proof point underlined | Scannable for a hurried reader | Change the limit and the formatting to your own style |
| The master CV and template are never edited | The originals stay clean | Keep this, but point the skill at your own files |
| Output as two Google Docs that I finish and export myself | I like to make the final edits by hand | Switch to Word files or plain text if you do not use Google Docs |
| No narration of each tool step, and short chat messages | It saves time and tokens | Remove it if you want to see every step |
| Plain, direct sentences with no em dashes or semicolons | My personal writing style | Replace with your own style rules |

## The skill template

Save this as `SKILL.md` inside a skill folder, replace every placeholder in capitals, and adjust the rules to your needs.

````markdown
---
name: job-application-package
description: Draft a tailored cover letter and CV for one specific job vacancy, using my achievements library and master CV as the source of truth. Use whenever I paste a job description and ask for a cover letter, a tailored CV or an application package.
---

# Job application package

Produces a tailored CV and cover letter for one job as two documents in my own format. I iterate on them myself and submit them myself.

## Requirements before starting

This skill needs access to the place where my documents live (for example Google Drive and Google Docs). If it is missing, say so in one line and stop.

## Source of truth

- Achievements library: YOUR_ACHIEVEMENTS_LIBRARY. Follow its statuses and its "do not claim" notes exactly. If the library cannot be read, say so and stop. Do not draft from memory.
- Master CV: YOUR_MASTER_CV. Never edit the master. Read it fresh each time.
- Cover letter template: YOUR_COVER_LETTER_TEMPLATE. Never edit the template.
- How to describe my most recent role: YOUR_PREFERRED_WORDING.

## What to collect first

Ask for, if not already given: the full job description, the company name and role title, and the vacancy link.

## Gap check

Compare the job description with the library and the master CV. Ask only about genuine gaps, all in one message. If there are none, go straight to drafting.

## Cover letter content

Length: about 150 words between the greeting and the sign-off.
Structure:
1. A personal hook of one to two sentences, grounded in something specific in the job description.
2. A short transition line.
3. Two to four bullets. Each is a bold short label plus one sentence, grounded in real proof from the library.
4. A short forward-looking closing line tied to the company.
5. The sign-off stays as in the template.

## CV content

Start from the master CV, reordered and reworded for this job. Do not invent experience. Every achievement bullet has a maximum of 20 words, bold label included. Count before writing. Underline the proof point in each bullet.

## Build the documents

1. Copy the master CV. Title the copy "CV - COMPANY - DATE".
2. Copy the template. Title the copy "Cover Letter - COMPANY - DATE".
3. Edit both copies in place. Change only the paragraphs that need changing and keep the existing styles.
4. Read both copies once to check that the text landed in the right place.

## Delivery

Link both documents in one sentence. Then add at most three short lines: what changed compared with the master CV, a layout check for me, and a reminder that submitting is my own step.

## Style

YOUR_STYLE_RULES.
````

## Good to know

- The skill writes and edits documents. It does not apply for jobs, and it does not send anything.
- My achievements library and master CV are personal, so they are not part of this repository. You need to build your own.
- Claude can help you build that library. Ask it to turn each achievement into a short case study with the situation, task, action, result and reflection, plus a note on what you may not claim.
