
const PDFDocument = require('pdfkit');
const fs = require('fs');

function generatePDF(data, filePath) {
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(filePath));
  doc.fontSize(18).text("MMPZ Performance Report");
  doc.moveDown();

  data.forEach(row => {
    doc.fontSize(12).text(
      `Year: ${row.year} | Avg Performance: ${row.avg_performance} | Avg Risk: ${row.avg_risk}`
    );
  });

  doc.end();
}

module.exports = { generatePDF };
