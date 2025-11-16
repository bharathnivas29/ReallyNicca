const express = require('express');
const router = express.Router();

// Lazy load OpenAI (only if API key is set)
let openai = null;
function getOpenAI() {
  if (!openai && process.env.OPENAI_API_KEY) {
    const { OpenAI } = require('openai');
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

// POST /api/ideas/generate - Generate research ideas from gaps
router.post('/generate', async (req, res) => {
  try {
    const { gap, graph_context } = req.body;

    if (!gap) {
      return res.status(400).json({ error: 'Missing gap data in request body' });
    }

    const client = getOpenAI();
    if (!client) {
      return res.status(500).json({ 
        error: 'OpenAI API key not configured',
        hint: 'Add OPENAI_API_KEY to your .env file'
      });
    }

    console.log(`💡 Generating ideas for gap: ${gap.title}`);

    const cluster_1_text = gap.cluster_1_keywords.join(", ");
    const cluster_2_text = gap.cluster_2_keywords.join(", ");

    const prompt = `You are a research ideation assistant. Analyze this knowledge gap and generate novel ideas:

**Cluster 1 Concepts**: ${cluster_1_text}
**Cluster 2 Concepts**: ${cluster_2_text}
**Gap Significance**: ${gap.significance}
**Description**: ${gap.description}
**Semantic Distance**: ${gap.semantic_distance ? gap.semantic_distance.toFixed(2) : 'N/A'} (0=similar, 1=different)

Generate 5 novel research questions or content ideas that bridge these two clusters. For each idea:
1. **bridging_question**: The main research question or content idea
2. **novelty**: Why this is novel (what's currently missing)
3. **methodology**: Suggested approach or methodology
4. **impact**: Potential impact (High/Medium/Low)

Output as a JSON object with an "ideas" array containing exactly 5 ideas.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 1500
    });

    const ideas_raw = JSON.parse(response.choices[0].message.content);
    const ideas = ideas_raw.ideas || [];

    // Add novelty scores (simple heuristic: first idea = highest score)
    const scored_ideas = ideas.map((idea, idx) => ({
      ...idea,
      novelty_score: Math.max(70, 85 - (idx * 5)), // 85, 80, 75, 70, 70
      semantic_distance: gap.semantic_distance || 0.5,
      existing_connections: gap.potential_connections || 0
    }));

    console.log(`✅ Generated ${scored_ideas.length} ideas`);

    res.json({
      ideas: scored_ideas,
      gap_context: {
        title: gap.title,
        significance: gap.significance,
        gap_score: gap.gap_score
      }
    });

  } catch (error) {
    console.error('❌ Idea generation error:', error);
    
    if (error.code === 'insufficient_quota') {
      return res.status(402).json({ 
        error: 'OpenAI API quota exceeded',
        hint: 'Check your OpenAI billing: https://platform.openai.com/account/billing'
      });
    }
    
    res.status(500).json({ 
      error: error.message,
      type: error.type || 'unknown'
    });
  }
});

module.exports = router;
