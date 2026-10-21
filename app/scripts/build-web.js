// Copies the game's own files into app/www, which is what ends up inside the phone app.
//   node scripts/build-web.js
//
// It copies a list of files and folders, never "everything", so the server, the account data and
// the test tools can never end up inside an app that goes to a store. The service worker is left
// out on purpose: inside an app the files ARE the app, and js/net.js switches the offline copy off.
// The build placeholder is replaced with the word "app" (the page only checks for digits).
const fs = require('fs');
const path = require('path');

// the game's folder: the project this lives in, or wherever GAME_ROOT says (the app is built in a
// folder outside OneDrive, so the scripts are copied there and told where the game is)
const ROOT = process.env.GAME_ROOT ? path.resolve(process.env.GAME_ROOT) : path.join(__dirname, '..', '..');
const OUT = path.join(__dirname, '..', 'www');

const FILES = ['index.html', 'style.css', 'manifest.webmanifest', 'privacy.html', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
const DIRS = ['js', 'fonts']; // fonts/ exists once the game ships its own copy of its font

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let n = 0;
const copy = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (path.basename(from) === 'index.html') fs.writeFileSync(to, fs.readFileSync(from, 'utf8').replace('__BUILD__', 'app'));
  else fs.copyFileSync(from, to);
  n++;
};
for (const f of FILES) {
  const from = path.join(ROOT, f);
  if (!fs.existsSync(from)) throw new Error('missing ' + f);
  copy(from, path.join(OUT, f));
}
for (const d of DIRS) {
  const from = path.join(ROOT, d);
  if (!fs.existsSync(from)) continue;
  for (const f of fs.readdirSync(from)) if (fs.statSync(path.join(from, f)).isFile()) copy(path.join(from, f), path.join(OUT, d, f));
}

// the guard: nothing that belongs on a server, or holds an account, is in the app
const banned = ['server.js', 'data.json', 'package.json', 'sw.js', 'render.yaml'];
const found = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (banned.includes(f.toLowerCase()) || /\.(env|key|pem|p8|jks|keystore)$/i.test(f)) found.push(path.relative(OUT, p));
  }
})(OUT);
if (found.length) throw new Error('refusing to build: ' + found.join(', ') + ' must not be in the app');

console.log(`app/www ready: ${n} files`);
