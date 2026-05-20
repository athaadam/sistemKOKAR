exports.up = async (knex) => {
  // Tambah kolom biaya_servis ke tabel rental_maintenance
  await knex.schema.table('rental_maintenance', (t) => {
    t.decimal('biaya_servis', 15, 2).notNullable().defaultTo(0).after('biaya');
  });
};

exports.down = async (knex) => {
  // Rollback: hapus kolom biaya_servis
  await knex.schema.table('rental_maintenance', (t) => {
    t.dropColumn('biaya_servis');
  });
};
