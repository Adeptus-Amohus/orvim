import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// Use only developer-supplied environment variables. Never discover a local
// QA installation or change machine-wide configuration on the developer's behalf.
function requireHome(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} in your developer environment.`);
  return value;
}

function requireFile(path, hint) {
  if (!existsSync(path)) throw new Error(`${hint}\nMissing: ${path}`);
}

function javaVersion(executable, label) {
  const result = spawnSync(executable, ["-version"], { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    throw new Error(
      `Could not run ${label}: ${result.error?.message ?? result.stderr}`,
    );
  }
  const output = `${result.stdout}\n${result.stderr}`;
  const version = output.match(/(?:version\s+"|javac\s+)(\d+)(?:\.(\d+))?/);
  const major = version?.[1] === "1" ? version[2] : version?.[1];
  if (major !== "21") {
    throw new Error(
      `${label} reports Java ${major ?? "an unknown version"}. ` +
        "This project's Android toolchain requires JDK 21. " +
        "Set JAVA_HOME to a JDK 21 installation; JAVA_HOME/bin takes precedence over PATH.",
    );
  }
}

try {
  const javaHome = requireHome("JAVA_HOME");
  const suffix = process.platform === "win32" ? ".exe" : "";
  for (const tool of ["java", "javac"]) {
    const executable = join(javaHome, "bin", `${tool}${suffix}`);
    requireFile(
      executable,
      "JAVA_HOME must point to a complete JDK 21 installation.",
    );
    javaVersion(executable, tool);
  }

  const sdk = requireHome("ANDROID_HOME");
  requireFile(
    join(sdk, "platform-tools", `adb${suffix}`),
    "ANDROID_HOME must point to an Android SDK with Platform Tools installed.",
  );
  requireFile(
    join(sdk, "platforms", "android-36", "android.jar"),
    "Install Android SDK Platform 36 in ANDROID_HOME.",
  );
  for (const version of ["35.0.0", "36.0.0"]) {
    requireFile(
      join(sdk, "build-tools", version, `aapt2${suffix}`),
      `Install Android SDK Build Tools ${version} in ANDROID_HOME.`,
    );
  }
  const ndk = requireHome("NDK_HOME");
  requireFile(
    join(ndk, "source.properties"),
    "NDK_HOME must point to an installed NDK version directory, not the SDK root.",
  );
  requireFile(
    join(ndk, "toolchains", "llvm", "prebuilt"),
    "The NDK LLVM toolchain is missing; repair the NDK installation.",
  );
  console.log(
    "Android prerequisites OK: JDK 21, SDK Platform 36, Build Tools, NDK.",
  );
} catch (error) {
  console.error(
    `Android setup: ${error instanceof Error ? error.message : error}`,
  );
  console.error(
    "See docs/ANDROID.md. No settings were changed or tools installed.",
  );
  process.exitCode = 1;
}
