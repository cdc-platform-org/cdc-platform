import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const TEMPLATE_PATH = path.join(__dirname, '..', '..', 'public', 'templates', 'certificate-template.pdf');

export class CertificateTemplateMissingError extends Error {
  constructor() {
    super(`Certificate template not found at ${TEMPLATE_PATH}.`);
    this.name = 'CertificateTemplateMissingError';
  }
}

export interface CertificateData {
  studentName: string;
  courseTitle: string;
  instructorName: string;
  issueDate: Date;
  verificationCode: string;
}

// CDC-CERT-YYYYMMDD-XXXXXXXX — short enough to print/read, random enough not
// to be guessable, and includes the date for a quick human sanity check.
export function generateVerificationCode(issueDate: Date): string {
  const datePart = issueDate.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `CDC-CERT-${datePart}-${randomPart}`;
}

function fitText(font: { widthOfTextAtSize: (t: string, s: number) => number }, text: string, maxWidth: number, startSize: number, minSize: number): number {
  let size = startSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 1;
  }
  return size;
}

export async function generateCertificatePdf(data: CertificateData): Promise<Buffer> {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new CertificateTemplateMissingError();
  }
  const templateBytes = fs.readFileSync(TEMPLATE_PATH);
  const doc = await PDFDocument.load(templateBytes);
  const page = doc.getPages()[0];
  const { width, height } = page.getSize();

  const serifBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const serif = await doc.embedFont(StandardFonts.Helvetica);

  const navy = rgb(0.06, 0.09, 0.16);
  const slate = rgb(0.35, 0.4, 0.48);
  const maxTextWidth = width - 160;

  // Student name — large, centered, in the blank band above the template's
  // gold divider line (see the template generator for the reserved layout).
  const nameSize = fitText(serifBold, data.studentName, maxTextWidth, 34, 18);
  const nameWidth = serifBold.widthOfTextAtSize(data.studentName, nameSize);
  page.drawText(data.studentName, {
    x: width / 2 - nameWidth / 2,
    y: height - 288,
    size: nameSize,
    font: serifBold,
    color: navy,
  });

  // Course title — centered, just under the "for successfully completing…" line.
  const courseSize = fitText(serifBold, data.courseTitle, maxTextWidth, 20, 12);
  const courseWidth = serifBold.widthOfTextAtSize(data.courseTitle, courseSize);
  page.drawText(data.courseTitle, {
    x: width / 2 - courseWidth / 2,
    y: height - 360,
    size: courseSize,
    font: serifBold,
    color: navy,
  });

  // Instructor name, above the "Instructor" signature line (left footer).
  page.drawText(data.instructorName, {
    x: 90,
    y: 106,
    size: 12,
    font: serif,
    color: navy,
  });

  // Issue date, above the "Issue Date" signature line (right footer).
  const dateText = data.issueDate.toISOString().slice(0, 10);
  const dateWidth = serif.widthOfTextAtSize(dateText, 12);
  page.drawText(dateText, {
    x: width - 260 + (170 - dateWidth) / 2,
    y: 106,
    size: 12,
    font: serif,
    color: navy,
  });

  // Verification code, bottom-left corner.
  page.drawText(`Verification code: ${data.verificationCode}`, {
    x: 48,
    y: 40,
    size: 9,
    font: serif,
    color: slate,
  });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
