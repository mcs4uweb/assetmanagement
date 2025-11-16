'use client';

// DuckDB-WASM client service for browser usage in Next.js.
// Similar in spirit to src/lib/firebase.ts, this exposes
// a singleton initializer plus small helpers to connect and query.

import type * as DuckDBNS from '@duckdb/duckdb-wasm';

let duckdbModulePromise: Promise<typeof DuckDBNS> | null = null;
let duckdbInstancePromise: Promise<DuckDBNS.AsyncDuckDB> | null = null;
let duckdbConnectionPromise: Promise<DuckDBNS.AsyncDuckDBConnection> | null = null;

async function loadDuckDBModule() {
  if (duckdbModulePromise) return duckdbModulePromise;
  duckdbModulePromise = import('@duckdb/duckdb-wasm');
  return duckdbModulePromise;
}

export async function getDuckDB(): Promise<DuckDBNS.AsyncDuckDB> {
  if (typeof window === 'undefined') {
    throw new Error('DuckDB-WASM is only available in the browser');
  }
  if (duckdbInstancePromise) return duckdbInstancePromise;

  duckdbInstancePromise = (async () => {
    const duckdb = await loadDuckDBModule();

    // Prefer CDN bundles for simplicity and zero-config asset hosting.
    // You can switch to `duckdb.getBundledBundles()` if hosting assets locally.
    const bundles = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(bundles);
    if (!bundle || !bundle.mainWorker || !bundle.mainModule) {
      throw new Error('DuckDB-WASM bundle not available for this environment');
    }

    const worker = new Worker(bundle.mainWorker, { type: 'module' });
    const logger = new duckdb.ConsoleLogger();
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker || undefined);
    return db;
  })();

  return duckdbInstancePromise;
}

export async function getConnection(): Promise<DuckDBNS.AsyncDuckDBConnection> {
  if (duckdbConnectionPromise) return duckdbConnectionPromise;
  duckdbConnectionPromise = (async () => {
    const db = await getDuckDB();
    return db.connect();
  })();
  return duckdbConnectionPromise;
}

// Simple helpers
export async function query(sql: string) {
  const conn = await getConnection();
  return conn.query(sql);
}

export async function queryObjects<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const table = await query(sql);
  // DuckDB-WASM returns an Arrow-style table with toArray() for row objects
  // in recent versions. If unavailable, consumers can work with the table API directly.
  // @ts-ignore - depending on version, toArray is available at runtime
  const rows = table?.toArray ? table.toArray() : [];
  return rows as T[];
}

// Register a CSV/Parquet/etc. file from a URL into the virtual FS, then query it.
export async function registerFileFromUrl(url: string, vfsPath?: string) {
  const db = await getDuckDB();
  const name = vfsPath || url.split('/').pop() || 'file.bin';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  await db.registerFileBuffer(name, buf);
  return name;
}

export async function importCsvFromUrl(url: string, tableName: string) {
  const vfsName = await registerFileFromUrl(url);
  const conn = await getConnection();
  // Use DuckDB's auto-detect CSV loader
  await conn.query(`CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM read_csv_auto('${vfsName}')`);
}

// Reset helpers (useful for development/testing)
export async function resetDuckDB() {
  if (duckdbConnectionPromise) {
    const conn = await duckdbConnectionPromise;
    try {
      await conn.close();
    } catch {}
  }
  duckdbConnectionPromise = null;
  duckdbInstancePromise = null;
}

// Example usage (client components only):
//   import { getConnection, queryObjects } from '@/lib/duckdb';
//   const rows = await queryObjects('SELECT 42 AS answer');
//   console.log(rows); // [{ answer: 42 }]
