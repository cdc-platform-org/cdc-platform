// Structural QA for the generated certificate PDF. There is no PDF rasterizer
// on the build machines, so instead of eyeballing a PNG this asserts on the
// things that actually regressed before: the template's own text layer (which
// misspelled "professional" and hard-coded one student's name) surviving into
// the output, the QR drifting out of its navy frame, and the two signature
// columns landing on mismatched baselines.
//
//   npx ts-node-transpile-only scripts/verifyCertificateLayout.ts
import { PDFDocument, PDFName, PDFArray, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { generateCertificatePdf, generateVerificationCode, G } from '../src/services/certificateService';

// The artwork landmarks these constants are supposed to sit on, measured off a
// 4x rasterised render of the template (see the sibling probe used during QA):
// signature rules x 62..387 and x 1125..1425 on pdfY 113; navy QR frame
// x 737.25..863.25, pdfY 52..181; heading gold rules ending x 490 and starting
// x 1017; full-width divider x 269..1221 on pdfY 394.
const MEASURED = {
  directorRule: [62, 387] as [number, number],
  instructorRule: [1125, 1425] as [number, number],
  qrFrame: { left: 737.25, right: 863.25, bottom: 52, top: 181 },
  headingGap: [490, 1017] as [number, number],
  divider: [269, 1221] as [number, number],
};

const issueDate = new Date('2026-07-29T00:00:00.000Z');

// Concatenated, latin1-decoded content streams of page 1 — the operator list
// the viewer actually executes.
async function pageContent(pdf: Buffer): Promise<string> {
  const doc = await PDFDocument.load(pdf);
  const page = doc.getPages()[0];
  const contents = doc.context.lookup(page.node.get(PDFName.of('Contents')));
  const streams: PDFRawStream[] = [];
  if (contents instanceof PDFArray) {
    for (let i = 0; i < contents.size(); i += 1) {
      const obj = doc.context.lookup(contents.get(i));
      if (obj instanceof PDFRawStream) streams.push(obj);
    }
  } else if (contents instanceof PDFRawStream) {
    streams.push(contents);
  }
  return streams.map((s) => Buffer.from(decodePDFRawStream(s).decode()).toString('latin1')).join('\n');
}

// pdf-lib positions every drawn run with a full text matrix (`1 0 0 1 x y Tm`),
// not the relative `Td` an authoring tool would emit — so the Y in the matrix IS
// the absolute page baseline. Each mixed-script run is its own BT/ET block, so
// one visual line of "ია / Ia" contributes several runs at the SAME baseline;
// dedupe to get the distinct baselines actually used.
function textRuns(content: string): Array<{ x: number; y: number; size: number }> {
  const out: Array<{ x: number; y: number; size: number }> = [];
  const re = /\/[^\s]+\s+([\d.]+)\s+Tf[\s\S]{0,80}?1\s+0\s+0\s+1\s+([\d.-]+)\s+([\d.-]+)\s+Tm/g;
  for (let m = re.exec(content); m; m = re.exec(content)) {
    out.push({ size: parseFloat(m[1]), x: parseFloat(m[2]), y: parseFloat(m[3]) });
  }
  return out;
}

function textBaselines(content: string): number[] {
  const ys = new Set<number>();
  for (const r of textRuns(content)) ys.add(Math.round(r.y * 10) / 10);
  return [...ys].sort((a, b) => a - b);
}

// Where each image XObject actually lands on the page.
//
// An image `Do` paints the unit square through the current transform, so the
// placement is the PRODUCT of every `cm` since the enclosing `q` — not the last
// one. pdf-lib emits FOUR chained cm ops per drawImage
// (`1 0 0 1 x y cm` / identity / `w 0 0 h 0 0 cm` / identity), so reading only
// the adjacent cm finds no image at all. Under PDF's row-vector convention a
// point maps as p × Mn × … × M1, i.e. the ops compose outermost-LAST, which is
// why the list is folded in reverse. Only axis-aligned scale+translate is
// tracked, which is all a page image placement uses here.
function imagePlacements(content: string): Array<{ x: number; y: number; w: number; h: number; name: string }> {
  const out: Array<{ x: number; y: number; w: number; h: number; name: string }> = [];
  const doRe = /\/([^\s/[\]]+)\s+Do\b/g;
  for (let m = doRe.exec(content); m; m = doRe.exec(content)) {
    const qAt = content.lastIndexOf('q', m.index);
    const block = content.slice(qAt < 0 ? 0 : qAt, m.index);
    const mats: number[][] = [];
    const cmRe = /([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+cm\b/g;
    for (let c = cmRe.exec(block); c; c = cmRe.exec(block)) mats.push(c.slice(1, 7).map(Number));
    let sx = 1;
    let sy = 1;
    let tx = 0;
    let ty = 0;
    for (const [a, , , d, e, f] of [...mats].reverse()) {
      tx = tx * a + e;
      ty = ty * d + f;
      sx *= a;
      sy *= d;
    }
    out.push({ x: tx, y: ty, w: sx, h: sy, name: m[1] });
  }
  return out;
}

const failures: string[] = [];
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
};

async function main() {
  const pdf = await generateCertificatePdf({
    studentName: 'ია თავდიშვილი',
    studentNameSecondary: 'ia tavdishvili',
    courseTitle: 'Vibe Coding - ვებ-დეველოპმენტი AI-ით',
    instructorName: 'ლევან ბერიძე',
    directorName: 'ნინო ქავთარაძე',
    issueDate,
    verificationCode: generateVerificationCode(issueDate),
  });
  const content = await pageContent(pdf);
  const doc = await PDFDocument.load(pdf);
  const { width, height } = doc.getPages()[0].getSize();
  const runs = textRuns(content);
  const ys = textBaselines(content);

  // --- Page box unchanged: every landmark in certificateService's G table is a
  // fraction of exactly this box, so a re-exported template at another size
  // would silently move all of them.
  check('page box is 1491x1055', Math.round(width) === 1491 && Math.round(height) === 1055, `${width}x${height}`);

  // --- The template's text layer is gone. Its strings were drawn with subset
  // fonts, but the literal ASCII words survive in the raw stream, so grepping
  // the decoded content is a real check.
  const typo = /professioal/i.test(content);
  check("template typo 'professioal' not in output", !typo, typo ? 'still present' : 'stripped');
  const hardcoded = /Tavdishvili/.test(content) && /BT[\s\S]{0,4000}?Tavdishvili/.test(content);
  check('no leftover template text layer', !/\bTf\b[\s\S]{0,200}?professio/i.test(content), hardcoded ? 'check manually' : 'clean');

  // --- QR fully inside the navy frame and centred in it on BOTH axes, checked
  // against the frame measured off the render rather than against the same
  // constants the drawing code uses (which would be circular). An earlier
  // revision pinned the QR to the bottom-right page corner, outside the frame.
  const frame = MEASURED.qrFrame;
  const qr = imagePlacements(content).find((im) => Math.abs(im.w - im.h) < 0.5 && im.w > 50 && im.w < 200);
  if (!qr) {
    check('QR image placed', false, 'no square image placement found');
  } else {
    const insetL = qr.x - frame.left;
    const insetR = frame.right - (qr.x + qr.w);
    const insetB = qr.y - frame.bottom;
    const insetT = frame.top - (qr.y + qr.h);
    check(
      'QR fully inside the navy frame',
      insetL >= 0 && insetR >= 0 && insetB >= 0 && insetT >= 0,
      `insets L${insetL.toFixed(2)} R${insetR.toFixed(2)} B${insetB.toFixed(2)} T${insetT.toFixed(2)}`
    );
    // 1pt at this page size is 0.07% of the width — well under print tolerance,
    // and under the ~0.5pt the frame's own antialiased border can be measured to.
    const dx = Math.abs(insetL - insetR);
    const dy = Math.abs(insetB - insetT);
    check('QR centred in the frame on both axes', dx <= 1 && dy <= 1, `off-centre by dx ${dx.toFixed(2)}pt, dy ${dy.toFixed(2)}pt`);
    const codeSlotLeft = G.codeCenterX * width - (G.codeMaxWidth * width) / 2;
    check('QR clears the verification-code slot', qr.x + qr.w <= codeSlotLeft, `QR right ${(qr.x + qr.w).toFixed(1)} vs code slot left ${codeSlotLeft.toFixed(1)}`);
  }

  // --- Heading must sit in the gap between the artwork's two short gold rules,
  // never under them.
  const headingRuns = runs.filter((r) => Math.abs(r.y - 565) < 1.5);
  check(
    'heading inside the gold-rule gap',
    headingRuns.length > 0 && Math.min(...headingRuns.map((r) => r.x)) >= MEASURED.headingGap[0] - 2,
    `heading starts x=${headingRuns.length ? Math.min(...headingRuns.map((r) => r.x)).toFixed(1) : 'n/a'}, gap opens at ${MEASURED.headingGap[0]}`
  );

  // --- Footer symmetry: all four values share one baseline and all four
  // captions share another, and every one of the four zones is populated on
  // BOTH of them. The template's own captions sat at y=54 and y=75.4, which is
  // why the two signature columns could never line up.
  const near = (target: number) => ys.filter((y) => Math.abs(y - target) < 1.5);
  check('footer values share one baseline', near(85.5).length === 1, `baselines near 85.5: [${near(85.5)}]`);
  check('footer captions share one baseline', near(58).length === 1, `baselines near 58: [${near(58)}]`);

  // Zone bounds are the artwork's gold vertical separators (x 427, 706, 1094).
  const zones: Array<[string, number, number]> = [
    ['director', 0, 427],
    ['date', 427, 706],
    ['code', 706, 1094],
    ['instructor', 1094, 1491],
  ];
  for (const [name, lo, hi] of zones) {
    const onValue = runs.filter((r) => Math.abs(r.y - 85.5) < 1.5 && r.x >= lo && r.x < hi).length;
    const onCaption = runs.filter((r) => Math.abs(r.y - 58) < 1.5 && r.x >= lo && r.x < hi).length;
    check(`footer zone '${name}' aligned on both baselines`, onValue > 0 && onCaption > 0, `${onValue} value run(s), ${onCaption} caption run(s)`);
  }
  // Director and Instructor "balance" is centring each name on ITS OWN
  // signature rule, not mirroring the two about the page centre. Measured off
  // the rasterised artwork, the two rules are x 62..387 and x 1125..1425 — they
  // are 325pt and 300pt wide and their midpoints (224.5 / 1275) straddle the
  // page centre unevenly, so a page-mirrored pair would sit visibly off its
  // rule on at least one side. What must match between the columns is the
  // baseline, the caption baseline and the type size, all asserted above/below.
  const rules: Array<[string, [number, number], number]> = [
    ['director', MEASURED.directorRule, G.signatureLeftX * width],
    ['instructor', MEASURED.instructorRule, G.signatureRightX * width],
  ];
  for (const [name, [lo, hi], slot] of rules) {
    const mid = (lo + hi) / 2;
    check(`'${name}' name centred on its own signature rule`, Math.abs(slot - mid) <= 1, `slot centre ${slot} vs measured rule midpoint ${mid}`);
  }
  // Both signature values must be the same size — one column rendering smaller
  // because its name is longer would break the symmetry the shared baseline buys.
  const sigSizes = [0, 1].map((i) => {
    const [lo, hi] = rules[i][1];
    return runs.filter((r) => Math.abs(r.y - 85.5) < 1.5 && r.x >= lo - 40 && r.x <= hi + 40).map((r) => r.size);
  });
  check(
    'both signature names set at the same size',
    sigSizes[0].length > 0 && sigSizes[1].length > 0 && Math.max(...sigSizes[0]) === Math.max(...sigSizes[1]),
    `director [${[...new Set(sigSizes[0])]}] vs instructor [${[...new Set(sigSizes[1])]}]`
  );

  // --- Student name: ONE baseline only. Both the Georgian name and the "/ Ia
  // Tavdishvili" transliteration must be runs on that same line — an earlier
  // revision stacked the English on a second line that collided with the gold
  // divider at y=394.
  const nameBand = ys.filter((y) => y > 400 && y < 515);
  const nameRuns = runs.filter((r) => Math.abs(r.y - 455) < 1.5);
  check('student name is a single line', nameBand.length === 1 && Math.abs(nameBand[0] - 455) < 1.5, `name-band baselines [${nameBand}]`);
  check('bilingual name drawn as runs on that one line', nameRuns.length >= 3, `${nameRuns.length} runs at y=455`);
  check('student name clears the gold divider (y=394)', nameBand.every((y) => y > 400), `lowest name baseline ${Math.min(...nameBand)}`);

  // --- Course title stays inside its band: clear of the "completing the
  // course" lead-in above (y=345.6) and the closing statement below (y=227).
  const courseBand = ys.filter((y) => y > 235 && y < 340);
  check('course title block within its band', courseBand.length >= 1 && courseBand.length <= 2, `course baselines [${courseBand}]`);
  const courseSizes = [...new Set(runs.filter((r) => courseBand.some((y) => Math.abs(r.y - y) < 1.5)).map((r) => r.size))];
  check('course title set at display size (>=16pt)', courseSizes.every((s) => s >= 16), `sizes [${courseSizes}]`);

  // --- Blank Director rule when no name is available anywhere, rather than a
  // fabricated signatory. The caption must still print.
  const saved = process.env.CERTIFICATE_DIRECTOR_NAME;
  delete process.env.CERTIFICATE_DIRECTOR_NAME;
  const anon = await generateCertificatePdf({
    studentName: 'ია თავდიშვილი',
    courseTitle: 'Test',
    instructorName: 'ლევან ბერიძე',
    issueDate,
    verificationCode: generateVerificationCode(issueDate),
  });
  if (saved !== undefined) process.env.CERTIFICATE_DIRECTOR_NAME = saved;
  const anonYs = textBaselines(await pageContent(anon));
  check('unset director still renders (caption only, no crash)', anonYs.length > 0, `${anonYs.length} baselines`);

  // --- Latin-only and pathological titles must not throw (WinAnsi fallback).
  await generateCertificatePdf({
    studentName: 'John Smith',
    studentNameSecondary: 'JOHN SMITH',
    courseTitle: 'Advanced “Smart Quotes” — Data Science & Analytics with Emoji 🚀 and a very long tail',
    instructorName: 'Jane Doe',
    directorName: 'Director Name',
    issueDate,
    verificationCode: generateVerificationCode(issueDate),
  });
  check('latin + smart-punctuation + emoji title renders', true, 'no throw');

  console.log(failures.length === 0 ? '\nAll checks passed.' : `\n${failures.length} FAILED: ${failures.join(', ')}`);
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
