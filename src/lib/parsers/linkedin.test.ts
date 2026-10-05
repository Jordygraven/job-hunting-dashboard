import { describe, expect, test } from 'vitest';
import { parseLinkedInAlert, uniqueByJobId } from './linkedin';

function noUrls(snippet: string) {
  expect(snippet).not.toMatch(/https?:\/\//);
}

describe('parseLinkedInAlert', () => {
  test('parses a card without a location', () => {
    const text = `Subject: Widget Engineer bij Acme

Widget Engineer
Acme
Vacature weergeven: https://www.linkedin.com/comm/jobs/view/1000000001/?[stripped]
`;
    const { cards, failures, warnings } = parseLinkedInAlert(text);

    expect(failures).toEqual([]);
    expect(warnings).toEqual([]);
    expect(cards).toEqual([
      {
        jobId: '1000000001',
        title: 'Widget Engineer',
        company: 'Acme',
        location: null,
        url: 'https://www.linkedin.com/jobs/view/1000000001/',
      },
    ]);
  });

  test('parses the same job twice in one email as two cards', () => {
    const card = `Widget Engineer
Acme
Remote
Vacature weergeven: https://www.linkedin.com/comm/jobs/view/1000000002/?[stripped]`;
    const text = `Subject: Widget Engineer bij Acme

${card}

---------------------------------------------------------

${card}
`;
    const { cards, failures, warnings } = parseLinkedInAlert(text);

    expect(failures).toEqual([]);
    expect(warnings).toEqual([]);
    expect(cards).toHaveLength(2);
    expect(cards[0].jobId).toBe('1000000002');
    expect(cards[1].jobId).toBe('1000000002');
  });

  test('ignores a section header containing a raw <strong> tag', () => {
    const text = `Subject: Widget Engineer bij Acme

Vacatures voor <strong class="font-bold">Widget Engineer</strong> in Remote

Widget Engineer
Acme
Remote
Vacature weergeven: https://www.linkedin.com/comm/jobs/view/1000000003/?[stripped]
`;
    const { cards, failures, warnings } = parseLinkedInAlert(text);

    expect(failures).toEqual([]);
    expect(warnings).toEqual([]);
    expect(cards).toEqual([
      {
        jobId: '1000000003',
        title: 'Widget Engineer',
        company: 'Acme',
        location: 'Remote',
        url: 'https://www.linkedin.com/jobs/view/1000000003/',
      },
    ]);
  });

  test('does not count "Meldingen beheren" as a card', () => {
    const text = `Subject: Widget Engineer bij Acme

Meldingen beheren: [link]

Widget Engineer
Acme
Remote
Vacature weergeven: https://www.linkedin.com/comm/jobs/view/1000000004/?[stripped]
`;
    const { cards, failures, warnings } = parseLinkedInAlert(text);

    expect(failures).toEqual([]);
    expect(warnings).toEqual([]);
    expect(cards).toHaveLength(1);
    expect(cards[0].title).toBe('Widget Engineer');
  });

  test('extracts the job id from a link with a full tracking query string', () => {
    const text = `Subject: Widget Engineer bij Acme

Widget Engineer
Acme
Remote
Vacature weergeven: https://www.linkedin.com/comm/jobs/view/1000000005/?trackingId=abcDEF123%3D%3D&refId=xyz789&midToken=foo&lipi=urn%3Ali%3Apage%3Aemail
`;
    const { cards, failures, warnings } = parseLinkedInAlert(text);

    expect(failures).toEqual([]);
    expect(warnings).toEqual([]);
    expect(cards).toEqual([
      {
        jobId: '1000000005',
        title: 'Widget Engineer',
        company: 'Acme',
        location: 'Remote',
        url: 'https://www.linkedin.com/jobs/view/1000000005/',
      },
    ]);
  });

  test('reports a failure when a card is missing its company', () => {
    const text = `Subject: Widget Engineer bij Acme

Widget Engineer
Vacature weergeven: https://www.linkedin.com/comm/jobs/view/1000000006/?[stripped]
`;
    const { cards, failures, warnings } = parseLinkedInAlert(text);

    expect(cards).toEqual([]);
    expect(warnings).toEqual([]);
    expect(failures).toHaveLength(1);
    noUrls(failures[0].snippet);
  });

  test('reports a failure when the link has no numeric job id', () => {
    const text = `Subject: Widget Engineer bij Acme

Widget Engineer
Acme
Remote
Vacature weergeven: https://www.linkedin.com/comm/jobs/view/?[stripped]
`;
    const { cards, failures, warnings } = parseLinkedInAlert(text);

    expect(cards).toEqual([]);
    expect(warnings).toEqual([]);
    expect(failures).toHaveLength(1);
    noUrls(failures[0].snippet);
  });

  test('keeps the card and warns on an unrecognized badge line', () => {
    const text = `Subject: Widget Engineer bij Acme

Widget Engineer
Acme
Remote
Nieuwe badge soort
Vacature weergeven: https://www.linkedin.com/comm/jobs/view/1000000007/?[stripped]
`;
    const { cards, failures, warnings } = parseLinkedInAlert(text);

    expect(failures).toEqual([]);
    expect(cards).toEqual([
      {
        jobId: '1000000007',
        title: 'Widget Engineer',
        company: 'Acme',
        location: 'Remote',
        url: 'https://www.linkedin.com/jobs/view/1000000007/',
      },
    ]);
    expect(warnings).toHaveLength(1);
    noUrls(warnings[0].snippet);
  });

  test('treats a bare production tracking link (not the "[link]" placeholder) as junk, not card content', () => {
    const text = `Subject: Widget Engineer bij Acme

Zoek slimmer naar een baan met Premium
https://www.linkedin.com/premium/some-real-tracking-url?trk=abc123
Widget Engineer
Acme
Remote
Vacature weergeven: https://www.linkedin.com/comm/jobs/view/1000000009/?[stripped]
`;
    const { cards, failures, warnings } = parseLinkedInAlert(text);

    expect(failures).toEqual([]);
    expect(warnings).toEqual([]);
    expect(cards).toEqual([
      {
        jobId: '1000000009',
        title: 'Widget Engineer',
        company: 'Acme',
        location: 'Remote',
        url: 'https://www.linkedin.com/jobs/view/1000000009/',
      },
    ]);
  });

  test('does not let promo text leak into the title when it directly precedes a card with no separator', () => {
    const text = `Subject: Widget Engineer bij Acme

Zoek slimmer naar een baan met Premium
[link]
Widget Engineer
Acme
Remote
Vacature weergeven: https://www.linkedin.com/comm/jobs/view/1000000010/?[stripped]
`;
    const { cards, failures, warnings } = parseLinkedInAlert(text);

    expect(failures).toEqual([]);
    expect(warnings).toEqual([]);
    expect(cards[0].title).toBe('Widget Engineer');
    expect(cards[0].company).toBe('Acme');
  });

  test('recognizes known badge lines without warning', () => {
    const text = `Subject: Widget Engineer bij Acme

Widget Engineer
Acme
Remote
Dit bedrijf werft actief nieuwe medewerkers
Solliciteren met cv en profiel
3 connecties
Vacature weergeven: https://www.linkedin.com/comm/jobs/view/1000000008/?[stripped]
`;
    const { cards, failures, warnings } = parseLinkedInAlert(text);

    expect(failures).toEqual([]);
    expect(warnings).toEqual([]);
    expect(cards).toHaveLength(1);
  });
});

describe('uniqueByJobId', () => {
  test('keeps the first occurrence of each jobId', () => {
    const first = {
      jobId: '1',
      title: 'First',
      company: 'Acme',
      location: null,
      url: 'https://www.linkedin.com/jobs/view/1/',
    };
    const duplicate = { ...first, title: 'First (duplicate)' };
    const second = {
      jobId: '2',
      title: 'Second',
      company: 'Acme',
      location: null,
      url: 'https://www.linkedin.com/jobs/view/2/',
    };

    const result = uniqueByJobId([first, duplicate, second]);

    expect(result).toEqual([first, second]);
  });
});
