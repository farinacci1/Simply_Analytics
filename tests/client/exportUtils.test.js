import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadCsv } from '../../client/src/utils/exportUtils';

const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
const mockRevokeObjectURL = vi.fn();
globalThis.URL.createObjectURL = mockCreateObjectURL;
globalThis.URL.revokeObjectURL = mockRevokeObjectURL;
globalThis.Blob = class Blob {
  constructor(parts, opts) {
    this.parts = parts;
    this.type = opts?.type;
    this.content = parts.join('');
  }
};

describe('downloadCsv', () => {
  let clickedLink;

  beforeEach(() => {
    clickedLink = null;
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') {
        const el = { click: vi.fn(), href: '', download: '' };
        clickedLink = el;
        return el;
      }
      return document.createElement(tag);
    });
    vi.clearAllMocks();
  });

  it('generates CSV with header row from column names', () => {
    const data = [
      { NAME: 'Alice', AGE: 30 },
      { NAME: 'Bob', AGE: 25 },
    ];
    downloadCsv(data, ['NAME', 'AGE'], 'test.csv');

    const blob = mockCreateObjectURL.mock.calls[0]?.[0];
    expect(blob).toBeDefined();
    expect(blob.content).toContain('NAME,AGE');
    expect(blob.content).toContain('Alice,30');
    expect(blob.content).toContain('Bob,25');
  });

  it('infers columns from data keys when columns not provided', () => {
    const data = [{ X: 1, Y: 2 }];
    downloadCsv(data, undefined, 'out.csv');

    const blob = mockCreateObjectURL.mock.calls[0]?.[0];
    expect(blob.content).toContain('X,Y');
  });

  it('wraps values containing commas in double quotes', () => {
    const data = [{ NOTE: 'hello, world', VAL: 1 }];
    downloadCsv(data, ['NOTE', 'VAL']);

    const blob = mockCreateObjectURL.mock.calls[0]?.[0];
    expect(blob.content).toContain('"hello, world"');
  });

  it('escapes double quotes by doubling them', () => {
    const data = [{ TEXT: 'He said "hi"' }];
    downloadCsv(data, ['TEXT']);

    const blob = mockCreateObjectURL.mock.calls[0]?.[0];
    expect(blob.content).toContain('"He said ""hi"""');
  });

  it('wraps values containing newlines', () => {
    const data = [{ TEXT: 'line1\nline2' }];
    downloadCsv(data, ['TEXT']);

    const blob = mockCreateObjectURL.mock.calls[0]?.[0];
    expect(blob.content).toContain('"line1\nline2"');
  });

  it('handles null and undefined values as empty strings', () => {
    const data = [{ A: null, B: undefined, C: 'ok' }];
    downloadCsv(data, ['A', 'B', 'C']);

    const blob = mockCreateObjectURL.mock.calls[0]?.[0];
    const lines = blob.content.split('\n');
    expect(lines[1]).toBe(',,ok');
  });

  it('sets the correct filename on the download link', () => {
    downloadCsv([{ A: 1 }], ['A'], 'report.csv');
    expect(clickedLink.download).toBe('report.csv');
  });

  it('triggers a click on the download link', () => {
    downloadCsv([{ A: 1 }], ['A']);
    expect(clickedLink.click).toHaveBeenCalled();
  });

  it('revokes the object URL after download', () => {
    downloadCsv([{ A: 1 }], ['A']);
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('creates CSV with text/csv MIME type', () => {
    downloadCsv([{ A: 1 }], ['A']);
    const blob = mockCreateObjectURL.mock.calls[0]?.[0];
    expect(blob.type).toBe('text/csv');
  });
});
