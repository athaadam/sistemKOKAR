const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

/** @param {import('knex').Knex} knex */
exports.seed = async function seed(knex) {
  const users = await knex('users').select('id', 'password');

  for (const user of users) {
    const pwd = user.password || '';
    if (pwd.startsWith('$2')) continue;

    const hash = await bcrypt.hash(pwd, SALT_ROUNDS);
    await knex('users').where({ id: user.id }).update({
      password: hash,
      password_changed_at: knex.fn.now(),
    });
  }
};
