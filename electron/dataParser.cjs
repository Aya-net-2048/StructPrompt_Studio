const fs = require('fs');
const readline = require('readline');
const Papa = require('papaparse');
const xlsx = require('xlsx');

async function getSample(filePath, limit = 10) {
  if (!filePath) return { columns: [], rows: [] };
  const ext = filePath.split('.').pop().toLowerCase();
  const rows = [];
  let columns = [];

  if (['xls', 'xlsx'].includes(ext)) {
    try {
      const workbook = xlsx.readFile(filePath, { sheetRows: limit + 5 }); // 限制解析行数防卡死
      const sheetName = workbook.SheetNames[0];
      const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
      if (data.length > 0) {
        columns = Object.keys(data[0]);
      }
      return { columns, rows: data.slice(0, limit), totalSize: '已启用轻量化截取' };
    } catch (e) {
      throw new Error("解析 Excel 文件失败");
    }
  }

  return new Promise((resolve, reject) => {
    let stats = fs.statSync(filePath);
    let sizeMb = (stats.size / (1024 * 1024)).toFixed(2) + ' MB';

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
    let isFirstLine = true;
    let count = 0;

    rl.on('line', (line) => {
      if (ext === 'jsonl') {
        try {
           const parsed = JSON.parse(line);
           if (isFirstLine) { columns = Object.keys(parsed); isFirstLine = false; }
           rows.push(parsed);
           count++;
        } catch(e) {}
      } else if (ext === 'csv') {
        // Simple line parser. Real complex CSVs with multilines would need a full stream parser
        const parsedLine = Papa.parse(line).data[0] || [];
        if (isFirstLine) {
           columns = parsedLine;
           isFirstLine = false;
        } else {
           const obj = {};
           columns.forEach((col, i) => obj[col] = parsedLine[i] || '');
           rows.push(obj);
           count++;
        }
      }
      
      if (count >= limit) {
        rl.close();
      }
    });

    rl.on('close', () => {
      fileStream.destroy();
      resolve({ columns, rows, totalSize: sizeMb });
    });
    rl.on('error', reject);
  });
}

module.exports = { getSample };
