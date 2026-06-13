import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dbDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, "debates.db");
  const db = new Database(dbPath);

  // Enable WAL mode for better concurrency and write speed
  db.pragma("journal_mode = WAL");

  // Create debates table if it does not exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS debates (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      idea_text TEXT NOT NULL,
      room_id TEXT NOT NULL,
      room_name TEXT NOT NULL,
      transcript TEXT NOT NULL,
      verdict TEXT NOT NULL
    )
  `);

  // Add v1.1 rebuttal columns if they do not exist
  try {
    db.exec("ALTER TABLE debates ADD COLUMN rebuttal_text TEXT");
  } catch (e) {
    // Already exists, safe to ignore
  }
  try {
    db.exec("ALTER TABLE debates ADD COLUMN rebuttal_transcript TEXT");
  } catch (e) {
    // Already exists, safe to ignore
  }
  try {
    db.exec("ALTER TABLE debates ADD COLUMN final_verdict TEXT");
  } catch (e) {
    // Already exists, safe to ignore
  }

  dbInstance = db;
  return db;
}
