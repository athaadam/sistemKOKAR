/**
 * Tambahan tabel untuk finalisasi SHU dan idempotensi distribusi jasa simpanan.
 */

const id = (t, name = 'id') => t.string(name, 36).primary();
const money = (t, name, def = 0) => t.decimal(name, 15, 2).notNullable().defaultTo(def);
const ts = (knex, t, name) => t.datetime(name).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP'));

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.schema.alterTable('simpanan_jasa', (t) => {
    t.unique(['periode', 'anggota_id'], 'uniq_simpanan_jasa_periode_anggota');
  });

  await knex.schema.createTable('shu_period', (t) => {
    id(t);
    t.string('periode', 10).notNullable().unique();
    money(t, 'bruto', 0);
    t.integer('total_pct').notNullable().defaultTo(0);
    money(t, 'check_total', 0);
    t.text('alokasi_json').notNullable().defaultTo('[]');
    t.text('kontribusi_json').notNullable().defaultTo('[]');
    t.text('kontribusi_total_json').notNullable().defaultTo('{}');
    t.string('status', 30).notNullable().defaultTo('final');
    t.string('closed_at', 20);
    t.string('user_id', 36);
    t.string('user_name', 255);
    t.text('catatan');
    ts(knex, t, 'created_at');
  });

  await knex.schema.createTable('shu_distribusi', (t) => {
    id(t);
    t.string('shu_period_id', 36)
      .notNullable()
      .references('id')
      .inTable('shu_period')
      .onDelete('CASCADE');
    t.string('periode', 10).notNullable();
    t.string('anggota_id', 36)
      .notNullable()
      .references('id')
      .inTable('anggota')
      .onDelete('CASCADE');
    t.string('anggota_no', 50).notNullable();
    t.string('anggota_nama', 255).notNullable();
    money(t, 'modal_basis', 0);
    money(t, 'pinjaman_basis', 0);
    money(t, 'konsumsi_basis', 0);
    money(t, 'shu_modal', 0);
    money(t, 'shu_pinjaman', 0);
    money(t, 'shu_konsumsi', 0);
    money(t, 'jumlah', 0);
    t.string('user_id', 36);
    ts(knex, t, 'created_at');
    t.unique(['periode', 'anggota_id'], 'uniq_shu_distribusi_periode_anggota');
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('shu_distribusi');
  await knex.schema.dropTableIfExists('shu_period');
  await knex.schema.alterTable('simpanan_jasa', (t) => {
    t.dropUnique(['periode', 'anggota_id'], 'uniq_simpanan_jasa_periode_anggota');
  });
};