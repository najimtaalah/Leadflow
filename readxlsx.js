const XLSX = require('./node_modules/xlsx');
const wb = XLSX.readFile('C:/Users/Me/Downloads/gestion_formations_v2.xlsx');
wb.SheetNames.forEach(name => {
  console.log('\n====== FEUILLE: ' + name + ' ======');
  const ws = wb.Sheets[name];
  const data = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
  data.forEach(row => {
    const vals = row.filter(v => v !== '');
    if(vals.length) console.log(vals.join(' | '));
  });
});
