param(
    [Parameter(Mandatory)][string]$UnsignedApk,
    [Parameter(Mandatory)][string]$OutputApk
)
$ErrorActionPreference = 'Stop'
foreach ($name in @('JAVA_HOME', 'ANDROID_HOME', 'ORVIM_ANDROID_KEYSTORE', 'ORVIM_ANDROID_KEY_ALIAS', 'ORVIM_ANDROID_STORE_PASSWORD', 'ORVIM_ANDROID_KEY_PASSWORD')) {
    if (-not [Environment]::GetEnvironmentVariable($name)) { throw "Missing environment variable: $name" }
}
if (Test-Path -LiteralPath $OutputApk) { throw 'Output already exists; refusing to overwrite.' }
if (-not (Test-Path -LiteralPath $UnsignedApk)) { throw 'Unsigned APK not found.' }
if (-not (Test-Path -LiteralPath $env:ORVIM_ANDROID_KEYSTORE)) { throw 'Release keystore not found.' }
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
$tools = Join-Path $env:ANDROID_HOME 'build-tools/36.0.0'
& "$tools/zipalign.exe" -P 16 -f 4 $UnsignedApk $OutputApk
if ($LASTEXITCODE -ne 0) { throw 'APK alignment failed.' }
& "$tools/apksigner.bat" sign --ks $env:ORVIM_ANDROID_KEYSTORE --ks-key-alias $env:ORVIM_ANDROID_KEY_ALIAS --ks-pass env:ORVIM_ANDROID_STORE_PASSWORD --key-pass env:ORVIM_ANDROID_KEY_PASSWORD $OutputApk
if ($LASTEXITCODE -ne 0) { throw 'APK signing failed.' }
$certificate = & "$tools/apksigner.bat" verify --verbose --print-certs $OutputApk
if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
if ($certificate -match 'CN=Android Debug') { throw 'Debug certificate is forbidden for release distribution.' }
$expectedCertificate = '69769e705d33225d37d62da35c3d549c219d6235cf658118a16649056591c386'
if (-not ($certificate -match "certificate SHA-256 digest: $expectedCertificate")) { throw 'Unexpected release signing certificate.' }
$certificate | Write-Output
& "$tools/zipalign.exe" -c -P 16 4 $OutputApk
if ($LASTEXITCODE -ne 0) { throw 'Signed APK alignment verification failed.' }
$metadata = & "$tools/aapt2.exe" dump badging $OutputApk
if ($LASTEXITCODE -ne 0) { throw 'APK metadata inspection failed.' }
if ($metadata -match 'application-debuggable') { throw 'Debuggable APK is forbidden for release distribution.' }
$version = (Get-Content (Join-Path $PSScriptRoot '../package.json') -Raw | ConvertFrom-Json).version
if (-not ($metadata -match "package: name='local.lifeos.client'.*versionName='$([regex]::Escape($version))'")) { throw 'Unexpected package identifier or version.' }
$metadata | Select-String 'package:|sdkVersion:|targetSdkVersion:|native-code:'
Get-FileHash -Algorithm SHA256 -LiteralPath $OutputApk
