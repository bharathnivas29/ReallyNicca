const express = require('express');
const { spawn } = require('child_process');
const router = express.Router();

router.post('/verify-entity', async (req, res) => {
  try {
    const { entity } = req.body;
    
    if (!entity) {
      return res.status(400).json({ error: 'Entity text required' });
    }

    // Call Python WikiData lookup
    const pythonPath = process.env.PYTHON_PATH || 'python';
    const scriptPath = './python/verify_entity.py';
    
    const pythonProcess = spawn(pythonPath, [scriptPath]);
    
    let result = '';
    let error = '';
    
    pythonProcess.stdin.write(entity);
    pythonProcess.stdin.end();
    
    pythonProcess.stdout.on('data', (data) => {
      result += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Verification error:', error);
        return res.status(500).json({ error: 'Verification failed' });
      }
      
      try {
        const parsed = JSON.parse(result);
        res.json(parsed);
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse result' });
      }
    });
  } catch (error) {
    console.error('Verification route error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;