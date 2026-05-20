/**
 * Split routes/*.js -> controllers/*Controller.js (registerRoutes) + thin routes/*.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src');
const ROUTES = path.join(ROOT, 'routes');
const CTRL = path.join(ROOT, 'controllers');
const SKIP = new Set(['index.js']);

function detectDeps(routerBlock, headerText) {
  const deps = new Set(['asyncHandler']);
  if (routerBlock.includes('accessRequired')) deps.add('accessRequired');
  if (routerBlock.includes('loginRequired')) deps.add('loginRequired');
  if (routerBlock.includes('roleRequired')) deps.add('roleRequired');
  const uploadInHeader = /const upload\s*=/.test(headerText);
  if (!uploadInHeader && (/\bupload\./.test(routerBlock) || routerBlock.includes('upload.single'))) {
    deps.add('upload');
  }
  return [...deps];
}

function wrapAsyncHandlers(routerBlock) {
  return routerBlock.replace(
    /(router\.(?:get|post|put|delete|patch)\([\s\S]*?)(,\s*)async\s*\(\s*req\s*,\s*res\s*\)\s*=>/g,
    '$1$2asyncHandler(async (req, res) =>',
  );
}

function migrate(name) {
  const file = path.join(ROUTES, name);
  const raw = fs.readFileSync(file, 'utf8');
  if (!raw.includes('const router = express.Router()')) return;

  const base = name.replace(/\.js$/, '');
  const ctrlFile = `${base}Controller.js`;

  const parts = raw.split('const router = express.Router();');
  const header = parts[0].replace(/const express = require\('express'\);\r?\n?/, '');
  let routerBlock = parts[1].replace(/\r?\nmodule\.exports = router;\s*$/, '');

  const beforeRouter = header.trim();
  let helpers = '';
  const helperMatch = routerBlock.match(/^([\s\S]*?)(router\.)/);
  if (helperMatch && helperMatch[1].trim()) {
    helpers = helperMatch[1].trim() + '\n\n';
    routerBlock = routerBlock.slice(helperMatch[1].length);
  }

  routerBlock = wrapAsyncHandlers(routerBlock.trim());
  const deps = detectDeps(routerBlock, `${beforeRouter}\n${helpers}`);

  const depImports = [];
  if (deps.includes('accessRequired') || deps.includes('loginRequired') || deps.includes('roleRequired')) {
    depImports.push("const { accessRequired, loginRequired, roleRequired } = require('../middleware/auth');");
  }
  if (deps.includes('upload')) {
    depImports.push("/* upload: injected via deps from route module */");
  }

  const destructuring = `const { ${deps.join(', ')} } = deps;`;

  const ctrlBody = `${beforeRouter}

${helpers}function registerRoutes(router, deps) {
  ${destructuring}
  ${routerBlock}
}

module.exports = { registerRoutes };
`;

  const routeDeps = ["const express = require('express');", "const asyncHandler = require('../utils/asyncHandler');"];
  if (deps.includes('accessRequired') || deps.includes('loginRequired') || deps.includes('roleRequired')) {
    routeDeps.push("const { accessRequired, loginRequired, roleRequired } = require('../middleware/auth');");
  }

  let uploadSetup = '';
  if (deps.includes('upload')) {
    uploadSetup = `
const multer = require('multer');
const upload = multer(); // route module provides upload; setting uses custom storage in controller header
`;
  }

  const routeBody = `${routeDeps.join('\n')}
const { registerRoutes } = require('../controllers/${base}Controller');
${uploadSetup}
const router = express.Router();
const deps = { asyncHandler${deps.filter((d) => d !== 'asyncHandler').map((d) => `, ${d}`).join('')}${deps.includes('upload') ? ', upload' : ''} };
registerRoutes(router, deps);

module.exports = router;
`;

  fs.mkdirSync(CTRL, { recursive: true });
  fs.writeFileSync(path.join(CTRL, ctrlFile), ctrlBody);

  // setting.js has its own multer in header - handle upload in controller header already
  fs.writeFileSync(file, routeBody);
  console.log(`OK ${name} -> ${ctrlFile}`);
}

for (const f of fs.readdirSync(ROUTES)) {
  if (!f.endsWith('.js') || SKIP.has(f)) continue;
  try {
    migrate(f);
  } catch (e) {
    console.error('ERR', f, e.message);
  }
}
