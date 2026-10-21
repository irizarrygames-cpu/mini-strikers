// Sets up the generated Android project the way Mini Strikers needs it. Safe to run again: every
// change checks whether it is already made.
//   - landscape only, full screen with the system bars hidden (swipe to bring them back)
//   - no cloud backup of the app's data (it holds the sign-in)
//   - the version number, from version.json
//   - release signing from a keystore.properties file kept OUTSIDE the project
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..');
const A = path.join(APP, 'android', 'app');
const cfg = JSON.parse(fs.readFileSync(path.join(APP, 'capacitor.config.json'), 'utf8'));
const ver = JSON.parse(fs.readFileSync(path.join(APP, 'version.json'), 'utf8'));
const read = (p) => fs.readFileSync(p, 'utf8');
const need = (cond, msg) => { if (!cond) throw new Error('patch-android: ' + msg); };

// ---- manifest ----
const manifestPath = path.join(A, 'src', 'main', 'AndroidManifest.xml');
let m = read(manifestPath);
if (!m.includes('screenOrientation')) {
  need(m.includes('android:launchMode="singleTask"'), 'activity not found in the manifest');
  m = m.replace('android:launchMode="singleTask"', 'android:launchMode="singleTask"\n            android:screenOrientation="sensorLandscape"');
}
m = m.replace('android:allowBackup="true"', 'android:allowBackup="false"');
need(m.includes('sensorLandscape') && m.includes('allowBackup="false"'), 'manifest edit did not take');
fs.writeFileSync(manifestPath, m);

// ---- full screen ----
const pkgDir = path.join(A, 'src', 'main', 'java', ...cfg.appId.split('.'));
const activity = path.join(pkgDir, 'MainActivity.java');
need(fs.existsSync(activity), 'MainActivity.java not found');
fs.writeFileSync(activity, `package ${cfg.appId};

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

// The game is played full screen: the status bar and the navigation buttons are hidden, and a
// swipe from the edge brings them back for a moment. They are hidden again whenever the game
// regains focus (after a dialog, the purchase sheet, or coming back from another app).
public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    hideSystemBars();
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) hideSystemBars();
  }

  private void hideSystemBars() {
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    controller.hide(WindowInsetsCompat.Type.systemBars());
  }
}
`);

// ---- version and signing ----
const gradlePath = path.join(A, 'build.gradle');
let g = read(gradlePath);
g = g.replace(/versionCode \d+/, `versionCode ${ver.versionCode}`).replace(/versionName "[^"]*"/, `versionName "${ver.versionName}"`);
if (!g.includes('signingConfigs')) {
  const a = 'compileSdk = rootProject.ext.compileSdkVersion\n';
  need(g.includes(a), 'compileSdk line not found in build.gradle');
  g = g.replace(a, a + `    signingConfigs {
        release {
            // the keystore and its passwords live outside the project and outside OneDrive (see PUBLISHING.md)
            def props = new Properties()
            def f = file(System.getenv('MS_KEYSTORE_PROPS') ?: '../../../signing/keystore.properties')
            if (f.exists()) {
                f.withInputStream { props.load(it) }
                storeFile file(props['storeFile'])
                storePassword props['storePassword']
                keyAlias props['keyAlias']
                keyPassword props['keyPassword']
            }
        }
    }
`);
  const b = 'minifyEnabled false\n';
  need(g.includes(b), 'release block not found in build.gradle');
  g = g.replace(b, b + '            signingConfig signingConfigs.release\n');
}
need(g.includes(`versionCode ${ver.versionCode}`) && g.includes('signingConfig signingConfigs.release'), 'build.gradle edit did not take');
fs.writeFileSync(gradlePath, g);

console.log(`android project set up: ${cfg.appId} ${ver.versionName} (${ver.versionCode}), landscape, full screen, signed from keystore.properties`);
