// Smoke-renders a certificate PDF with representative bilingual data so the
// layout can be eyeballed / measured without going through the LMS flow.
//   npx ts-node-transpile-only scripts/renderTestCertificate.ts [outPath]
//
// For assertions rather than eyeballing, see verifyCertificateLayout.ts, which
// checks the drawn geometry against the artwork landmarks.
//
// NOTE: directorName below is placeholder demo data and does NOT match the
// scanned signature baked into the template artwork — in production this comes
// from CERTIFICATE_DIRECTOR_NAME, which must match that signature (see
// utils/env.ts).
import fs from 'fs';
import path from 'path';
import { generateCertificatePdf, generateVerificationCode } from '../src/services/certificateService';

async function main() {
  const outPath = process.argv[2] || path.join(__dirname, '..', 'certificate-test.pdf');
  const issueDate = new Date('2026-07-29T00:00:00.000Z');
  const pdf = await generateCertificatePdf({
    studentName: 'ია თავდიშვილი',
    studentNameSecondary: 'ia tavdishvili',
    courseTitle: 'გრაფიკული დიზაინი და AI ხელსაწყოები',
    courseTitleEn: 'Graphic Design & AI Tools',
    instructorName: 'ლევან ბერიძე',
    directorName: 'ნინო ქავთარაძე',
    issueDate,
    verificationCode: generateVerificationCode(issueDate),
  });
  fs.writeFileSync(outPath, pdf);
  console.log(`wrote ${outPath} (${pdf.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
