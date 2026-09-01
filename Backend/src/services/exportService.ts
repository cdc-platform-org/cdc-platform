import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell } from 'docx';
import PDFDocument from 'pdfkit';
import fs from 'fs';

export async function generateDocx(content: { title: string; sections: { heading: string; body: string[] }[] }, filePath: string) {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: content.sections.map((section) => [
          new Paragraph({
            text: section.heading,
            heading: 'Heading1',
            thematicBreak: true,
          }),
          ...section.body.map((text) =>
            new Paragraph({
              children: [new TextRun({ text, font: 'Sylfaen' })],
            })
          ),
        ]).flat(),
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(filePath, buffer);
}

export async function generatePdf(content: { title: string; sections: { heading: string; body: string[] }[] }, filePath: string) {
  const doc = new PDFDocument({ size: 'A4', margin: 50, ownerPassword: process.env.PDF_OWNER_PASSWORD || undefined });
  const stream = fs.createWriteStream(filePath);

  doc.pipe(stream);

  doc.font('DejaVuSans.ttf').fontSize(20).text(content.title, { align: 'center' });

  content.sections.forEach((section) => {
    doc.moveDown().fontSize(16).text(section.heading, { underline: true });
    section.body.forEach((text) => {
      doc.moveDown().fontSize(12).text(text);
    });
  });

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}
