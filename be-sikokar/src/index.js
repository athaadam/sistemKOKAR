require('dotenv').config();
const { createApp } = require('./app');

const PORT = Number(process.env.PORT || 5000);
const app = createApp();

app.listen(PORT, () => {
  console.log(`  SIKOKAR API v1.5 — http://localhost:${PORT}/api`);
});
