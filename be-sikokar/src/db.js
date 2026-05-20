const knex = require('knex');
const knexConfig = require('../knexfile');
const env = process.env.NODE_ENV || 'development';

const db = knex(knexConfig[env] || knexConfig.development);

/** Adapt SQLite-oriented SQL for MySQL */
function fixSql(sql) {
  return sql
    .replace(/datetime\('now','localtime'\)/gi, 'NOW()')
    .replace(/substr\(/gi, 'SUBSTRING(')
    .replace(/date\('now','\+30 days'\)/gi, 'DATE_ADD(CURDATE(), INTERVAL 30 DAY)')
    .replace(/date\('now','\+60 days'\)/gi, 'DATE_ADD(CURDATE(), INTERVAL 60 DAY)')
    .replace(/INSERT OR IGNORE/gi, 'INSERT IGNORE')
    .replace(/UPDATE piutang SET saldo=MAX\(0,saldo-/gi, 'UPDATE piutang SET saldo=GREATEST(0,saldo-')
    .replace(/UPDATE stok SET jumlah=MAX\(0,jumlah-/gi, 'UPDATE stok SET jumlah=GREATEST(0,jumlah-');
}

function rowsFromRaw(result) {
  if (result == null) return [];

  let rows;
  if (Array.isArray(result)) {
    // Knex/mysql2 SELECT: result is already [row, row, ...]
    // Raw driver tuple: [[row, ...], fieldPackets]
    rows = result.length > 0 && Array.isArray(result[0]) ? result[0] : result;
  } else if (typeof result === 'object') {
    rows = [result];
  } else {
    return [];
  }

  return rows.map((row) => (row && typeof row === 'object' ? { ...row } : row));
}

/** Query — returns array of row objects, or single row if one=true */
async function Q(sql, params = [], one = false) {
  const [result] = await db.raw(fixSql(sql), params);
  const rows = rowsFromRaw(result);
  return one ? rows[0] ?? null : rows;
}

/** Execute — insert/update/delete */
async function X(sql, params = []) {
  const [result] = await db.raw(fixSql(sql), params);
  return result?.insertId ?? null;
}

/** Multi-statement transaction (replaces PRAGMA foreign_keys OFF) */
async function Xfk(statements) {
  await db.transaction(async (trx) => {
    for (const [sql, params] of statements) {
      await trx.raw(fixSql(sql), params ?? []);
    }
  });
}

/** Upsert setting key */
async function upsertSetting(key, value) {
  await db.raw(
    'INSERT INTO setting (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
    [key, value],
  );
}

module.exports = { db, fixSql, Q, X, Xfk, upsertSetting };
