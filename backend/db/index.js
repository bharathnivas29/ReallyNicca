// /db/index.js
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'graphs.db');
const db = new Database(DB_PATH);

// Ensure graphs table exists
db.prepare(`
  CREATE TABLE IF NOT EXISTS graphs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    nodes TEXT,
    edges TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

function saveGraph(name, nodes, edges) {
  const stmt = db.prepare('INSERT INTO graphs (name, nodes, edges) VALUES (?, ?, ?)');
  const info = stmt.run(name, JSON.stringify(nodes), JSON.stringify(edges));
  return info.lastInsertRowid;
}

function getGraph(id) {
  const stmt = db.prepare('SELECT * FROM graphs WHERE id = ?');
  const graph = stmt.get(id);
  if (graph) {
    graph.nodes = JSON.parse(graph.nodes);
    graph.edges = JSON.parse(graph.edges);
  }
  return graph;
}

function listGraphs() {
  const stmt = db.prepare('SELECT id, name, created_at FROM graphs ORDER BY created_at DESC');
  return stmt.all();
}

function deleteGraph(id) {
  const stmt = db.prepare('DELETE FROM graphs WHERE id = ?');
  return stmt.run(id);
}

module.exports = {
  saveGraph,
  getGraph,
  listGraphs,
  deleteGraph,
};
