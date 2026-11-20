import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isMac = process.platform === "darwin";
const isWindows = process.platform === "win32";

// Years newest-first. AE_INSTALL_DIR (the "Adobe After Effects <year>" folder) covers
// installs outside the default location, e.g. D:\Software\Adobe After Effects 2027.
const years = ["2028", "2027", "2026", "2025", "2024", "2023", "2022", "2021"];
const winRoots = [
  "C:\\Program Files\\Adobe",
  "D:\\Program Files\\Adobe",
  "D:\\Software",
  "D:\\Adobe",
  "E:\\Program Files\\Adobe",
  "E:\\Software",
];
const possiblePaths = [];
if (process.env.AE_INSTALL_DIR) possiblePaths.push(process.env.AE_INSTALL_DIR);
for (const y of years) {
  if (isMac) possiblePaths.push(`/Applications/Adobe After Effects ${y}`);
  else for (const r of winRoots) possiblePaths.push(`${r}\\Adobe After Effects ${y}`);
}

let afterEffectsPath = null;
for (const testPath of possiblePaths) {
  if (fs.existsSync(testPath)) {
    afterEffectsPath = testPath;
    break;
  }
}

// On Windows the panel is installed per user under %APPDATA%\Adobe\After Effects\<version>,
// which exists wherever AE itself is installed, so a missing install folder is only fatal
// when there is no %APPDATA% version folder either.
const hasAppDataAE =
  isWindows &&
  !!process.env.APPDATA &&
  fs.existsSync(path.join(process.env.APPDATA, "Adobe", "After Effects"));

if (!afterEffectsPath && !hasAppDataAE) {
  console.error("Error: Could not find After Effects installation.");
  console.error(
    "Set AE_INSTALL_DIR to your 'Adobe After Effects <year>' folder, or copy the bridge script manually.",
  );
  console.error("Source: build/scripts/mcp-bridge-auto.jsx");
  if (isMac) {
    console.error("Target: /Applications/Adobe After Effects [VERSION]/Scripts/ScriptUI Panels/");
  } else {
    console.error("Target: %APPDATA%\\Adobe\\After Effects\\[VERSION]\\Scripts\\ScriptUI Panels\\");
  }
  process.exit(1);
}

const sourceScript = path.join(__dirname, "build", "scripts", "mcp-bridge-auto.jsx");

function collectDestinationScripts() {
  const destinations = [];

  if (isMac) {
    // Install into EVERY detected AE version under /Applications, not just the
    // newest one, so users with multiple versions (e.g. a stable + a beta) get
    // the panel in whichever version they actually open (matches the Windows
    // branch below, which installs into every %APPDATA% version folder).
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        destinations.push(path.join(testPath, "Scripts", "ScriptUI Panels", "mcp-bridge-auto.jsx"));
      }
    }
    return destinations;
  }

  // (Intentionally NOT copying to Program Files: it needs admin AND After Effects scans
  // BOTH Program Files and %APPDATA% ScriptUI Panels -> a DUPLICATE Window-menu entry.
  // The per-user %APPDATA% copy below is enough and needs no admin.)

  const appData = process.env.APPDATA;
  if (appData) {
    const aeRoot = path.join(appData, "Adobe", "After Effects");
    if (fs.existsSync(aeRoot)) {
      for (const versionDir of fs.readdirSync(aeRoot)) {
        if (versionDir === "Logs") continue;
        const versionRoot = path.join(aeRoot, versionDir);
        // ONLY the ScriptUI Panels folder (a dockable panel belongs nowhere else).
        // NOT the plain Scripts folder (that adds a second, broken entry).
        if (fs.statSync(versionRoot).isDirectory()) {
          destinations.push(
            path.join(versionRoot, "Scripts", "ScriptUI Panels", "mcp-bridge-auto.jsx"),
          );
        }
      }
    }
  }

  const unique = [];
  const seen = new Set();
  for (const d of destinations) {
    if (!seen.has(d)) {
      unique.push(d);
      seen.add(d);
    }
  }
  return unique;
}

function copyDirect(destinationScript) {
  const destinationFolder = path.dirname(destinationScript);
  if (!fs.existsSync(destinationFolder)) {
    fs.mkdirSync(destinationFolder, { recursive: true });
  }
  fs.copyFileSync(sourceScript, destinationScript);
}

function copyElevatedWindows(destinationScript) {
  const psSingleQuote = (s) => `'${String(s).replace(/'/g, "''")}'`;
  const destinationFolder = path.dirname(destinationScript);
  // Command to run ELEVATED: ensure the folder exists, then copy the file.
  const inner =
    `New-Item -ItemType Directory -Path ${psSingleQuote(destinationFolder)} -Force | Out-Null; ` +
    `Copy-Item -LiteralPath ${psSingleQuote(sourceScript)} -Destination ${psSingleQuote(destinationScript)} -Force`;
  const innerEncoded = Buffer.from(inner, "utf16le").toString("base64");
  // Un-elevated launcher: spawn an elevated PowerShell running the encoded command
  // and wait. -EncodedCommand avoids the nested-double-quote breakage that made the
  // old inline `-Command "... | Out-Null ..."` fail ("'Out-Null' is not recognized").
  const launcher = `Start-Process -FilePath powershell -Verb RunAs -Wait -ArgumentList @('-NoProfile','-EncodedCommand','${innerEncoded}')`;
  const launcherEncoded = Buffer.from(launcher, "utf16le").toString("base64");
  execSync(`powershell -NoProfile -EncodedCommand ${launcherEncoded}`, { stdio: "inherit" });
}

if (!fs.existsSync(sourceScript)) {
  console.error(`Error: Source script not found at ${sourceScript}`);
  console.error('Please run "npm run build" first to generate the script.');
  process.exit(1);
}

try {
  const destinations = collectDestinationScripts();
  if (destinations.length === 0) {
    throw new Error("No destination paths found for bridge installation.");
  }

  const installed = [];
  const failed = [];

  for (const destinationScript of destinations) {
    try {
      console.log(`Installing bridge script to ${destinationScript}...`);

      try {
        copyDirect(destinationScript);
      } catch (directError) {
        if (isMac) {
          execSync(`sudo cp "${sourceScript}" "${destinationScript}"`, { stdio: "inherit" });
        } else if (destinationScript.toLowerCase().indexOf("program files") !== -1) {
          copyElevatedWindows(destinationScript);
        } else {
          throw directError;
        }
      }

      installed.push(destinationScript);
    } catch (copyError) {
      failed.push({ destinationScript, error: copyError.message });
    }
  }

  if (installed.length === 0) {
    throw new Error(`Failed to install to all destinations. First error: ${failed[0].error}`);
  }

  console.log("Bridge script installed to:");
  for (const target of installed) {
    console.log(`- ${target}`);
  }

  if (failed.length > 0) {
    console.warn("Some destinations failed:");
    for (const failure of failed) {
      console.warn(`- ${failure.destinationScript}: ${failure.error}`);
    }
    console.warn(
      "This is usually fine if at least one active After Effects Scripts path succeeded.",
    );
  }

  console.log("Bridge script installed successfully!");
  console.log("\nImportant next steps:");
  console.log("1. Open After Effects");
  if (isMac) {
    console.log("2. Go to After Effects > Settings > Scripting & Expressions");
  } else {
    console.log("2. Go to Edit > Preferences > Scripting & Expressions");
  }
  console.log('3. Enable "Allow Scripts to Write Files and Access Network"');
  console.log("4. Restart After Effects");
  console.log("5. Open the bridge panel: Window > mcp-bridge-auto.jsx");
} catch (error) {
  console.error(`Error installing script: ${error.message}`);
  console.error("\nPlease try manual installation:");
  console.error(`1. Copy: ${sourceScript}`);
  console.error(
    "2. To one of your After Effects Scripts folders (for example %APPDATA%\\Adobe\\After Effects\\<version>\\Scripts\\)",
  );
  if (isMac) {
    console.error("3. You may need to run with sudo or copy manually via Finder");
  } else {
    console.error("3. You may need to run as administrator or use File Explorer with admin rights");
  }
  process.exit(1);
}
