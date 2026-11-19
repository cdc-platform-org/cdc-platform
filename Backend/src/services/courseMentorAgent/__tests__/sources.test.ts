/**
 * Unit tests for Course Mentor source extraction (no network, no AI):
 * share-link rewriting, YouTube ids, SSRF guard, HTML/RTF/ZIP-based formats.
 */
import JSZip from 'jszip';
import { rewriteShareLink, youtubeVideoId, assertPublicHost } from '../sources/urlSources';
import { extractTextFromFile, htmlToText, extensionOf } from '../sources/fileExtractors';

jest.mock('../../ai/aiAgentService', () => ({ callTextModel: jest.fn() }));

describe('links', () => {
  it('rewrites Google share links to exports', () => {
    expect(rewriteShareLink('https://docs.google.com/document/d/abc_123/edit?usp=sharing')).toBe('https://docs.google.com/document/d/abc_123/export?format=docx');
    expect(rewriteShareLink('https://docs.google.com/presentation/d/XYZ/edit')).toBe('https://docs.google.com/presentation/d/XYZ/export?format=pptx');
    expect(rewriteShareLink('https://drive.google.com/file/d/FILE1/view?usp=sharing')).toBe('https://drive.google.com/uc?export=download&id=FILE1');
    expect(rewriteShareLink('https://example.com/a.pdf')).toBe('https://example.com/a.pdf');
  });

  it('recognises YouTube links', () => {
    expect(youtubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeVideoId('https://youtu.be/dQw4w9WgXcQ?t=3')).toBe('dQw4w9WgXcQ');
    expect(youtubeVideoId('https://www.youtube.com/shorts/abcdefgh')).toBe('abcdefgh');
    expect(youtubeVideoId('https://example.com/watch?v=1')).toBeNull();
  });

  it('blocks private and non-http targets (SSRF)', async () => {
    await expect(assertPublicHost(new URL('http://127.0.0.1/admin'))).rejects.toThrow();
    await expect(assertPublicHost(new URL('http://169.254.169.254/latest/meta-data'))).rejects.toThrow();
    await expect(assertPublicHost(new URL('http://10.0.0.5/'))).rejects.toThrow();
    await expect(assertPublicHost(new URL('http://[::1]/'))).rejects.toThrow();
    await expect(assertPublicHost(new URL('ftp://example.com/x'))).rejects.toThrow();
    await expect(assertPublicHost(new URL('http://user:pw@8.8.8.8/'))).rejects.toThrow();
  });
});

describe('file formats', () => {
  it('extensionOf handles double extensions', () => {
    expect(extensionOf('Book.PDF.txt')).toBe('txt');
    expect(extensionOf('noext')).toBe('');
  });

  it('HTML keeps headings and drops scripts/nav', () => {
    const text = htmlToText('<html><body><nav>menu</nav><main><h2>ცვლადები</h2><p>ტექსტი</p><script>evil()</script></main></body></html>');
    expect(text).toContain('## ცვლადები');
    expect(text).toContain('ტექსტი');
    expect(text).not.toContain('evil');
    expect(text).not.toContain('menu');
  });

  it('reads PPTX slides and notes', async () => {
    const zip = new JSZip();
    zip.file('ppt/slides/slide2.xml', '<p:sld xmlns:a="a" xmlns:p="p"><a:p><a:r><a:t>Second</a:t></a:r></a:p></p:sld>');
    zip.file('ppt/slides/slide1.xml', '<p:sld xmlns:a="a" xmlns:p="p"><a:p><a:r><a:t>First </a:t></a:r><a:r><a:t>slide</a:t></a:r></a:p></p:sld>');
    zip.file('ppt/notesSlides/notesSlide1.xml', '<p:notes xmlns:a="a" xmlns:p="p"><a:t>speaker note</a:t></p:notes>');
    const { text } = await extractTextFromFile(await zip.generateAsync({ type: 'nodebuffer' }), 'deck.pptx', '');
    expect(text.indexOf('First slide')).toBeLessThan(text.indexOf('Second'));
    expect(text).toContain('speaker note');
  });

  it('reads XLSX with shared strings', async () => {
    const zip = new JSZip();
    zip.file('xl/sharedStrings.xml', '<sst><si><t>Name</t></si><si><t>Score</t></si><si><t>ნინო</t></si></sst>');
    zip.file('xl/worksheets/sheet1.xml', '<worksheet><sheetData><row><c t="s"><v>0</v></c><c t="s"><v>1</v></c></row><row><c t="s"><v>2</v></c><c><v>95</v></c></row></sheetData></worksheet>');
    const { text } = await extractTextFromFile(await zip.generateAsync({ type: 'nodebuffer' }), 'grades.xlsx', '');
    expect(text).toContain('Name | Score');
    expect(text).toContain('ნინო | 95');
  });

  it('reads ODT and RTF', async () => {
    const zip = new JSZip();
    zip.file('content.xml', '<office:document-content xmlns:text="t" xmlns:office="o"><text:h>Title</text:h><text:p>Body text</text:p></office:document-content>');
    const odt = await extractTextFromFile(await zip.generateAsync({ type: 'nodebuffer' }), 'a.odt', '');
    expect(odt.text).toBe('Title\nBody text');
    const rtf = await extractTextFromFile(Buffer.from('{\\rtf1\\ansi Hello\\par World}'), 'a.rtf', '');
    expect(rtf.text).toContain('Hello');
    expect(rtf.text).toContain('World');
  });

  it('rejects unknown formats', async () => {
    await expect(extractTextFromFile(Buffer.from('x'), 'a.exe', '')).rejects.toThrow(/Unsupported/);
  });
});
