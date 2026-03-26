const XLSX = require('./node_modules/xlsx');
const wb = XLSX.readFile('C:/Users/Me/Downloads/gestion_formations_v2.xlsx', {
  cellFormula: true,
  cellHTML: false,
  cellText: true,
  raw: false
});

wb.SheetNames.forEach(name => {
  console.log('\n====== FEUILLE: ' + name + ' ======');
  const ws = wb.Sheets[name];
  // Get the range
  const range = ws['!ref'];
  if (!range) { console.log('(vide)'); return; }

  const decoded = XLSX.utils.decode_range(range);
  for (let R = decoded.s.r; R <= decoded.e.r; R++) {
    const rowVals = [];
    for (let C = decoded.s.c; C <= decoded.e.c; C++) {
      const cellAddr = XLSX.utils.encode_cell({r: R, c: C});
      const cell = ws[cellAddr];
      if (cell) {
        // Show formula or value
        if (cell.f) rowVals.push('F:' + cell.f);
        else if (cell.v !== undefined) rowVals.push(String(cell.v));
        else rowVals.push('');
      } else {
        rowVals.push('');
      }
    }
    const nonEmpty = rowVals.filter(v => v !== '');
    if (nonEmpty.length > 0) console.log(rowVals.join(' | '));
  }
});
