const { Q, X } = require('../db');
const { uid, today, jsonOk, jsonErr } = require('../utils/helpers');
const { accessRequired } = require('../middleware/auth');
const { getPrintHeader } = require('../utils/settings');
const { sendExport } = require('../utils/export');

function registerRoutes(router, deps) {
  const { asyncHandler, accessRequired } = deps;
  router.get('/', accessRequired('pembelian'), asyncHandler(async (req, res) => {
  try {
    const { tgl_from = '', tgl_to = '', q = '' } = req.query;
    let sql = `SELECT pb.*,s.nama as supplier_nama,l.nama as lokasi_nama FROM pembelian pb
      LEFT JOIN supplier s ON pb.supplier_id=s.id LEFT JOIN lokasi l ON pb.lokasi_id=l.id WHERE 1=1`;
    const params = [];
    if (tgl_from) { sql += ' AND pb.tgl>=?'; params.push(tgl_from); }
    if (tgl_to) { sql += ' AND pb.tgl<=?'; params.push(tgl_to); }
    if (q) { sql += ' AND pb.no LIKE ?'; params.push(`%${q}%`); }
    const rows = await Q(sql + ' ORDER BY pb.created_at DESC LIMIT 300', params);
    for (const r of rows) {
      r.items = await Q(
        'SELECT pi.*,b.nama as barang_nama FROM pembelian_item pi LEFT JOIN barang b ON pi.barang_id=b.id WHERE pi.pembelian_id=?',
        [r.id],
      );
    }
    const suppliers = await Q("SELECT id,nama FROM supplier WHERE status='aktif' ORDER BY nama");
    const lokasi_list = await Q('SELECT * FROM lokasi WHERE aktif=1');
    const barang_list = await Q('SELECT id,nama,satuan,harga_beli FROM barang ORDER BY nama');
    return jsonOk(res, { rows, tgl_from, tgl_to, q, suppliers, lokasi_list, barang_list });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/save', accessRequired('pembelian'), asyncHandler(async (req, res) => {
  try {
    const f = req.body;
    let pb_id = String(f.id || '').trim();
    const tgl = f.tgl || today();
    const sup = f.supplier_id;
    const lok = f.lokasi_id || 'L1';
    const catatan = f.catatan || '';
    const status = f.status || 'lunas';

    const barang_ids = [].concat(f['barang_id[]'] || f.barang_id || []).filter(Boolean);
    const qtys = [].concat(f['qty[]'] || f.qty || []);
    const harga_belis = [].concat(f['harga_beli[]'] || f.harga_beli || []);

    const items = [];
    for (let i = 0; i < barang_ids.length; i++) {
      const bid = barang_ids[i];
      const q = Number(qtys[i]) || 0;
      const h = Number(harga_belis[i]) || 0;
      if (bid && q > 0) items.push([bid, q, h]);
    }
    if (!items.length) return jsonErr(res, 'Tambahkan minimal satu barang');

    const total = items.reduce((s, [, q, h]) => s + q * h, 0);

    if (pb_id) {
      const old_items = await Q('SELECT barang_id,qty FROM pembelian_item WHERE pembelian_id=?', [pb_id]);
      const old_lok = await Q('SELECT lokasi_id FROM pembelian WHERE id=?', [pb_id], true);
      if (old_lok) {
        for (const oi of old_items) {
          await X(
            "UPDATE stok SET jumlah=jumlah-?,updated_at=datetime('now','localtime') WHERE barang_id=? AND lokasi_id=?",
            [oi.qty, oi.barang_id, old_lok.lokasi_id],
          );
        }
      }
      await X(
        'UPDATE pembelian SET tgl=?,supplier_id=?,lokasi_id=?,total=?,status=?,catatan=? WHERE id=?',
        [tgl, sup, lok, total, status, catatan, pb_id],
      );
      await X('DELETE FROM pembelian_item WHERE pembelian_id=?', [pb_id]);
    } else {
      const no = `BLI-${tgl.replace(/-/g, '')}-${uid().slice(0, 4)}`;
      pb_id = uid();
      await X(
        'INSERT INTO pembelian (id,no,tgl,supplier_id,lokasi_id,total,status,catatan,user_id) VALUES (?,?,?,?,?,?,?,?,?)',
        [pb_id, no, tgl, sup, lok, total, status, catatan, req.user.id],
      );
    }

    for (const [bid, qty, harga] of items) {
      const nama = await Q('SELECT nama FROM barang WHERE id=?', [bid], true);
      await X(
        'INSERT INTO pembelian_item (id,pembelian_id,barang_id,nama,qty,harga_beli,subtotal) VALUES (?,?,?,?,?,?,?)',
        [uid(), pb_id, bid, nama?.nama || '', qty, harga, qty * harga],
      );
      const existing_stok = await Q('SELECT id FROM stok WHERE barang_id=? AND lokasi_id=?', [bid, lok], true);
      if (existing_stok) {
        await X(
          "UPDATE stok SET jumlah=jumlah+?,updated_at=datetime('now','localtime') WHERE barang_id=? AND lokasi_id=?",
          [qty, bid, lok],
        );
      } else {
        await X('INSERT INTO stok (id,barang_id,lokasi_id,jumlah) VALUES (?,?,?,?)', [uid(), bid, lok, qty]);
      }
    }
    return jsonOk(res, {}, pb_id ? 'Pembelian diperbarui' : 'Pembelian disimpan');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.delete('/delete/:pb_id', accessRequired('pembelian'), asyncHandler(async (req, res) => {
  try {
    const pb_id = req.params.pb_id;
    const pb = await Q('SELECT lokasi_id FROM pembelian WHERE id=?', [pb_id], true);
    if (pb) {
      const items = await Q('SELECT barang_id,qty FROM pembelian_item WHERE pembelian_id=?', [pb_id]);
      for (const it of items) {
        await X(
          "UPDATE stok SET jumlah=MAX(0,jumlah-?),updated_at=datetime('now','localtime') WHERE barang_id=? AND lokasi_id=?",
          [it.qty, it.barang_id, pb.lokasi_id],
        );
      }
    }
    await X('DELETE FROM pembelian_item WHERE pembelian_id=?', [pb_id]);
    await X('DELETE FROM pembelian WHERE id=?', [pb_id]);
    return jsonOk(res, {}, 'Pembelian dihapus');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/export', accessRequired('pembelian'), asyncHandler(async (req, res) => {
  try {
    const fmt = req.query.fmt || 'csv';
    const rows = await Q(
      `SELECT pb.no,pb.tgl,s.nama as supplier,l.nama as toko,pb.total,pb.status,pb.catatan
       FROM pembelian pb LEFT JOIN supplier s ON pb.supplier_id=s.id LEFT JOIN lokasi l ON pb.lokasi_id=l.id ORDER BY pb.tgl DESC`,
    );
    const cols = ['no', 'tgl', 'supplier', 'toko', 'total', 'status', 'catatan'];
    return sendExport(fmt, rows, cols, 'Data Pembelian', 'pembelian.xlsx', res);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/print/:pb_id', accessRequired('pembelian'), asyncHandler(async (req, res) => {
  try {
    const pb_id = req.params.pb_id;
    const pb = await Q(
      `SELECT pb.*,s.nama as supplier_nama,l.nama as lokasi_nama FROM pembelian pb
       LEFT JOIN supplier s ON pb.supplier_id=s.id LEFT JOIN lokasi l ON pb.lokasi_id=l.id WHERE pb.id=?`,
      [pb_id],
      true,
    );
    if (!pb) return jsonErr(res, 'Pembelian tidak ditemukan', 404);
    const items = await Q(
      'SELECT pi.*,b.nama as barang_nama FROM pembelian_item pi LEFT JOIN barang b ON pi.barang_id=b.id WHERE pi.pembelian_id=?',
      [pb_id],
    );
    const hdr = await getPrintHeader();
    return jsonOk(res, { pb, items, hdr });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));
}

module.exports = { registerRoutes };
