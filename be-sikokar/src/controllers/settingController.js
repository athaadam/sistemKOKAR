const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { Q, X, upsertSetting } = require('../db');
const { uid, today, nowStr, jsonOk, jsonErr } = require('../utils/helpers');
const { accessRequired, roleRequired } = require('../middleware/auth');
const { getSetting } = require('../utils/settings');
const { ROLE_MENUS } = require('../constants/roleMenus');
const { audit } = require('../utils/audit');

const execFileAsync = promisify(execFile);

const uploadDir = path.join(__dirname, '..', '..', process.env.UPLOAD_DIR || 'uploads');

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.png';
      cb(null, `logo${ext}`);
    },
  }),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(png|jpe?g|gif|svg)$/i.test(file.originalname);
    cb(ok ? null : new Error('Format logo tidak didukung'), ok);
  },
});

const PARAM_KEYS = [
  'nama_kop', 'alamat', 'telp', 'ppn_rate', 'pph21_rate', 'pph23_rate', 'bunga_regular',
  'bunga_darurat', 'limit_approval_pinjaman', 'max_loans', 'nama_toko1', 'nama_toko2',
  'print_header1', 'print_header2', 'password_min_length', 'password_require_complex',
  'password_expiry_days', 'session_timeout_minutes', 'ip_whitelist', 'member_discount_pct',
  'pinjaman_regular_max', 'pinjaman_darurat_max_total', 'pinjaman_darurat_max_per_ajuan',
  'pinjaman_darurat_max_aktif', 'limit_kredit_toko_bulanan', 'bunga_jasa_simpanan_pct',
  'shu_cadangan_pct', 'shu_simpanan_anggota_pct', 'shu_bunga_pinjaman_pct', 'shu_konsumsi_pct',
  'shu_parcel_pct', 'shu_pengurus_pct', 'shu_kesejahteraan_pct', 'shu_pendidikan_pct',
  'shu_pembangunan_pct', 'shu_sosial_pct', 'backup_auto_path',
];

function registerRoutes(router, deps) {
  const { asyncHandler, accessRequired, roleRequired } = deps;
  router.get('/', accessRequired('setting'), asyncHandler(async (req, res) => {
  try {
    const tab = req.query.tab || 'param';
    const settingRows = await Q('SELECT `key`,value FROM setting');
    const params = Object.fromEntries(settingRows.map((r) => [r.key, r.value]));
    const users = await Q('SELECT * FROM users ORDER BY role,name');
    const lokasi_list = await Q('SELECT * FROM lokasi ORDER BY id');
    const master_groups = [];
    for (const [key, title, icon] of [
      ['jabatan', 'Jabatan', '💼'],
      ['departemen', 'Departemen', '🏢'],
      ['satuan_barang', 'Satuan Barang', '📦'],
    ]) {
      const items = await Q('SELECT * FROM ref_option WHERE group_key=? AND aktif=1 ORDER BY label', [key]);
      master_groups.push({ key, title, icon, rows: items });
    }
    return jsonOk(res, {
      tab, params, users, lokasi_list, master_groups, ROLE_MENUS, ALL_MENUS: ROLE_MENUS.admin,
    });
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.post('/params/save', accessRequired('setting'), upload.single('logo_file'), asyncHandler(async (req, res) => {
  try {
    for (const key of PARAM_KEYS) {
      if (req.body[key] !== undefined) {
        await upsertSetting(key, String(req.body[key] ?? ''));
      }
    }
    if (req.file) {
      const logo_path = `uploads/${req.file.filename}`;
      await upsertSetting('logo_path', logo_path);
    }
    return jsonOk(res, {}, 'Parameter disimpan');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

async function validatePassword(pwd) {
  const minlen = Number((await getSetting('password_min_length', process.env.PASSWORD_MIN || '8')) || 8);
  if (pwd.length < minlen) return `Password minimal ${minlen} karakter`;
  const requireComplex = (await getSetting('password_require_complex', '0')) === '1';
  if (requireComplex) {
    if (!/[A-Z]/.test(pwd)) return 'Password harus mengandung huruf besar';
    if (!/[a-z]/.test(pwd)) return 'Password harus mengandung huruf kecil';
    if (!/[0-9]/.test(pwd)) return 'Password harus mengandung angka';
    if (!/[^A-Za-z0-9]/.test(pwd)) return 'Password harus mengandung simbol';
  }
  return null;
}

router.post('/user/save', accessRequired('setting'), roleRequired('admin', 'pengurus'), asyncHandler(async (req, res) => {
  try {
    const f = req.body;
    const uid_ = String(f.id || '').trim();
    const custom_menus = [].concat(f.custom_menus || f['custom_menus[]'] || []).join(',');

    if (uid_) {
      const fields = ['role=?', 'name=?', 'nip=?', 'lokasi_id=?', 'custom_menus=?', 'aktif=?'];
      const vals = [f.role, f.name, f.nip, f.lokasi_id || null, custom_menus, f.aktif ? 1 : 0];
      if (f.password) {
        const err = await validatePassword(f.password);
        if (err) return jsonErr(res, err);
        fields.push('password=?', 'password_changed_at=?');
        vals.push(await bcrypt.hash(f.password, 10), nowStr());
      }
      vals.push(uid_);
      await X(`UPDATE users SET ${fields.join(', ')} WHERE id=?`, vals);
      return jsonOk(res, {}, 'User diperbarui');
    }

    if (!f.password) return jsonErr(res, 'Password wajib');
    const err = await validatePassword(f.password);
    if (err) return jsonErr(res, err);
    await X(
      'INSERT INTO users (id,username,password,name,role,nip,lokasi_id,custom_menus,aktif) VALUES (?,?,?,?,?,?,?,?,1)',
      [uid(), f.username, await bcrypt.hash(f.password, 10), f.name, f.role, f.nip, f.lokasi_id || null, custom_menus],
    );
    return jsonOk(res, {}, 'User ditambahkan');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

router.delete('/user/delete/:u_id', accessRequired('setting'), roleRequired('admin', 'pengurus'), asyncHandler(async (req, res) => {
  try {
    const u_id = req.params.u_id;
    if (u_id === req.user.id) return jsonErr(res, 'Tidak bisa hapus akun sendiri');
    await X('UPDATE penjualan SET kasir_id=NULL WHERE kasir_id=?', [u_id]);
    await X('UPDATE jurnal SET user_id=NULL WHERE user_id=?', [u_id]);
    await X('DELETE FROM users WHERE id=?', [u_id]);
    return jsonOk(res, {}, 'User dihapus');
  } catch (e) {
    return jsonErr(res, e.message, 500);
  }
}));

async function dumpDatabase(outPath) {
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '3306';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'sikokar';
  const args = [`-h${host}`, `-P${port}`, `-u${user}`, database];
  if (password) args.unshift(`-p${password}`);
  const { stdout } = await execFileAsync('mysqldump', args, { maxBuffer: 64 * 1024 * 1024 });
  fs.writeFileSync(outPath, stdout);
  return outPath;
}

router.get('/backup', accessRequired('setting'), asyncHandler(async (req, res) => {
  try {
    const tmp = path.join(uploadDir, `sikokar_backup_${today().replace(/-/g, '')}.sql`);
    fs.mkdirSync(uploadDir, { recursive: true });
    await dumpDatabase(tmp);
    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', `attachment; filename=sikokar_backup_${today()}.sql`);
    return res.sendFile(tmp, () => { try { fs.unlinkSync(tmp); } catch { /* ignore */ } });
  } catch (e) {
    return jsonErr(res, `Backup gagal: ${e.message}. Pastikan mysqldump terpasang.`, 500);
  }
}));

router.get('/backup_now', accessRequired('setting'), asyncHandler(async (req, res) => {
  try {
    const backupDir = path.join(__dirname, '..', '..', (await getSetting('backup_auto_path', 'backup/')).replace(/^\/+/, ''));
    fs.mkdirSync(backupDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '').slice(11, 17);
    const bkfile = path.join(backupDir, `sikokar_backup_${today().replace(/-/g, '')}_${ts}.sql`);
    await dumpDatabase(bkfile);
    await audit('setting', 'backup', '', '', null, { file: bkfile }, 'Backup manual');
    return jsonOk(res, { file: bkfile }, `Database di-backup ke: ${bkfile}`);
  } catch (e) {
    return jsonErr(res, `Backup gagal: ${e.message}`, 500);
  }
}));
}

module.exports = { registerRoutes };
