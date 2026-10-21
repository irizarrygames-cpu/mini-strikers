// Makes the source pictures for the Android launcher icon and launch screen out of the game's own
// icons, in app/resources, ready for `npx capacitor-assets generate --android`.
//
// Without this the app would open on Capacitor's default splash picture (their logo, not ours).
//   - icon-only.png        the round-cornered icon, for phones that do not use adaptive icons
//   - icon-foreground.png  the "maskable" icon, whose artwork already sits inside the safe zone
//   - icon-background.png  the flat blue behind it
//   - splash.png           the icon on the game's blue, the first thing seen while the game loads
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = process.env.GAME_ROOT ? path.resolve(process.env.GAME_ROOT) : path.join(__dirname, '..', '..');
const OUT = path.join(__dirname, '..', 'resources');
const BLUE = '#2f7bff';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const big = (src, name) => sharp(path.join(ROOT, src)).resize(1024, 1024, { kernel: 'lanczos3' }).png().toFile(path.join(OUT, name));
  await big('icon-512.png', 'icon-only.png');
  await big('icon-maskable-512.png', 'icon-foreground.png');
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BLUE } }).png().toFile(path.join(OUT, 'icon-background.png'));
  const logo = await sharp(path.join(ROOT, 'icon-512.png')).resize(760, 760, { kernel: 'lanczos3' }).png().toBuffer();
  for (const name of ['splash.png', 'splash-dark.png']) {
    await sharp({ create: { width: 2732, height: 2732, channels: 4, background: BLUE } })
      .composite([{ input: logo, gravity: 'centre' }]).png().toFile(path.join(OUT, name));
  }
  console.log('app/resources ready');
})().catch((e) => { console.error(e); process.exit(1); });
