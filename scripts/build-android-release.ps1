param(
    [Parameter(Mandatory)][string]$PerlBin,
    [string]$PerlLibrary
)
$ErrorActionPreference = 'Stop'
foreach ($name in @('JAVA_HOME', 'ANDROID_HOME', 'NDK_HOME')) {
    if (-not [Environment]::GetEnvironmentVariable($name)) { throw "Missing environment variable: $name" }
}
if (-not (Test-Path (Join-Path $PerlBin 'perl.exe'))) { throw 'Unix-compatible Perl not found.' }
$env:PATH = "$env:JAVA_HOME/bin;$env:NDK_HOME/prebuilt/windows-x86_64/bin;$PerlBin;$env:PATH"
if ($PerlLibrary) {
    $env:MSYS2_ENV_CONV_EXCL = 'PERL5LIB'
    $env:PERL5LIB = (& (Join-Path $PerlBin 'cygpath.exe') -u $PerlLibrary).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot convert Perl library path.' }
}
$nativeTools = ($env:NDK_HOME -replace '\\', '/') + '/toolchains/llvm/prebuilt/windows-x86_64/bin'
$env:CC_aarch64_linux_android = "$nativeTools/clang.exe"
$env:AR_aarch64_linux_android = "$nativeTools/llvm-ar.exe"
$env:RANLIB_aarch64_linux_android = "$nativeTools/llvm-ranlib.exe"
$env:CFLAGS_aarch64_linux_android = '--target=aarch64-linux-android24'
Push-Location (Join-Path $PSScriptRoot '..')
try {
    npm run android:build -- --apk --target aarch64 --ci
    if ($LASTEXITCODE -ne 0) { throw 'Android release build failed.' }
} finally { Pop-Location }
