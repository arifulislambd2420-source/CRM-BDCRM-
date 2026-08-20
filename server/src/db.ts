import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = process.env.DB_PATH ?? './data/crm.db';

// Ensure the data directory exists before opening the file.
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Idempotent schema. Every table has TEXT ids because that's what the frontend
 * already generates (e.g. `cust-abc123`) — keeping the id shape lets us seed
 * directly from the existing mockData without a translation layer.
 */
export function migrate(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id                TEXT PRIMARY KEY,
      name              TEXT NOT NULL,
      email             TEXT NOT NULL UNIQUE,
      password_hash     TEXT NOT NULL,
      role              TEXT NOT NULL CHECK(role IN ('admin', 'sub_admin', 'store_manager')),
      store_id          TEXT,
      can_edit_own_notes INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS stores (
      id   TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pipelines (
      id   TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stages (
      id          TEXT PRIMARY KEY,
      pipeline_id TEXT NOT NULL,
      name        TEXT NOT NULL,
      sort_index  INTEGER NOT NULL,
      FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_stages_pipeline ON stages(pipeline_id, sort_index);

    CREATE TABLE IF NOT EXISTS customers (
      id                TEXT PRIMARY KEY,
      name              TEXT NOT NULL,
      phone             TEXT NOT NULL,
      address           TEXT NOT NULL DEFAULT '',
      source            TEXT NOT NULL DEFAULT '',
      pipeline_id       TEXT NOT NULL,
      current_stage_id  TEXT NOT NULL,
      store_id          TEXT NOT NULL,
      created_at        TEXT NOT NULL,
      created_by_id     TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_customers_store ON customers(store_id);
    CREATE INDEX IF NOT EXISTS idx_customers_pipeline ON customers(pipeline_id);
    CREATE INDEX IF NOT EXISTS idx_customers_stage ON customers(current_stage_id);

    CREATE TABLE IF NOT EXISTS notes (
      id                TEXT PRIMARY KEY,
      customer_id       TEXT NOT NULL,
      number            INTEGER NOT NULL,
      text              TEXT NOT NULL,
      created_at        TEXT NOT NULL,
      created_by_id     TEXT NOT NULL,
      created_by_name   TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_notes_customer ON notes(customer_id, number);

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

export function isEmpty(): boolean {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM users`).get() as { n: number };
  return row.n === 0;
}
