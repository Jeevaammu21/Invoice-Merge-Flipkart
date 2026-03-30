const pdfParse = require('pdf-parse/lib/pdf-parse.js');
const fs = require('fs');
const buf = fs.readFileSync('/mnt/user-data/uploads/INVOICE_2622830.pdf');
pdfParse(buf).then(d => {
  console.log('=== READABLE ===');
  console.log(d.text);
});
