import { DatabaseSync } from 'node:sqlite';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Quote CSV cells and prevent spreadsheet formulas from participant-entered text.
function cell(value, text = false) {
  let raw = String(value ?? '');
  if (text || /^[\s]*[=+\-@]/.test(raw) || /^[\t\r\n]/.test(raw)) raw = `'${raw}`;
  return `"${raw.replaceAll('"', '""')}"`;
}

export function exportPassports(databasePath, outputPath) {
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const emailColumn = db.prepare('PRAGMA table_info(runs)').all().some(column => column.name === 'email') ? 'email' : "'' AS email";
    const rows = db.prepare(`SELECT passport_number, first_name, last_name, company, contact, phone, telegram, ${emailColumn}, difficulty,
      rooms, budget, received_at, assigned_at, runs.id FROM run_passports JOIN runs ON runs.id = run_passports.run_id
      ORDER BY assigned_at, runs.rowid`).all();
    const columns = ['Номер паспорта', 'Имя', 'Фамилия', 'Компания', 'Контакт', 'Телефон', 'Telegram', 'Почта', 'Сложность', 'Комнат пройдено', 'Бюджет', 'Время результата (UTC)', 'Время привязки (UTC)', 'ID попытки'];
    const difficulties = { easy: 'Лёгкая', standard: 'Стандартная', hardcore: 'Сложная' };
    const lines = rows.map(row => [cell(row.passport_number, true), cell(row.first_name), cell(row.last_name), cell(row.company),
      cell(row.contact, true), cell(row.phone, !!row.phone), cell(row.telegram, !!row.telegram), cell(row.email), cell(difficulties[row.difficulty] || row.difficulty), cell(row.rooms), cell(row.budget),
      cell(row.received_at), cell(row.assigned_at), cell(row.id)].join(';'));
    writeFileSync(outputPath, `\uFEFF${[columns.map(value => cell(value)).join(';'), ...lines].join('\r\n')}\r\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    return rows.length;
  } finally { db.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [databasePath, outputPath] = process.argv.slice(2);
  if (!databasePath || !outputPath) {
    console.error('Укажите базу и новый файл CSV: node server/export-passports.mjs /path/leaderboard.sqlite /path/passports.csv');
    process.exitCode = 1;
  } else {
    try { console.log(`Выгружено паспортов: ${exportPassports(databasePath, outputPath)}. Файл: ${outputPath}`); }
    catch (error) { console.error(`Не удалось выгрузить паспорта: ${error.message}`); process.exitCode = 1; }
  }
}
