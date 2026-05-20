const { Q, X } = require('../db');
const { uid, jsonOk, jsonErr } = require('../utils/helpers');
const { accessRequired } = require('../middleware/auth');

function registerRoutes(router, deps) {
  const { asyncHandler, accessRequired } = deps;
  router.post('/save', accessRequired('setting'), asyncHandler(async (req, res) => {
  try {
    const f = req.body;
    const lid = String(f.id || '').trim();
    const aktif = f.aktif === '1' || f.aktif === true || f.aktif === 1 ? 1 : 0;
    if (lid) {
      await X('UPDATE lokasi SET kode=?,nama=?,jenis=?,aktif=? WHERE id=?', [
        f.kode,
        f.nama,
        f.jenis || 'toko',
        aktif,
        lid,
      ]);
      return jsonOk(res, {}, 'Lokasi diperbarui');
    }
    const newId = f.kode_id || `L${uid().slice(0, 4)}`;
    await X('INSERT INTO lokasi (id,kode,nama,jenis,aktif) VALUES (?,?,?,?,1)', [
      newId,
      f.kode,
      f.nama,
      f.jenis || 'toko',
    ]);
    const barangList = await Q('SELECT id FROM barang');
    for (const b of barangList) {
      await X('INSERT IGNORE INTO stok (id,barang_id,lokasi_id,jumlah) VALUES (?,?,?,0)', [
        uid(),
        b.id,
        newId,
      ]);
    }
    return jsonOk(res, { id: newId }, `Lokasi ${f.nama} ditambahkan`);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.delete('/:lid', accessRequired('setting'), asyncHandler(async (req, res) => {
  try {
    const lid = req.params.lid;
    await X('DELETE FROM stok WHERE lokasi_id=?', [lid]);
    await X('UPDATE pembelian SET lokasi_id=NULL WHERE lokasi_id=?', [lid]);
    await X('UPDATE penjualan SET lokasi_id=NULL WHERE lokasi_id=?', [lid]);
    await X('DELETE FROM lokasi WHERE id=?', [lid]);
    return jsonOk(res, {}, 'Lokasi dihapus');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));
}

module.exports = { registerRoutes };
