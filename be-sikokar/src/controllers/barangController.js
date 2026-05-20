const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { Q, X } = require('../db');
const { uid, jsonOk, jsonErr } = require('../utils/helpers');
const { accessRequired } = require('../middleware/auth');
const { sendExport } = require('../utils/export');

const upload = multer({ storage: multer.memoryStorage() });

function registerRoutes(router, deps) {
  const { asyncHandler, accessRequired } = deps;
  router.get('/', accessRequired('barang'), asyncHandler(async (req, res) => {
  try {
    const { q = '', kat = '' } = req.query;
    let sql = `SELECT b.*,s.nama as supplier_nama,
      (SELECT COALESCE(SUM(st.jumlah),0) FROM stok st WHERE st.barang_id=b.id AND st.lokasi_id='L1') as stok_l1,
      (SELECT COALESCE(SUM(st.jumlah),0) FROM stok st WHERE st.barang_id=b.id AND st.lokasi_id='L2') as stok_l2
      FROM barang b LEFT JOIN supplier s ON b.supplier_id=s.id WHERE 1=1`;
    const params = [];
    if (q) {
      sql += ' AND (b.nama LIKE ? OR b.kode LIKE ? OR b.barcode LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (kat) {
      sql += ' AND b.kategori=?';
      params.push(kat);
    }
    const rows = await Q(sql + ' ORDER BY b.kode', params);
    const kats = await Q(
      'SELECT DISTINCT kategori FROM barang WHERE kategori IS NOT NULL ORDER BY kategori',
    );
    const suppliers = await Q(
      "SELECT id,nama FROM supplier WHERE status='aktif' ORDER BY nama",
    );
    const satuan_options = await Q(
      "SELECT * FROM ref_option WHERE group_key='satuan_barang' AND aktif=1 ORDER BY label",
    );
    return jsonOk(res, { rows, kats, suppliers, satuan_options, q, kat });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/save', accessRequired('barang'), asyncHandler(async (req, res) => {
  try {
    const f = req.body;
    const bid = String(f.id || '').trim();
    const vals = [
      f.kode,
      f.barcode,
      f.nama,
      f.kategori,
      f.satuan,
      f.satuan,
      Number(f.harga_beli) || 0,
      Number(f.harga) || 0,
      f.tipe || 'regular',
      f.supplier_id || null,
      f.is_taxable === '1' || f.is_taxable === true || f.is_taxable === 1 ? 1 : 0,
    ];
    if (bid) {
      await X(
        `UPDATE barang SET kode=?,barcode=?,nama=?,kategori=?,satuan=?,satuan_default=?,harga_beli=?,
         harga=?,tipe=?,supplier_id=?,is_taxable=? WHERE id=?`,
        [...vals, bid],
      );
      return jsonOk(res, {}, 'Barang diperbarui');
    }
    const newId = uid();
    await X(
      `INSERT INTO barang (id,kode,barcode,nama,kategori,satuan,satuan_default,harga_beli,harga,tipe,supplier_id,is_taxable)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [newId, ...vals],
    );
    const lokList = await Q('SELECT id FROM lokasi WHERE aktif=1');
    for (const lok of lokList) {
      await X('INSERT IGNORE INTO stok (id,barang_id,lokasi_id,jumlah) VALUES (?,?,?,0)', [
        uid(),
        newId,
        lok.id,
      ]);
    }
    return jsonOk(res, { id: newId }, 'Barang ditambahkan');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.delete('/:bid', accessRequired('barang'), asyncHandler(async (req, res) => {
  try {
    const bid = req.params.bid;
    await X('DELETE FROM stok WHERE barang_id=?', [bid]);
    await X('UPDATE penjualan_item SET barang_id=NULL WHERE barang_id=?', [bid]);
    await X('UPDATE pembelian_item SET barang_id=NULL WHERE barang_id=?', [bid]);
    await X('DELETE FROM barang WHERE id=?', [bid]);
    return jsonOk(res, {}, 'Barang dihapus');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/export', accessRequired('barang'), asyncHandler(async (req, res) => {
  try {
    const fmt = req.query.fmt || 'csv';
    const rows = await Q(
      `SELECT b.kode,b.barcode,b.nama,b.kategori,b.satuan,b.harga_beli,b.harga,b.tipe,b.is_taxable,
        (SELECT COALESCE(SUM(st.jumlah),0) FROM stok st WHERE st.barang_id=b.id AND st.lokasi_id='L1') as stok_km1,
        (SELECT COALESCE(SUM(st.jumlah),0) FROM stok st WHERE st.barang_id=b.id AND st.lokasi_id='L2') as stok_km2
        FROM barang b ORDER BY b.kode`,
    );
    const cols = [
      'kode', 'barcode', 'nama', 'kategori', 'satuan', 'harga_beli', 'harga', 'tipe',
      'is_taxable', 'stok_km1', 'stok_km2',
    ];
    return sendExport(fmt, rows, cols, 'Data Barang', 'barang.xlsx', res);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/import', accessRequired('barang'), upload.single('file'), asyncHandler(async (req, res) => {
  try {
    if (!req.file) return jsonErr(res, 'Pilih file');
    const content = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const reader = parse(content, { columns: true, skip_empty_lines: true });
    let cnt = 0;
    for (const row of reader) {
      const nama = String(row.nama || '').trim();
      const kode = String(row.kode || '').trim();
      if (!nama || !kode) continue;
      const newId = uid();
      await X(
        `INSERT IGNORE INTO barang (id,kode,barcode,nama,kategori,satuan,harga_beli,harga,tipe,is_taxable) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          newId,
          kode,
          row.barcode || '',
          nama,
          row.kategori || '',
          row.satuan || 'pcs',
          Number(row.harga_beli) || 0,
          Number(row.harga) || 0,
          row.tipe || 'regular',
          Number(row.is_taxable) || 0,
        ],
      );
      const lokList = await Q('SELECT id FROM lokasi WHERE aktif=1');
      for (const lok of lokList) {
        await X('INSERT IGNORE INTO stok (id,barang_id,lokasi_id,jumlah) VALUES (?,?,?,0)', [
          uid(),
          newId,
          lok.id,
        ]);
      }
      cnt++;
    }
    return jsonOk(res, { count: cnt }, `${cnt} barang diimport`);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));
}

module.exports = { registerRoutes };
