const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { Q, X, Xfk } = require('../db');
const { uid, today, nowStr, jsonOk, jsonErr, fmtRp } = require('../utils/helpers');
const { accessRequired } = require('../middleware/auth');
const {
  getSetting,
  getPpnRate,
  getLimitKreditToko,
  getOrCreateLimitToko,
  getPrintHeader,
} = require('../utils/settings');
const { sendExport } = require('../utils/export');
const { audit } = require('../utils/audit');

const upload = multer({ storage: multer.memoryStorage() });

function normalizePromoIds(data) {
  const raw = Array.isArray(data.promo_ids)
    ? data.promo_ids
    : String(data.promo_ids || data.promo_id || '')
      .split(',');
  return [...new Set(raw.map((id) => String(id || '').trim()).filter(Boolean))];
}

function calculatePromoDiscount(pr, items, subtotal, anggotaId) {
  const totalQty = items.reduce((s, it) => s + Number(it.qty), 0);
  const memberOk = !Number(pr.member_only) || !!anggotaId;
  if (!memberOk || totalQty < (Number(pr.min_qty) || 1) || subtotal < (Number(pr.min_total) || 0)) {
    return 0;
  }

  const promoBarangId = String(pr.barang_id || '').trim();
  const promoKategori = String(pr.kategori || '').trim();
  let basis = 0;
  for (const it of items) {
    const itemKategori = String(it.kategori || '').trim();
    const match =
      (promoBarangId && promoBarangId === it.id) ||
      (promoKategori && promoKategori === itemKategori) ||
      (!promoBarangId && !promoKategori);
    if (match) basis += Number(it.harga) * Number(it.qty);
  }
  if (basis <= 0) return 0;

  return pr.tipe === 'persen'
    ? Math.round((basis * (Number(pr.nilai) || 0)) / 100)
    : Math.min(Number(pr.nilai) || 0, basis);
}

function registerRoutes(router, deps) {
  const { asyncHandler, accessRequired } = deps;
  router.get('/', accessRequired('toko'), asyncHandler(async (req, res) => {
  try {
    const u = req.user;
    const lokasi_id = u.lokasi_id || 'L1';
    const lokasi_list = await Q("SELECT * FROM lokasi WHERE jenis='toko' AND aktif=1");
    const kats = await Q(
      'SELECT DISTINCT b.kategori FROM barang b WHERE b.kategori IS NOT NULL ORDER BY b.kategori',
    );
    const anggota_list = await Q(
      "SELECT id,no,nama,limit_kredit FROM anggota WHERE status='aktif' ORDER BY nama",
    );
    const ppn_rate = Number(await getSetting('ppn_rate', '12'));
    const member_discount_pct = Number(await getSetting('member_discount_pct', '0')) || 0;
    return jsonOk(res, { lokasi_id, lokasi_list, kats, anggota_list, ppn_rate, member_discount_pct });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/products', accessRequired('toko'), asyncHandler(async (req, res) => {
  try {
    const lokasi_id = req.query.lokasi || 'L1';
    const q = req.query.q || '';
    const kat = req.query.kat || '';
    let sql = `SELECT b.id,b.kode,b.barcode,b.nama,b.harga,COALESCE(b.satuan_default,b.satuan,'PCS') as satuan,b.is_taxable,b.tipe,b.kategori,
      COALESCE(s.jumlah,0) as stok FROM barang b LEFT JOIN stok s ON b.id=s.barang_id AND s.lokasi_id=?
      WHERE COALESCE(s.jumlah,0)>0`;
    const params = [lokasi_id];
    if (q) {
      sql += ' AND (b.nama LIKE ? OR b.kode LIKE ? OR b.barcode LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (kat) {
      sql += ' AND b.kategori=?';
      params.push(kat);
    }
    const rows = await Q(sql + ' ORDER BY b.nama', params);
    return jsonOk(res, { rows });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/piutang/:anggota_id', accessRequired('toko'), asyncHandler(async (req, res) => {
  try {
    const a = await Q('SELECT id,nama,limit_kredit FROM anggota WHERE id=?', [req.params.anggota_id], true);
    const p = await Q('SELECT saldo FROM piutang WHERE anggota_id=?', [req.params.anggota_id], true);
    const saldo = p?.saldo ?? 0;
    const limit = a?.limit_kredit ?? 0;
    return jsonOk(res, { limit, used: saldo, available: limit - saldo });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/promo_active', accessRequired('toko'), asyncHandler(async (req, res) => {
  try {
    const t = today();
    const rows = await Q(
      `SELECT * FROM promo WHERE status='aktif'
       AND (tgl_mulai='' OR tgl_mulai <= ?) AND (tgl_akhir='' OR tgl_akhir >= ?)
       ORDER BY nilai DESC`,
      [t, t],
    );
    return jsonOk(res, { rows });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/checkout', accessRequired('toko'), asyncHandler(async (req, res) => {
  try {
    const data = req.body || {};
    const lokasi_id = data.lokasi_id || 'L1';
    let jenis = data.jenis || 'cash';
    const anggota_id = data.anggota_id || null;
    let payment_channel = data.payment_channel || jenis;
    if (['kredit', 'potong_gaji'].includes(payment_channel)) jenis = payment_channel;

    const pkp = !!data.pkp;
    const items = data.items || [];
    const diskon_global = Number(data.diskon_global) || 0;
    let promo_id = '';
    let promo_diskon = 0;
    const over_limit_approved = !!(data.over_limit_approved || data.approval_over_limit);
    const ppn_rate = await getPpnRate();

    if (!items.length) return jsonErr(res, 'Keranjang kosong');

    for (const it of items) {
      const srow = await Q('SELECT jumlah FROM stok WHERE barang_id=? AND lokasi_id=?', [it.id, lokasi_id], true);
      const qty = Number(it.qty) || 0;
      if (qty <= 0) return jsonErr(res, 'Qty tidak valid');
      if (!srow || srow.jumlah < qty) {
        return jsonErr(res, `Stok ${it.nama || 'barang'} tidak cukup`);
      }
    }

    const subtotal = items.reduce((s, it) => s + Number(it.harga) * Number(it.qty), 0);
    const item_diskon = items.reduce(
      (s, it) => s + Number(it.harga) * Number(it.qty) * (Number(it.diskon_pct) || 0) / 100,
      0,
    );

    const promoIds = normalizePromoIds(data);
    if (promoIds.length) {
      let serverPromo = 0;
      const appliedPromoIds = [];
      for (const pid of promoIds) {
        const pr = await Q(
          `SELECT * FROM promo WHERE id=? AND status='aktif' AND (tgl_mulai='' OR tgl_mulai<=?) AND (tgl_akhir='' OR tgl_akhir>=?)`,
          [pid, today(), today()],
          true,
        );
        if (!pr) continue;
        const discount = calculatePromoDiscount(pr, items, subtotal, anggota_id);
        if (discount <= 0) continue;
        serverPromo += discount;
        appliedPromoIds.push(pid);
      }
      promo_id = appliedPromoIds[0] || '';
      promo_diskon = Math.min(Number(data.promo_diskon) || serverPromo, serverPromo);
    }

    let member_diskon_pct = 0;
    if (anggota_id) {
      member_diskon_pct = Number(await getSetting('member_discount_pct', '0')) || 0;
    }
    const member_diskon = Math.round(
      Math.max(0, subtotal - item_diskon - diskon_global - promo_diskon) * (member_diskon_pct / 100),
    );
    const total_diskon = item_diskon + diskon_global + promo_diskon + member_diskon;
    let ppn_total = 0;
    if (pkp) {
      for (const it of items) {
        const net = Number(it.harga) * Number(it.qty) * (1 - (Number(it.diskon_pct) || 0) / 100);
        if (it.is_taxable) ppn_total += net * ppn_rate;
      }
    }
    const total = Math.max(0, subtotal - total_diskon + ppn_total);

    const open_shift = await Q(
      "SELECT id FROM pos_shift WHERE user_id=? AND status='open' ORDER BY tgl_buka DESC LIMIT 1",
      [req.user.id],
      true,
    );

    if (['kredit', 'potong_gaji'].includes(jenis) && anggota_id) {
      const ang = await Q('SELECT limit_kredit,status FROM anggota WHERE id=?', [anggota_id], true);
      if (!ang || ang.status !== 'aktif') return jsonErr(res, 'Anggota tidak aktif');
      const bulan_ini = today().slice(0, 7);
      const lmt = await getOrCreateLimitToko(anggota_id, bulan_ini);
      if (lmt.status === 'suspend') {
        return jsonErr(res, 'Kredit toko ditangguhkan — ada piutang bulan lalu yang belum dibayar.');
      }
      const sisa_bulanan = (await getLimitKreditToko()) - lmt.terpakai;
      if (total > sisa_bulanan) {
        return jsonErr(res, `Melebihi limit bulanan. Sisa: ${fmtRp(sisa_bulanan)}.`);
      }
    }

    const td = today();
    const no = `JL-${td.replace(/-/g, '')}-${uid().slice(0, 4)}`;
    const pj_id = uid();

    await X(
      `INSERT INTO penjualan (id,no,tgl,lokasi_id,jenis,anggota_id,subtotal,diskon_total,ppn_total,total,pkp,status,kasir_id,shift_id,promo_id,diskon,payment_channel,approval_over_limit)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        pj_id,
        no,
        td,
        lokasi_id,
        jenis,
        anggota_id,
        subtotal,
        total_diskon,
        ppn_total,
        total,
        pkp ? 1 : 0,
        'lunas',
        req.user.id,
        open_shift?.id || '',
        promo_id,
        promo_diskon,
        payment_channel,
        over_limit_approved ? 1 : 0,
      ],
    );

    for (const it of items) {
      const qty = Number(it.qty) || 0;
      const harga = Number(it.harga) || 0;
      const gross = harga * qty;
      const disc = gross * ((Number(it.diskon_pct) || 0) / 100);
      const net = gross - disc;
      const ppn = pkp && it.is_taxable ? net * ppn_rate : 0;
      await X(
        `INSERT INTO penjualan_item (id,penjualan_id,barang_id,nama,qty,harga,diskon_pct,diskon,ppn,subtotal) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [uid(), pj_id, it.id, it.nama, qty, harga, Number(it.diskon_pct) || 0, disc, ppn, net + ppn],
      );
      await X(
        'UPDATE stok SET jumlah=jumlah-?,updated_at=NOW() WHERE barang_id=? AND lokasi_id=?',
        [qty, it.id, lokasi_id],
      );
    }

    if (['kredit', 'potong_gaji'].includes(jenis) && anggota_id) {
      if (await Q('SELECT id FROM piutang WHERE anggota_id=?', [anggota_id], true)) {
        await X('UPDATE piutang SET saldo=saldo+?,updated_at=NOW() WHERE anggota_id=?', [
          total,
          anggota_id,
        ]);
      } else {
        await X('INSERT INTO piutang (id,anggota_id,saldo) VALUES (?,?,?)', [
          uid(),
          anggota_id,
          total,
        ]);
      }
      await X(
        'UPDATE limit_kredit_toko SET terpakai=terpakai+? WHERE anggota_id=? AND bulan=?',
        [total, anggota_id, today().slice(0, 7)],
      );
    }

    await X(
      'INSERT INTO jurnal (id,no,tgl,modul,ref,ket,debit,kredit,nominal,user_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [
        uid(),
        `JRN-${uid()}`,
        td,
        'Penjualan',
        no,
        `Penjualan ${jenis}`,
        ['kredit', 'potong_gaji'].includes(jenis) ? 'Piutang Anggota' : 'Kas',
        'Penjualan',
        total,
        req.user.id,
      ],
    );
    await audit('toko', 'checkout', 'penjualan', pj_id, null, { no, total, diskon: total_diskon }, 'Checkout POS');
    return jsonOk(res, { ok: true, no, total, pj_id });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/struk/:pj_id', accessRequired('toko'), asyncHandler(async (req, res) => {
  try {
    const pj = await Q(
      `SELECT p.*,a.nama as anggota_nama,l.nama as lokasi_nama FROM penjualan p
       LEFT JOIN anggota a ON p.anggota_id=a.id LEFT JOIN lokasi l ON p.lokasi_id=l.id WHERE p.id=?`,
      [req.params.pj_id],
      true,
    );
    if (!pj) return jsonErr(res, 'Not found', 404);
    const items = await Q('SELECT * FROM penjualan_item WHERE penjualan_id=?', [req.params.pj_id]);
    const kasir = pj.kasir_id
      ? await Q('SELECT name FROM users WHERE id=?', [pj.kasir_id], true)
      : null;
    const hdr = await getPrintHeader();
    const ppn_rate = Number(await getSetting('ppn_rate', '12'));
    return jsonOk(res, { pj, items, kasir, hdr, ppn_rate });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/riwayat', accessRequired('toko'), asyncHandler(async (req, res) => {
  try {
    const { tgl_from = '', tgl_to = '', lok = '', jenis = '', q = '' } = req.query;
    let sql = `SELECT p.*,a.nama as anggota_nama,l.nama as lokasi_nama FROM penjualan p
      LEFT JOIN anggota a ON p.anggota_id=a.id LEFT JOIN lokasi l ON p.lokasi_id=l.id WHERE 1=1`;
    const params = [];
    if (tgl_from) {
      sql += ' AND p.tgl>=?';
      params.push(tgl_from);
    }
    if (tgl_to) {
      sql += ' AND p.tgl<=?';
      params.push(tgl_to);
    }
    if (lok) {
      sql += ' AND p.lokasi_id=?';
      params.push(lok);
    }
    if (jenis) {
      sql += ' AND p.jenis=?';
      params.push(jenis);
    }
    if (q) {
      sql += ' AND (p.no LIKE ? OR a.nama LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }
    const rows = await Q(sql + ' ORDER BY p.created_at DESC LIMIT 500', params);
    for (const r of rows) {
      const its = await Q(
        'SELECT nama,qty,harga,subtotal FROM penjualan_item WHERE penjualan_id=? ORDER BY nama',
        [r.id],
      );
      r.items = its;
      r.items_text = its.map((it) => `${it.nama} x${it.qty}`).join('; ');
    }
    const lokasi_list = await Q("SELECT * FROM lokasi WHERE jenis='toko'");
    const total = rows.reduce((s, r) => s + Number(r.total), 0);
    return jsonOk(res, { rows, lokasi_list, total, tgl_from, tgl_to, lok, jenis, q });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.delete('/riwayat/:pj_id', accessRequired('toko'), asyncHandler(async (req, res) => {
  try {
    const pj_id = req.params.pj_id;
    const pj = await Q('SELECT * FROM penjualan WHERE id=?', [pj_id], true);
    if (pj) {
      const items = await Q('SELECT barang_id,qty FROM penjualan_item WHERE penjualan_id=?', [pj_id]);
      for (const it of items) {
        await X('UPDATE stok SET jumlah=jumlah+?,updated_at=NOW() WHERE barang_id=? AND lokasi_id=?', [
          it.qty,
          it.barang_id,
          pj.lokasi_id,
        ]);
      }
      if (['kredit', 'potong_gaji'].includes(pj.jenis) && pj.anggota_id) {
        await X('UPDATE piutang SET saldo=GREATEST(0,saldo-?),updated_at=NOW() WHERE anggota_id=?', [
          pj.total,
          pj.anggota_id,
        ]);
      }
    }
    await Xfk([
      ['DELETE FROM penjualan_item WHERE penjualan_id=?', [pj_id]],
      ['DELETE FROM penjualan WHERE id=?', [pj_id]],
    ]);
    return jsonOk(res, {}, 'Transaksi dihapus');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/riwayat/export', accessRequired('toko'), asyncHandler(async (req, res) => {
  try {
    const fmt = req.query.fmt || 'csv';
    const rows = await Q(
      `SELECT p.no,p.tgl,l.nama as toko,p.jenis,p.payment_channel,a.nama as anggota,p.subtotal,p.diskon_total,p.ppn_total,p.total,p.status,
        (SELECT GROUP_CONCAT(CONCAT(nama,' x',qty) SEPARATOR '; ') FROM penjualan_item WHERE penjualan_id=p.id) as barang_terjual
        FROM penjualan p LEFT JOIN anggota a ON p.anggota_id=a.id LEFT JOIN lokasi l ON p.lokasi_id=l.id ORDER BY p.tgl DESC`,
    );
    const cols = [
      'no', 'tgl', 'toko', 'jenis', 'payment_channel', 'anggota', 'barang_terjual',
      'subtotal', 'diskon_total', 'ppn_total', 'total', 'status',
    ];
    return sendExport(fmt, rows, cols, 'Riwayat Penjualan', 'penjualan.xlsx', res);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/riwayat/save', accessRequired('toko'), asyncHandler(async (req, res) => {
  try {
    const f = req.body;
    const pid = String(f.id || '').trim();
    if (!pid) return jsonErr(res, 'ID transaksi kosong');
    const old = await Q('SELECT * FROM penjualan WHERE id=?', [pid], true);
    if (!old) return jsonErr(res, 'Transaksi tidak ditemukan');
    const total = Number(f.total) || old.total || 0;
    const diskon = Number(f.diskon_total) || old.diskon_total || 0;
    await X(
      'UPDATE penjualan SET tgl=?,jenis=?,payment_channel=?,diskon_total=?,total=?,status=? WHERE id=?',
      [
        f.tgl || old.tgl,
        f.jenis || old.jenis,
        f.payment_channel || old.payment_channel || 'cash',
        diskon,
        total,
        f.status || old.status,
        pid,
      ],
    );
    await audit('toko', 'edit', 'penjualan', pid, old, f, 'Edit grid penjualan');
    return jsonOk(res, {}, 'Transaksi penjualan diperbarui');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/riwayat/import', accessRequired('toko'), upload.single('file'), asyncHandler(async (req, res) => {
  try {
    if (!req.file) return jsonErr(res, 'Pilih file CSV');
    const reader = parse(req.file.buffer.toString('utf-8').replace(/^\uFEFF/, ''), {
      columns: true,
      skip_empty_lines: true,
    });
    let ok = 0;
    for (const r of reader) {
      const no = String(r.no || '').trim() || `JL-IMP-${uid().slice(0, 6)}`;
      if (await Q('SELECT id FROM penjualan WHERE no=?', [no], true)) continue;
      await X(
        `INSERT INTO penjualan(id,no,tgl,lokasi_id,jenis,subtotal,diskon_total,ppn_total,total,pkp,status,kasir_id,payment_channel)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          uid(),
          no,
          r.tgl || today(),
          r.lokasi_id || 'L1',
          r.jenis || 'cash',
          Number(r.subtotal) || 0,
          Number(r.diskon_total) || 0,
          Number(r.ppn_total) || 0,
          Number(r.total) || 0,
          0,
          r.status || 'lunas',
          req.user.id,
          r.payment_channel || r.jenis || 'cash',
        ],
      );
      ok++;
    }
    return jsonOk(res, { count: ok }, `${ok} transaksi penjualan diimport`);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.all('/shift', accessRequired('toko'), async (req, res) => {
  try {
    const u = req.user;
    const open_shift = await Q(
      "SELECT * FROM pos_shift WHERE user_id=? AND status='open' ORDER BY tgl_buka DESC LIMIT 1",
      [u.id],
      true,
    );
    if (req.method === 'POST') {
      const action = req.body.action;
      if (action === 'open') {
        if (open_shift) return jsonErr(res, 'Shift sudah dibuka. Tutup dahulu sebelum buka shift baru.');
        const saldo_awal = Number(req.body.saldo_awal) || 0;
        const no = `SHF-${today().replace(/-/g, '')}-${uid().slice(0, 4)}`;
        const sid = uid();
        await X(
          `INSERT INTO pos_shift (id,no,user_id,user_name,lokasi_id,lokasi_nama,tgl_buka,saldo_awal,status)
           VALUES (?,?,?,?,?,?,?,?,'open')`,
          [sid, no, u.id, u.name || '-', u.lokasi_id, '', nowStr(), saldo_awal],
        );
        await audit('toko', 'open_shift', 'pos_shift', sid, null, { saldo_awal }, `Buka shift ${no}`);
        return jsonOk(res, { shift_id: sid }, `Shift ${no} dibuka — Saldo awal Rp ${fmtRp(saldo_awal)}`);
      }
      if (action === 'close') {
        if (!open_shift) return jsonErr(res, 'Tidak ada shift aktif untuk ditutup');
        const saldo_fisik = Number(req.body.saldo_fisik) || 0;
        const sales = await Q(
          `SELECT COALESCE(SUM(total),0) as t,
            COALESCE(SUM(CASE WHEN jenis='cash' THEN total ELSE 0 END),0) as tunai,
            COALESCE(SUM(CASE WHEN jenis='kredit' THEN total ELSE 0 END),0) as kredit
           FROM penjualan WHERE shift_id=? AND void=0`,
          [open_shift.id],
          true,
        );
        const saldo_akhir = open_shift.saldo_awal + (sales?.tunai || 0);
        const selisih = saldo_fisik - saldo_akhir;
        await X(
          `UPDATE pos_shift SET tgl_tutup=?,saldo_akhir=?,saldo_fisik=?,selisih=?,
           total_penjualan=?,total_kredit=?,total_tunai=?,catatan=?,status='closed' WHERE id=?`,
          [
            nowStr(),
            saldo_akhir,
            saldo_fisik,
            selisih,
            sales?.t || 0,
            sales?.kredit || 0,
            sales?.tunai || 0,
            req.body.catatan || '',
            open_shift.id,
          ],
        );
        return jsonOk(
          res,
          { selisih },
          `Shift ditutup — Total penjualan Rp ${fmtRp(sales?.t || 0)} | Selisih Rp ${fmtRp(selisih)}`,
        );
      }
    }
    const history = await Q(
      'SELECT * FROM pos_shift WHERE user_id=? ORDER BY tgl_buka DESC LIMIT 30',
      [u.id],
    );
    return jsonOk(res, { open_shift, history });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
});

router.post('/hold', accessRequired('toko'), asyncHandler(async (req, res) => {
  try {
    const f = req.body;
    const items_json = f.items_json || '[]';
    const total = Number(f.total) || 0;
    if (!items_json || total <= 0) return jsonErr(res, 'Cart kosong');
    const no = `HLD-${today().replace(/-/g, '')}-${uid().slice(0, 4)}`;
    const hid = uid();
    await X(
      'INSERT INTO pos_hold (id,no,user_id,lokasi_id,anggota_id,items_json,total,catatan) VALUES (?,?,?,?,?,?,?,?)',
      [
        hid,
        no,
        req.user.id,
        f.lokasi_id || req.user.lokasi_id,
        f.anggota_id || null,
        items_json,
        total,
        f.catatan || '',
      ],
    );
    return jsonOk(res, { ok: true, no });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/hold/list', accessRequired('toko'), asyncHandler(async (req, res) => {
  try {
    const rows = await Q(
      'SELECT * FROM pos_hold WHERE user_id=? ORDER BY created_at DESC LIMIT 30',
      [req.user.id],
    );
    return jsonOk(res, { rows });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.get('/hold/load/:hid', accessRequired('toko'), asyncHandler(async (req, res) => {
  try {
    const h = await Q('SELECT * FROM pos_hold WHERE id=?', [req.params.hid], true);
    if (!h) return jsonErr(res, 'Not found', 404);
    await X('DELETE FROM pos_hold WHERE id=?', [req.params.hid]);
    return jsonOk(res, {
      ok: true,
      items: JSON.parse(h.items_json || '[]'),
      anggota_id: h.anggota_id,
    });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/void/:pid', accessRequired('toko'), asyncHandler(async (req, res) => {
  try {
    const p = await Q('SELECT * FROM penjualan WHERE id=?', [req.params.pid], true);
    if (!p) return jsonErr(res, 'Transaksi tidak ditemukan');
    const alasan = req.body.alasan || '';
    await X('UPDATE penjualan SET void=1 WHERE id=?', [req.params.pid]);
    await X(
      'INSERT INTO pos_void (id,penjualan_id,no_penjualan,alasan,user_id) VALUES (?,?,?,?,?)',
      [uid(), req.params.pid, p.no, alasan, req.user.id],
    );
    const items = await Q('SELECT * FROM penjualan_item WHERE penjualan_id=?', [req.params.pid]);
    for (const it of items) {
      await X('UPDATE stok SET jumlah=jumlah+? WHERE barang_id=? AND lokasi_id=?', [
        it.qty,
        it.barang_id,
        p.lokasi_id,
      ]);
    }
    if (p.jenis === 'kredit' && p.anggota_id) {
      await X('UPDATE piutang SET saldo=saldo-? WHERE anggota_id=?', [p.total, p.anggota_id]);
      await X(
        'UPDATE limit_kredit_toko SET terpakai=terpakai-? WHERE anggota_id=? AND bulan=?',
        [p.total, p.anggota_id, p.tgl.slice(0, 7)],
      );
    }
    return jsonOk(res, {}, `Transaksi ${p.no} dibatalkan (void)`);
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));
}

module.exports = { registerRoutes };
