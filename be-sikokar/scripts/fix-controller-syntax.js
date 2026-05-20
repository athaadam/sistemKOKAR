const fs = require('fs');
const path = require('path');

const CTRL = path.join(__dirname, '..', 'src', 'controllers');

for (const f of fs.readdirSync(CTRL)) {
  if (!f.endsWith('.js')) continue;
  const p = path.join(CTRL, f);
  let c = fs.readFileSync(p, 'utf8');
  const orig = c;
  c = c.replace(
    /asyncHandler\(async \(req, res\) => \{([\s\S]*?)\n\}\);/g,
    'asyncHandler(async (req, res) => {$1\n}));',
  );
  if (c !== orig) {
    fs.writeFileSync(p, c);
    console.log('fixed', f);
  }
}
