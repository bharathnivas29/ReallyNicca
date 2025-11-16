const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'graphs.db');
const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS graphs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS nodes (
    id INTEGER NOT NULL,
    graph_id TEXT NOT NULL,
    label TEXT NOT NULL,
    type TEXT NOT NULL,
    FOREIGN KEY(graph_id) REFERENCES graphs(id) ON DELETE CASCADE,
    PRIMARY KEY(graph_id, id)
  );

  CREATE TABLE IF NOT EXISTS edges (
    graph_id TEXT NOT NULL,
    from_node INTEGER NOT NULL,
    to_node INTEGER NOT NULL,
    label TEXT NOT NULL,
    source TEXT,
    FOREIGN KEY(graph_id) REFERENCES graphs(id) ON DELETE CASCADE,
    PRIMARY KEY(graph_id, from_node, to_node)
  );
`);

// ✅ Migration: Add updated_at column if it doesn't exist
try {
  const columns = db.prepare("PRAGMA table_info(graphs)").all();
  const hasUpdatedAt = columns.some(col => col.name === 'updated_at');
  
  if (!hasUpdatedAt) {
    console.log('⚙️  Migrating database: Adding updated_at column...');
    db.exec(`ALTER TABLE graphs ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
    console.log('✅ Migration complete');
  }
} catch (error) {
  console.error('Migration error:', error);
}

console.log('✅ Database initialized successfully');

module.exports = db;
