const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const pdfParse = require('pdf-parse');

const router = express.Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads/';
const PYTHON_PATH = process.env.PYTHON_PATH || path.join(__dirname, '../venv/Scripts/python.exe');
const SPACY_SCRIPT = path.join(__dirname, '../python/extractor.py');

// Setup Multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// ✅ NEW: Sanitize text to remove invalid UTF-8 characters
function sanitizeText(text) {
  if (!text) return '';
  
  // Remove surrogate pairs and other invalid Unicode
  return text
    .replace(/[\uD800-\uDFFF]/g, '') // Remove surrogates
    .replace(/\uFFFD/g, '') // Remove replacement characters
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters except \t, \n, \r
    .trim();
}

// POST /api/extract - file or direct text
router.post('/', upload.single('file'), async (req, res) => {
  try {
    console.log('req.body:', req.body);
    console.log('req.file:', req.file);

    let rawText = '';

    // Extract text from file or request body
    if (req.file) {
      const filePath = req.file.path;
      const ext = path.extname(req.file.originalname).toLowerCase();

      if (ext === '.pdf') {
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        rawText = pdfData.text;
        console.log('Extracted rawText (PDF):', rawText.substring(0, 200));
      } else if (ext === '.txt' || ext === '.md') {
        rawText = fs.readFileSync(filePath, 'utf-8');
      } else {
        return res.status(400).json({ error: 'Unsupported file type. Use PDF, TXT, or MD.' });
      }

      // Clean up uploaded file
      fs.unlinkSync(filePath);
    } else if (req.body.text) {
      rawText = req.body.text;
    } else {
      return res.status(400).json({ error: 'No file or text provided!' });
    }

    if (!rawText.trim()) {
      return res.status(400).json({ error: 'Empty text extracted!' });
    }

    // ✅ SANITIZE TEXT BEFORE PASSING TO PYTHON
    const cleanText = sanitizeText(rawText);
    console.log('Sanitized text length:', cleanText.length);

    // Spawn Python process
    console.log('Passing to Python:', cleanText.substring(0, 200));
    
    const pythonProcess = execFile(
      PYTHON_PATH,
      [SPACY_SCRIPT],
      { 
        maxBuffer: 10 * 1024 * 1024,
        cwd: path.join(__dirname, '..')
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error('Python error:', error, stderr);
          return res.status(500).json({ 
            error: 'Entity extraction failed', 
            details: stderr,
            pythonError: error.message
          });
        }

        if (stderr) {
          console.log('Python stderr:', stderr);
        }

        try {
          const graphData = JSON.parse(stdout);
          console.log(`✅ Extraction complete: ${graphData.nodes?.length || 0} nodes, ${graphData.edges?.length || 0} edges`);
          res.json(graphData);
        } catch (parseError) {
          console.error('Failed to parse Python output:', stdout);
          res.status(500).json({ 
            error: 'Invalid Python output',
            raw: stdout.substring(0, 500)
          });
        }
      }
    );

    // Write sanitized text to Python stdin
    pythonProcess.stdin.write(cleanText, 'utf8');
    pythonProcess.stdin.end();

  } catch (error) {
    console.error('Extraction error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;