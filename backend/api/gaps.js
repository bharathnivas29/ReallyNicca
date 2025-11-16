const express = require('express');
const router = express.Router();
const { execFile } = require('child_process');
const path = require('path');

// Use venv Python (Windows path)
const PYTHON_PATH = process.env.PYTHON_PATH || path.join(__dirname, '../venv/Scripts/python.exe');
const GAP_ANALYZER_SCRIPT = path.join(__dirname, '../python/gap_analyzer.py');

// POST /api/gaps/analyze - Analyze graph for structural gaps
router.post('/analyze', async (req, res) => {
  try {
    const { nodes, edges } = req.body;

    if (!nodes || !edges) {
      return res.status(400).json({ error: 'Missing nodes or edges in request body' });
    }

    if (nodes.length < 5 || edges.length < 2) {
      return res.json({ 
        gaps: [], 
        message: 'Graph too small for gap analysis (need 5+ nodes, 2+ edges)',
        num_communities: 0,
        num_gaps_detected: 0
      });
    }

    console.log(`🔍 Analyzing gaps for graph with ${nodes.length} nodes, ${edges.length} edges`);

    // Prepare graph data for Python script
    const graphData = JSON.stringify({ nodes, edges });

    // Spawn Python process
    const pythonProcess = execFile(
      PYTHON_PATH,
      [GAP_ANALYZER_SCRIPT],
      { 
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        cwd: path.join(__dirname, '..')
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error('❌ Gap analysis error:', stderr);
          return res.status(500).json({ 
            error: 'Gap analysis failed', 
            details: stderr,
            hint: 'Make sure gap_analyzer.py exists and python-louvain is installed'
          });
        }

        if (stderr) {
          console.log('📊 Gap analysis logs:', stderr);
        }

        try {
          const result = JSON.parse(stdout);
          console.log(`✅ Gap analysis complete: ${result.num_gaps_detected} gaps found`);
          res.json(result);
        } catch (parseError) {
          console.error('❌ Failed to parse gap analysis output:', stdout);
          res.status(500).json({ 
            error: 'Invalid gap analysis output',
            raw_output: stdout.substring(0, 500)
          });
        }
      }
    );

    // Send graph data to Python stdin
    pythonProcess.stdin.write(graphData);
    pythonProcess.stdin.end();

  } catch (error) {
    console.error('❌ Gap analysis request error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
