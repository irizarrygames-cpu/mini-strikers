# Builds the signed Android App Bundle (.aab) that is uploaded to Google Play.
#
#   powershell -ExecutionPolicy Bypass -File app\build-android.ps1
#
# It builds in a folder OUTSIDE OneDrive (default C:\Users\NoahL\AndroidBuild\work) because the
# Android project and its caches are thousands of files. The small scripts in app\ are copied
# there each time, and the game's own files come from this project, so a rebuild always picks up
# the game as it is now.
#
# Needs, in the tools folder: jdk\ (Temurin 21), sdk\ (Android command-line tools, platform 36 and
# build-tools 36.0.0), and signing\keystore.properties + the .jks it points to.
# To ship an update, raise versionCode (and versionName) in app\version.json first: Google Play
# refuses an upload whose versionCode it has already seen.
param([string]$Tools = 'C:\Users\NoahL\AndroidBuild')
$ErrorActionPreference = 'Stop'
$game = (Resolve-Path "$PSScriptRoot\..").Path
$work = Join-Path $Tools 'work'
$ver  = Get-Content "$PSScriptRoot\version.json" | ConvertFrom-Json

foreach ($need in @("$Tools\jdk\bin\java.exe", "$Tools\sdk\platforms\android-36", "$Tools\signing\keystore.properties")) {
  if (-not (Test-Path $need)) { throw "Missing $need. See PUBLISHING.md." }
}
$env:JAVA_HOME = "$Tools\jdk"; $env:ANDROID_HOME = "$Tools\sdk"; $env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$env:JAVA_HOME\bin;$env:Path"; $env:GAME_ROOT = $game

New-Item -ItemType Directory -Force $work | Out-Null
foreach ($f in 'package.json', 'package-lock.json', 'capacitor.config.json', 'version.json') { Copy-Item "$PSScriptRoot\$f" $work -Force }
New-Item -ItemType Directory -Force "$work\scripts" | Out-Null
Copy-Item "$PSScriptRoot\scripts\*" "$work\scripts" -Force
Set-Location $work

if (-not (Test-Path 'node_modules')) { npm ci --no-audit --no-fund; if ($LASTEXITCODE) { throw 'npm ci failed' } }
node scripts/build-web.js;  if ($LASTEXITCODE) { throw 'web build failed' }
node scripts/make-assets.js; if ($LASTEXITCODE) { throw 'asset build failed' }
if (-not (Test-Path 'android')) { npx cap add android; if ($LASTEXITCODE) { throw 'cap add failed' } }
npx capacitor-assets generate --android --iconBackgroundColor '#2f7bff' --iconBackgroundColorDark '#2f7bff' --splashBackgroundColor '#2f7bff' --splashBackgroundColorDark '#2f7bff' | Out-Null
node scripts/patch-android.js; if ($LASTEXITCODE) { throw 'patch failed' }
npx cap sync android;          if ($LASTEXITCODE) { throw 'cap sync failed' }

Set-Location "$work\android"
.\gradlew.bat bundleRelease --no-daemon --console=plain
if ($LASTEXITCODE) { throw 'gradle build failed' }

$aab = "$work\android\app\build\outputs\bundle\release\app-release.aab"
if (-not (Test-Path $aab)) { throw 'the build finished but no .aab was produced' }
$outDir = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Mini Strikers - Play Store'
New-Item -ItemType Directory -Force $outDir | Out-Null
$out = Join-Path $outDir ("mini-strikers-{0}-code{1}.aab" -f $ver.versionName, $ver.versionCode)
Copy-Item $aab $out -Force
$hash = (Get-FileHash $out -Algorithm SHA256).Hash
"Done: $out ({0:N1} MB)`nSHA-256: $hash" -f ((Get-Item $out).Length / 1MB)
