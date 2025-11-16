const express = require('express');
const router = express.Router();
const db = require('../db/init');
const { v4: uuidv4 } = require('uuid');

// GET /api/graphs - List all saved graphs
router.get('/', (req, res) => {
  try {
    const graphs = db.prepare(`
      SELECT 
        g.id, 
        g.name, 
        g.created_at,
        g.updated_at,
        COUNT(DISTINCT n.id) as node_count,
        COUNT(DISTINCT e.from_node || '-' || e.to_node) as edge_count
      FROM graphs g
      LEFT JOIN nodes n ON g.id = n.graph_id
      LEFT JOIN edges e ON g.id = e.graph_id
      GROUP BY g.id
      ORDER BY g.updated_at DESC
    `).all();
    
    res.json(graphs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/graphs - Save a new graph
router.post('/', (req, res) => {
  try {
    const { name, nodes, edges } = req.body;
    
    console.log('📥 Save request:', { name, nodeCount: nodes?.length, edgeCount: edges?.length });
    
    // ✅ LOG SAMPLE DATA
    console.log('Sample node:', nodes[0]);
    console.log('Sample edge:', edges[0]);
    
    if (!name || !nodes || !edges) {
      return res.status(400).json({ error: 'Missing required fields: name, nodes, edges' });
    }
    
    const graphId = uuidv4();
    
    const saveGraph = db.transaction(() => {
      // Insert graph
      db.prepare('INSERT INTO graphs (id, name) VALUES (?, ?)').run(graphId, name);
      
      // Insert nodes with validation
      const insertNode = db.prepare('INSERT INTO nodes (id, graph_id, label, type) VALUES (?, ?, ?, ?)');
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        try {
          // ✅ Ensure id is an integer and validate all fields
          const nodeId = typeof node.id === 'string' ? parseInt(node.id) : node.id;
          const nodeLabel = String(node.label || '');
          const nodeType = String(node.type || '');
          
          insertNode.run(nodeId, graphId, nodeLabel, nodeType);
        } catch (err) {
          console.error(`❌ Error inserting node ${i}:`, node, err);
          throw err;
        }
      }
      
      // Insert edges with validation
      const insertEdge = db.prepare('INSERT INTO edges (graph_id, from_node, to_node, label, source) VALUES (?, ?, ?, ?, ?)');
      for (let i = 0; i < edges.length; i++) {
        const edge = edges[i];
        try {
          // ✅ Ensure from/to are integers
          const fromNode = typeof edge.from === 'string' ? parseInt(edge.from) : edge.from;
          const toNode = typeof edge.to === 'string' ? parseInt(edge.to) : edge.to;
          const edgeLabel = String(edge.label || '');
          const edgeSource = edge.source ? String(edge.source) : null;
          
          insertEdge.run(graphId, fromNode, toNode, edgeLabel, edgeSource);
        } catch (err) {
          console.error(`❌ Error inserting edge ${i}:`, edge, err);
          throw err;
        }
      }
    });
    
    saveGraph();
    
    console.log('✅ Graph saved successfully:', graphId);
    res.json({ id: graphId, message: 'Graph saved successfully' });
  } catch (error) {
    console.error('❌ ERROR SAVING GRAPH:', error);
    res.status(500).json({ error: error.message });
  }
});



// GET /api/graphs/:id - Get a specific graph
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const graph = db.prepare('SELECT * FROM graphs WHERE id = ?').get(id);
    if (!graph) {
      return res.status(404).json({ error: 'Graph not found' });
    }
    
    const nodes = db.prepare('SELECT id, label, type FROM nodes WHERE graph_id = ?').all(id);
    const edges = db.prepare('SELECT from_node as "from", to_node as "to", label, source FROM edges WHERE graph_id = ?').all(id);
    
    res.json({
      id: graph.id,
      name: graph.name,
      created_at: graph.created_at,
      updated_at: graph.updated_at,
      nodes,
      edges
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/graphs/:id - Delete a graph
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const result = db.prepare('DELETE FROM graphs WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Graph not found' });
    }
    
    res.json({ message: 'Graph deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/graphs/:id/export/json - Export graph as JSON
router.get('/:id/export/json', (req, res) => {
  try {
    const { id } = req.params;
    
    const graph = db.prepare('SELECT * FROM graphs WHERE id = ?').get(id);
    if (!graph) {
      return res.status(404).json({ error: 'Graph not found' });
    }
    
    const nodes = db.prepare('SELECT id, label, type FROM nodes WHERE graph_id = ?').all(id);
    const edges = db.prepare('SELECT from_node as "from", to_node as "to", label, source FROM edges WHERE graph_id = ?').all(id);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${graph.name}.json"`);
    res.json({ name: graph.name, nodes, edges });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/graphs/:id/export/csv - Export graph as CSV
router.get('/:id/export/csv', (req, res) => {
  try {
    const { id } = req.params;
    
    const graph = db.prepare('SELECT * FROM graphs WHERE id = ?').get(id);
    if (!graph) {
      return res.status(404).json({ error: 'Graph not found' });
    }
    
    const nodes = db.prepare('SELECT id, label, type FROM nodes WHERE graph_id = ?').all(id);
    const edges = db.prepare('SELECT from_node as "from", to_node as "to", label, source FROM edges WHERE graph_id = ?').all(id);
    
    // Create CSV content
    let csv = 'NODES\nid,label,type\n';
    nodes.forEach(n => csv += `${n.id},"${n.label}",${n.type}\n`);
    csv += '\nEDGES\nfrom,to,label,source\n';
    edges.forEach(e => csv += `${e.from},${e.to},"${e.label}",${e.source || ''}\n`);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${graph.name}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
