// scripts/inv-sync-agent.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Carica .env.local del progetto Next (così lo script vede STRAPI_URL e i secrets)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

// === CONFIG (puoi cambiare dopo) ===
const EXPORT_DIR = process.env.INV_AGENT_EXPORT_DIR || "C:\\EasyRetail\\export";
const PROCESSED_DIR = path.join(EXPORT_DIR, "processed");
const FAILED_DIR = path.join(EXPORT_DIR, "failed");
const LOGS_DIR = path.join(EXPORT_DIR, "logs");
const LOG_FILE = path.join(LOGS_DIR, "agent.log");

// Legge env Next/Strapi
const STRAPI_URL = (process.env.STRAPI_URL || "http://localhost:1337").replace(/\/$/, "");
const INV_SYNC_SECRET = process.env.INV_SYNC_SECRET;
const INV_AVAILABILITY_SECRET = process.env.INV_AVAILABILITY_SECRET;

// Formato file supportato: CSV semplice con delimitatore ';' o ','
// Colonne richieste (case-insensitive): sku, warehouse, quantity
// quantity = GIACENZA TOTALE desiderata (non delta!)
const REQUIRED = ["sku", "warehouse", "quantity"];

function ts() {
  return new Date().toISOString();
}

function ensureDirs() {
  for (const d of [EXPORT_DIR, PROCESSED_DIR, FAILED_DIR, LOGS_DIR]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

function writeLog(line) {
  try {
    fs.appendFileSync(LOG_FILE, line + "\n", "utf8");
  } catch {
    // se non riesce a scrivere, non blocchiamo l'agent
  }
}

function logInfo(msg) {
  const line = `[${ts()}] [INFO] ${msg}`;
  console.log(line);
  writeLog(line);
}

function logError(msg) {
  const line = `[${ts()}] [ERROR] ${msg}`;
  console.error(line);
  writeLog(line);
}

function mustEnv(name, val) {
  if (!val) throw new Error(`Missing env: ${name}`);
  return val;
}

function listCandidateFiles() {
  const all = fs.readdirSync(EXPORT_DIR, { withFileTypes: true });
  return all
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => name.toLowerCase().endsWith(".csv"));
}

function sniffDelimiter(line) {
  const semi = (line.match(/;/g) || []).length;
  const comma = (line.match(/,/g) || []).length;
  return semi >= comma ? ";" : ",";
}

function parseCsv(content) {
  // rimuove BOM se presente
  const cleaned = content.replace(/^\uFEFF/, "");
  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) throw new Error("CSV must have header + at least 1 row");

  const delim = sniffDelimiter(lines[0]);
  const header = lines[0].split(delim).map((s) => s.trim().toLowerCase());

  for (const r of REQUIRED) {
    if (!header.includes(r)) throw new Error(`Missing required column: ${r}`);
  }

  const idx = {
    sku: header.indexOf("sku"),
    warehouse: header.indexOf("warehouse"),
    quantity: header.indexOf("quantity"),
  };

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delim).map((s) => s.trim());
    if (cols.length < header.length) continue;

    const sku = cols[idx.sku];
    const warehouse = cols[idx.warehouse];
    const quantity = Number(cols[idx.quantity]);

    if (!sku || !warehouse) continue;
    if (!Number.isFinite(quantity)) continue;

    // lineNo “umana”: header=1, prima riga dati=2, ecc.
    rows.push({ sku, warehouse, quantity, lineNo: i + 1 });
  }

  return rows;
}

function makeReference(fileName, lineNo, sku, warehouse, delta) {
  // idempotente: stessa riga dello stesso file e stesso delta produce stessa reference
  return `ER_EXPORT_${fileName}_L${lineNo}_${sku}_${warehouse}_D${delta}`;
}

async function pushMovementsBulk(movements) {
  mustEnv("INV_SYNC_SECRET", INV_SYNC_SECRET);
  mustEnv("STRAPI_URL", STRAPI_URL);

  const url = `${STRAPI_URL}/api/inv-sync/movements/bulk`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SYNC-SECRET": INV_SYNC_SECRET,
    },
    cache: "no-store",
    body: JSON.stringify({ movements }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Strapi bulk failed: ${res.status} ${res.statusText} | ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function getOnHand(sku, warehouse) {
  mustEnv("INV_AVAILABILITY_SECRET", INV_AVAILABILITY_SECRET);
  mustEnv("STRAPI_URL", STRAPI_URL);

  const url =
    `${STRAPI_URL}/api/inv-availability?skus=${encodeURIComponent(sku)}` +
    `&warehouse=${encodeURIComponent(warehouse)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { "X-INV-SECRET": INV_AVAILABILITY_SECRET },
    cache: "no-store",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Availability failed: ${res.status} ${res.statusText} | ${text}`);
  }

  const json = JSON.parse(text);
  const onHand = json?.data?.[warehouse]?.[sku]?.onHand;

  // se non trovato, assumiamo 0
  if (!Number.isFinite(onHand)) return 0;
  return onHand;
}

function moveFile(from, toDir) {
  const to = path.join(toDir, path.basename(from));
  fs.renameSync(from, to);
  return to;
}

async function processOneFile(fileName) {
  const filePath = path.join(EXPORT_DIR, fileName);
  const raw = fs.readFileSync(filePath, "utf8");

  const rows = parseCsv(raw);
  if (rows.length === 0) throw new Error("No valid rows found in CSV");

  // Dedup per SKU+warehouse (se il file ha righe duplicate, l'ultima vince)
  const latestByKey = new Map();
  for (const r of rows) {
    latestByKey.set(`${r.sku}__${r.warehouse}`, r);
  }
  const uniqueRows = Array.from(latestByKey.values());

  // Cache availability nello stesso file/run
  const onHandCache = new Map(); // key => number

  const movements = [];
  for (const r of uniqueRows) {
    const desired = Number(r.quantity);
    if (!Number.isFinite(desired) || desired < 0) continue;

    const key = `${r.sku}__${r.warehouse}`;
    let current;
    if (onHandCache.has(key)) {
      current = onHandCache.get(key);
    } else {
      current = await getOnHand(r.sku, r.warehouse);
      onHandCache.set(key, current);
    }

    const delta = desired - current;
    if (delta === 0) continue;

    movements.push({
      reference: makeReference(fileName, r.lineNo, r.sku, r.warehouse, delta), // ✅ niente +1
      type: "ADJUST",
      quantity: Math.max(1, Math.floor(Math.abs(delta))),
      warehouse: r.warehouse,
      sku: r.sku,
      adjustDirection: delta > 0 ? "IN" : "OUT",
      note: `easyretail export delta: desired=${desired} current=${current} file=${fileName}`,
    });
  }

  if (movements.length === 0) {
    logInfo(`[agent] ${fileName}: no delta movements needed (already aligned)`);
    const moved = moveFile(filePath, PROCESSED_DIR);
    logInfo(`[agent] moved to processed: ${moved}`);
    return;
  }

  logInfo(`[agent] ${fileName}: pushing ${movements.length} delta movements...`);
  const result = await pushMovementsBulk(movements);
  logInfo(`[agent] ${fileName}: result: ${JSON.stringify(result)}`);

  const moved = moveFile(filePath, PROCESSED_DIR);
  logInfo(`[agent] moved to processed: ${moved}`);
}

async function main() {
  ensureDirs();

  logInfo("[agent] run start");

  const files = listCandidateFiles();
  if (files.length === 0) {
    logInfo(`[agent] no CSV files found in: ${EXPORT_DIR}`);
    logInfo("[agent] run end");
    return;
  }

  let ok = 0;
  let failed = 0;

  // Processa uno alla volta (semplice, sicuro)
  for (const f of files) {
    try {
      await processOneFile(f);
      ok += 1;
    } catch (e) {
      failed += 1;
      logError(`[agent] FAILED file=${f}: ${e?.message ?? e}`);
      try {
        const moved = moveFile(path.join(EXPORT_DIR, f), FAILED_DIR);
        logInfo(`[agent] moved to failed: ${moved}`);
      } catch {}
    }
  }

  logInfo(`[agent] run end (processed=${ok}, failed=${failed})`);
}

await main();
