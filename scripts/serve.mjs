/**
 * Stały serwer Pulsecal na tym komputerze: http://localhost:5173 (i w sieci lokalnej).
 *
 * - Serwuje wersję produkcyjną zbudowaną z OSTATNIEGO COMMITA — nie z niezapisanych zmian w plikach,
 *   więc w trakcie pracy nad kodem działa ostatnia wydana wersja.
 * - Co 10 s sprawdza, czy w repo jest nowy commit; jeśli tak, buduje go w tle (w .serve/) i podmienia.
 *   Nieudany build: zostaje poprzednia wersja, błąd w .serve/server.log.
 * - Uruchamia się przy logowaniu do Windows (wpis w folderze Autostart, `npm run serve:install`).
 *
 * Polecenia: node scripts/serve.mjs [run | status | stop | restart | rebuild | install | uninstall]
 */
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, ".serve");
// źródła commita rozpakowane WEWNĄTRZ repo: zależności (react, vite…) znajdują się w ROOT/node_modules
const SRC = path.join(DIR, "src");
const NEXT = path.join(DIR, "next");
const CURRENT = path.join(DIR, "current");
const OLD = path.join(DIR, "old");
const INDEX = path.join(DIR, "index");
const STATE = path.join(DIR, "state.json");
const LOG = path.join(DIR, "server.log");
const PID = path.join(DIR, "server.pid");
const TRIGGER = path.join(DIR, "rebuild");
const PORT = Number(process.env.PULSECAL_PORT) || 5173;
const POLL_MS = 10_000;
const STARTUP_DIR = path.join(process.env.APPDATA ?? "", "Microsoft", "Windows", "Start Menu", "Programs", "Startup");
const STARTUP_FILE = path.join(STARTUP_DIR, "Pulsecal server.lnk");

fs.mkdirSync(DIR, { recursive: true });

const stamp = () => new Date().toLocaleString("sv-SE");

function log(msg) {
  const line = `[${stamp()}] ${msg}\n`;
  process.stdout.write(line);
  try {
    if (fs.existsSync(LOG) && fs.statSync(LOG).size > 1_000_000) fs.renameSync(LOG, `${LOG}.1`);
    fs.appendFileSync(LOG, line);
  } catch {
    /* log jest pomocniczy */
  }
}

const git = (args, env) =>
  execFileSync("git", ["-C", ROOT, ...args], { encoding: "utf8", env: { ...process.env, ...env }, windowsHide: true }).trim();

const head = () => git(["rev-parse", "HEAD"]);
const short = (sha) => (sha ? sha.slice(0, 7) : "—");
const describe = (sha) => {
  try {
    return `${git(["describe", "--tags", "--always", sha])} (${short(sha)})`;
  } catch {
    return short(sha);
  }
};

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
};

/** Usuń katalog z .serve/ (nigdy nic poza nim). */
function rmServeDir(p) {
  if (!path.resolve(p).startsWith(DIR + path.sep)) throw new Error(`refusing to remove ${p}`);
  fs.rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function retry(fn, tries = 10) {
  for (let i = 1; ; i++) {
    try {
      return fn();
    } catch (err) {
      if (i >= tries) throw err;
      await sleep(300);
    }
  }
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Czy proces o tym PID to na pewno ten serwer (po restarcie Windows PID może należeć do czegoś innego). */
function isServer(pid) {
  if (!alive(pid)) return false;
  if (process.platform !== "win32") return true;
  try {
    const cmd = execFileSync(
      "powershell",
      ["-NoProfile", "-Command", `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`],
      { encoding: "utf8", windowsHide: true },
    );
    return cmd.includes("serve.mjs");
  } catch {
    return false;
  }
}

function runningPid() {
  const pid = Number(fs.existsSync(PID) ? fs.readFileSync(PID, "utf8") : 0);
  return pid && pid !== process.pid && isServer(pid) ? pid : 0;
}

/** Zbuduj dany commit do .serve/next (źródła z gita, nie z katalogu roboczego). */
function build(sha) {
  rmServeDir(SRC);
  rmServeDir(NEXT);
  fs.mkdirSync(SRC, { recursive: true });
  // osobny indeks gita: nie rusza tego, co jest w repo „staged”
  const env = { GIT_INDEX_FILE: INDEX };
  git(["read-tree", sha], env);
  git(["checkout-index", "-a", "-f", `--prefix=${SRC.replace(/\\/g, "/")}/`], env);
  return new Promise((resolve) => {
    const vite = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");
    const child = spawn(process.execPath, [vite, "build", "--outDir", NEXT, "--emptyOutDir"], {
      cwd: SRC,
      windowsHide: true,
      env: { ...process.env, NODE_ENV: "production" },
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("error", (err) => resolve({ ok: false, out: String(err) }));
    child.on("close", (code) => resolve({ ok: code === 0 && fs.existsSync(path.join(NEXT, "index.html")), out }));
  });
}

let server = null;

async function startServer() {
  const { preview } = await import("vite");
  server = await preview({
    root: ROOT,
    configFile: false,
    logLevel: "warn",
    build: { outDir: CURRENT },
    preview: { port: PORT, strictPort: true, host: true },
  });
}

async function stopServer() {
  if (!server) return;
  const s = server;
  server = null;
  await s.close();
}

/** Podmień .serve/current na świeżo zbudowane .serve/next (serwer na chwilę zatrzymany). */
async function swap(sha) {
  await stopServer();
  rmServeDir(OLD);
  if (fs.existsSync(CURRENT)) await retry(() => fs.renameSync(CURRENT, OLD));
  await retry(() => fs.renameSync(NEXT, CURRENT));
  rmServeDir(OLD);
  fs.writeFileSync(STATE, JSON.stringify({ sha, builtAt: Date.now() }, null, 2));
  await startServer();
}

let building = false;
let failedSha = "";

async function update(sha, why) {
  if (building) return;
  building = true;
  const t0 = Date.now();
  log(`${why}: buduję ${describe(sha)}…`);
  try {
    const res = build(sha);
    const { ok, out } = await res;
    if (!ok) {
      failedSha = sha;
      log(`BŁĄD budowania ${short(sha)} — zostaje poprzednia wersja.\n${out.split("\n").slice(-30).join("\n")}`);
      return;
    }
    await swap(sha);
    failedSha = "";
    log(`gotowe: serwuję ${describe(sha)} na http://localhost:${PORT} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  } catch (err) {
    failedSha = sha;
    log(`BŁĄD: ${err?.stack ?? err}`);
    if (!server && fs.existsSync(path.join(CURRENT, "index.html"))) await startServer().catch(() => undefined);
  } finally {
    rmServeDir(SRC);
    building = false;
  }
}

async function tick() {
  try {
    if (fs.existsSync(TRIGGER)) {
      fs.rmSync(TRIGGER, { force: true });
      await update(head(), "przebudowa na życzenie");
      return;
    }
    const sha = head();
    const served = readJson(STATE)?.sha;
    if (sha !== served && sha !== failedSha) await update(sha, "nowy commit");
  } catch (err) {
    log(`błąd sprawdzania repo: ${err?.message ?? err}`);
  }
}

async function run() {
  const other = runningPid();
  if (other) {
    console.log(`Serwer już działa (PID ${other}).`);
    return;
  }
  fs.writeFileSync(PID, String(process.pid));
  const cleanup = () => {
    try {
      if (Number(fs.readFileSync(PID, "utf8")) === process.pid) fs.rmSync(PID, { force: true });
    } catch {
      /* już nie ma */
    }
  };
  process.on("exit", cleanup);
  for (const sig of ["SIGINT", "SIGTERM", "SIGBREAK"]) process.on(sig, () => process.exit(0));
  process.on("unhandledRejection", (err) => log(`błąd: ${err?.stack ?? err}`));

  log(`start (PID ${process.pid}), repo ${ROOT}`);
  if (fs.existsSync(path.join(CURRENT, "index.html"))) {
    try {
      await startServer();
      log(`serwuję ${describe(readJson(STATE)?.sha ?? "")} na http://localhost:${PORT}`);
    } catch (err) {
      log(`nie mogę wystartować na porcie ${PORT}: ${err?.message ?? err}`);
      process.exit(1);
    }
  }
  await tick(); // pierwsze uruchomienie albo nowy commit od ostatniego razu
  if (!server) {
    log("brak zbudowanej wersji — kończę.");
    process.exit(1);
  }
  setInterval(() => void tick(), POLL_MS);
}

function status() {
  const pid = runningPid();
  const st = readJson(STATE);
  let sha = "";
  try {
    sha = head();
  } catch {
    /* bez gita */
  }
  console.log(pid ? `działa (PID ${pid}) — http://localhost:${PORT}` : "nie działa");
  console.log(`serwowana wersja: ${st ? describe(st.sha) : "brak"}${st ? `, zbudowana ${new Date(st.builtAt).toLocaleString("sv-SE")}` : ""}`);
  console.log(`ostatni commit:   ${describe(sha)}${st && st.sha !== sha ? "  ← jeszcze nie zbudowany" : ""}`);
  console.log(`autostart:        ${fs.existsSync(STARTUP_FILE) ? "tak" : "nie"} (${STARTUP_FILE})`);
  console.log(`log:              ${LOG}`);
}

function stop() {
  const pid = runningPid();
  if (!pid) {
    console.log("Serwer nie działa.");
    return false;
  }
  process.kill(pid);
  fs.rmSync(PID, { force: true });
  console.log(`Zatrzymano serwer (PID ${pid}).`);
  return true;
}

/** Uruchom w tle, bez okna (tak samo jak przy logowaniu do Windows). */
function startDetached() {
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "run"], {
    cwd: ROOT,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  console.log(`Uruchomiono serwer w tle — http://localhost:${PORT} (log: ${LOG})`);
}

/**
 * Skrót w folderze Autostart: ukryty PowerShell uruchamia Node bez okna (bez VBScriptu, który Windows wycofuje).
 * Ścieżki idą do PowerShella przez zmienne środowiskowe, żeby nie walczyć z cudzysłowami.
 */
function install() {
  if (!fs.existsSync(STARTUP_DIR)) throw new Error(`Nie ma folderu Autostart: ${STARTUP_DIR}`);
  const script = fileURLToPath(import.meta.url);
  // w argumentach skrótu: -Command "…" (cudzysłów w środku jako \")
  const launch =
    `-NoProfile -WindowStyle Hidden -Command "Start-Process -WindowStyle Hidden ` +
    `-FilePath '${process.execPath}' -WorkingDirectory '${ROOT}' -ArgumentList '\\"${script}\\" run'"`;
  const ps = [
    "$s = (New-Object -ComObject WScript.Shell).CreateShortcut($env:PULSE_LNK)",
    "$s.TargetPath = Join-Path $env:SystemRoot 'System32\\WindowsPowerShell\\v1.0\\powershell.exe'",
    "$s.Arguments = $env:PULSE_ARGS",
    "$s.WorkingDirectory = $env:PULSE_ROOT",
    "$s.WindowStyle = 7",
    "$s.Description = 'Pulsecal: stały serwer (npm run serve:uninstall usuwa)'",
    "$s.Save()",
  ].join("; ");
  execFileSync("powershell", ["-NoProfile", "-Command", ps], {
    windowsHide: true,
    env: { ...process.env, PULSE_LNK: STARTUP_FILE, PULSE_ARGS: launch, PULSE_ROOT: ROOT },
  });
  console.log(`Autostart: ${STARTUP_FILE}`);
  if (!runningPid()) startDetached();
  else console.log("Serwer już działa.");
}

function uninstall() {
  fs.rmSync(STARTUP_FILE, { force: true });
  console.log("Usunięto autostart.");
  stop();
}

const cmd = process.argv[2] ?? "run";
switch (cmd) {
  case "run":
    await run();
    break;
  case "status":
    status();
    break;
  case "stop":
    stop();
    break;
  case "restart":
    if (stop()) await sleep(1500);
    startDetached();
    break;
  case "rebuild":
    fs.writeFileSync(TRIGGER, "");
    console.log(runningPid() ? "Przebuduję w ciągu 10 s (log: .serve/server.log)." : "Serwer nie działa — przebuduje się przy starcie.");
    break;
  case "install":
    install();
    break;
  case "uninstall":
    uninstall();
    break;
  default:
    console.log("node scripts/serve.mjs [run | status | stop | restart | rebuild | install | uninstall]");
    process.exit(1);
}
