#!/usr/bin/env python3
"""
Really Nicca - Enhanced Knowledge Graph Extractor v2.0
4-Level Extraction: Dependency + Pattern + Semantic + Topic Modeling
OPTIMIZED: Global model caching for faster repeated extractions
"""

import sys
import json
import spacy
import re
from collections import defaultdict
from typing import List, Dict, Tuple, Optional

# ============================================================================
# CONFIGURATION
# ============================================================================

# Level 3: Semantic Similarity
USE_SEMANTIC_EMBEDDINGS = True
SEMANTIC_THRESHOLD = 0.75

# Level 4: Topic Modeling
USE_TOPIC_MODELING = True
NUM_TOPICS = 5  # Extract 5 main themes per document

# Try loading advanced libraries
try:
    from sentence_transformers import SentenceTransformer
    from sklearn.metrics.pairwise import cosine_similarity
    import numpy as np
    SEMANTIC_AVAILABLE = True
except ImportError:
    print("Warning: sentence-transformers not installed. Run: pip install sentence-transformers", file=sys.stderr)
    SEMANTIC_AVAILABLE = False
    USE_SEMANTIC_EMBEDDINGS = False

try:
    from bertopic import BERTopic
    TOPIC_MODELING_AVAILABLE = True
except ImportError:
    print("Warning: bertopic not installed. Run: pip install bertopic", file=sys.stderr)
    TOPIC_MODELING_AVAILABLE = False
    USE_TOPIC_MODELING = False

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def sanitize_text(text):
    """Remove invalid UTF-8 characters and surrogates."""
    if not text:
        return ""
    
    # Method 1: Encode/decode to remove invalid chars
    clean_text = text.encode('utf-8', errors='ignore').decode('utf-8', errors='ignore')
    
    # Method 2: Remove remaining control characters
    clean_text = re.sub(r'[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]', '', clean_text)
    
    return clean_text.strip()

def find_entity_containing(token, entities):
    """Find the entity span that contains the given token."""
    for ent in entities:
        if ent.start <= token.i < ent.end:
            return ent
    return None

def get_entity_context(doc, entity, window=20):
    """Get surrounding text for entity (±window tokens)."""
    start = max(0, entity.start - window)
    end = min(len(doc), entity.end + window)
    return doc[start:end].text

# ============================================================================
# LEVEL 1: DEPENDENCY-BASED EXTRACTION
# ============================================================================

def extract_dependency_relationships(doc, entities, node_ids) -> List[Dict]:
    edges = []
    relationship_map = defaultdict(list)
    
    # Verb-based relationships
    for token in doc:
        if token.pos_ == "VERB":
            subjects = [child for child in token.children if child.dep_ in ("nsubj", "nsubjpass", "agent")]
            objects = [child for child in token.children if child.dep_ in ("dobj", "pobj", "attr", "dative")]
            
            for subj in subjects:
                for obj in objects:
                    subj_ent = find_entity_containing(subj, entities)
                    obj_ent = find_entity_containing(obj, entities)
                    
                    if subj_ent and obj_ent and subj_ent.text != obj_ent.text:
                        verb_label = token.lemma_.lower()
                        relationship_map[(subj_ent.text, obj_ent.text)].append(verb_label)
    
    # Copula relationships
    for token in doc:
        if token.lemma_ == "be" and token.pos_ == "AUX":
            subjects = [child for child in token.head.children if child.dep_ == "nsubj"]
            attributes = [child for child in token.head.children if child.dep_ in ("attr", "acomp")]
            
            for subj in subjects:
                for attr in attributes:
                    subj_ent = find_entity_containing(subj, entities)
                    attr_ent = find_entity_containing(attr, entities)
                    
                    if subj_ent and attr_ent and subj_ent.text != attr_ent.text:
                        relationship_map[(subj_ent.text, attr_ent.text)].append("is")
    
    for (from_ent, to_ent), verbs in relationship_map.items():
        if from_ent in node_ids and to_ent in node_ids:
            label = max(set(verbs), key=verbs.count) if verbs else "related"
            edges.append({
                "from": node_ids[from_ent],
                "to": node_ids[to_ent],
                "label": label,
                "source": "dependency"
            })
    
    return edges

# ============================================================================
# LEVEL 2: PATTERN-BASED EXTRACTION
# ============================================================================

def extract_pattern_relationships(doc, entities, node_ids) -> List[Dict]:
    edges = []
    
    # Location relationships
    for ent in entities:
        if ent.label_ in ("GPE", "LOC", "FAC"):
            for other_ent in entities:
                if other_ent.label_ in ("PERSON", "ORG") and other_ent != ent:
                    start = min(ent.end, other_ent.end)
                    end = max(ent.start, other_ent.start)
                    between_tokens = doc[start:end]
                    location_preps = ["in", "at", "from", "near", "based", "located", "headquartered"]
                    
                    if any(tok.text.lower() in location_preps for tok in between_tokens):
                        edges.append({
                            "from": node_ids.get(other_ent.text),
                            "to": node_ids.get(ent.text),
                            "label": "located_in",
                            "source": "pattern"
                        })
    
    # Temporal relationships
    for ent in entities:
        if ent.label_ == "DATE":
            for other_ent in entities:
                if other_ent.label_ in ("EVENT", "WORK_OF_ART", "LAW") and abs(ent.start - other_ent.start) < 15:
                    edges.append({
                        "from": node_ids.get(other_ent.text),
                        "to": node_ids.get(ent.text),
                        "label": "occurred_on",
                        "source": "pattern"
                    })
    
    # Organizational relationships
    for ent in entities:
        if ent.label_ == "ORG":
            for other_ent in entities:
                if other_ent.label_ == "PERSON" and other_ent != ent:
                    start = min(ent.end, other_ent.end)
                    end = max(ent.start, other_ent.start)
                    between_tokens = doc[start:end]
                    work_indicators = ["works", "work", "employed", "ceo", "founded", "created", "leads"]
                    
                    if any(tok.text.lower() in work_indicators for tok in between_tokens):
                        edges.append({
                            "from": node_ids.get(other_ent.text),
                            "to": node_ids.get(ent.text),
                            "label": "works_at",
                            "source": "pattern"
                        })
    
    # Filter out None IDs
    edges = [e for e in edges if e["from"] and e["to"]]
    return edges

# ============================================================================
# GLOBAL MODEL CACHE (PERFORMANCE OPTIMIZATION)
# ============================================================================

# Load spaCy model globally (happens once on first import)
try:
    nlp = spacy.load("en_core_web_sm")
    print("✅ spaCy model loaded", file=sys.stderr)
except OSError:
    print("ERROR: spaCy model 'en_core_web_sm' not found. Run: python -m spacy download en_core_web_sm", file=sys.stderr)
    sys.exit(1)

# ✅ NEW: Cache sentence transformer model globally
_semantic_model_cache = None

def get_semantic_model():
    """Load and cache the sentence transformer model (lazy loading)."""
    global _semantic_model_cache
    
    if _semantic_model_cache is None and SEMANTIC_AVAILABLE:
        print("📥 Loading sentence transformer model (first time only)...", file=sys.stderr)
        try:
            _semantic_model_cache = SentenceTransformer('all-mpnet-base-v2')
            print("✅ Sentence transformer model loaded and cached", file=sys.stderr)
        except Exception as e:
            print(f"❌ Failed to load sentence transformer: {str(e)}", file=sys.stderr)
            return None
    
    return _semantic_model_cache

# ============================================================================
# LEVEL 3: SEMANTIC EMBEDDINGS (OPTIMIZED)
# ============================================================================

def extract_semantic_relationships(doc, nodes, node_ids) -> List[Dict]:
    """Find implicit semantic relationships using sentence embeddings."""
    if not USE_SEMANTIC_EMBEDDINGS or not SEMANTIC_AVAILABLE:
        return []
    
    edges = []
    
    try:
        # ✅ Use cached model instead of loading every time
        model = get_semantic_model()
        if model is None:
            return []
        
        # Get context for each entity
        entity_contexts = []
        entities_list = []
        
        for node in nodes:
            label = node["label"]
            # Find entity in doc
            entity = None
            for ent in doc.ents:
                if ent.text == label:
                    entity = ent
                    break
            
            if entity:
                context = get_entity_context(doc, entity, window=20)
                entity_contexts.append(context)
                entities_list.append(node)
        
        if len(entities_list) < 2:
            return []
        
        # Generate embeddings
        embeddings = model.encode(entity_contexts, show_progress_bar=False)
        
        # Calculate pairwise similarities
        for i in range(len(entities_list)):
            for j in range(i + 1, len(entities_list)):
                similarity = cosine_similarity([embeddings[i]], [embeddings[j]])[0][0]
                
                if similarity > SEMANTIC_THRESHOLD:
                    edges.append({
                        "from": entities_list[i]["id"],
                        "to": entities_list[j]["id"],
                        "label": "semantically_related",
                        "source": "semantic",
                        "weight": float(similarity)
                    })
        
        print(f"✅ Level 3: Found {len(edges)} semantic relationships", file=sys.stderr)
    
    except Exception as e:
        print(f"Warning: Semantic extraction failed: {str(e)}", file=sys.stderr)
    
    return edges

# ============================================================================
# LEVEL 4: TOPIC MODELING (OPTIMIZED)
# ============================================================================

def extract_topics(text, nodes, counter) -> Tuple[List[Dict], List[Dict], int]:
    """Extract main themes using BERTopic and link entities to themes."""
    if not USE_TOPIC_MODELING or not TOPIC_MODELING_AVAILABLE or len(text) < 100:
        return [], [], counter
    
    theme_nodes = []
    theme_edges = []
    
    try:
        # ✅ Use cached model for BERTopic embedding
        sentence_model = get_semantic_model()
        if sentence_model is None:
            return [], [], counter
        
        topic_model = BERTopic(
            embedding_model=sentence_model,
            nr_topics=NUM_TOPICS,
            verbose=False,
            calculate_probabilities=False
        )
        
        # Split text into sentences for topic modeling
        sentences = [sent.text for sent in nlp(text).sents if len(sent.text.strip()) > 20]
        
        if len(sentences) < 5:
            return [], [], counter
        
        # Fit model
        topics, _ = topic_model.fit_transform(sentences)
        topic_info = topic_model.get_topic_info()
        
        # Create THEME nodes
        for idx, row in topic_info.iterrows():
            topic_id = row['Topic']
            
            # Skip outlier topic (-1)
            if topic_id == -1:
                continue
            
            # Get top keywords
            topic_words = topic_model.get_topic(topic_id)
            if not topic_words:
                continue
            
            keywords = [word for word, _ in topic_words[:5]]
            theme_label = ", ".join(keywords[:3])
            
            theme_node = {
                "id": counter,
                "label": f"Theme: {theme_label}",
                "type": "THEME",
                "keywords": keywords,
                "topic_id": int(topic_id)
            }
            theme_nodes.append(theme_node)
            
            # Link entities to themes based on keyword overlap
            for node in nodes:
                entity_label = node["label"].lower()
                
                # Check if entity matches any theme keyword
                if any(keyword.lower() in entity_label or entity_label in keyword.lower() for keyword in keywords):
                    theme_edges.append({
                        "from": node["id"],
                        "to": counter,
                        "label": "relates_to_theme",
                        "source": "topic_modeling"
                    })
            
            counter += 1
        
        print(f"✅ Level 4: Extracted {len(theme_nodes)} themes, {len(theme_edges)} theme connections", file=sys.stderr)
    
    except Exception as e:
        print(f"Warning: Topic modeling failed: {str(e)}", file=sys.stderr)
    
    return theme_nodes, theme_edges, counter

# ============================================================================
# MAIN EXTRACTION PIPELINE
# ============================================================================

def main():
    try:
        # Read input text
        raw_text = sys.stdin.read()
        
        if not raw_text or not raw_text.strip():
            print(json.dumps({"nodes": [], "edges": [], "metadata": {}}))
            sys.exit(0)
        
        # ✅ SANITIZE TEXT: Remove invalid Unicode surrogates and control chars
        clean_text = sanitize_text(raw_text)
        
        if not clean_text or not clean_text.strip():
            print(json.dumps({"nodes": [], "edges": [], "metadata": {"error": "Text sanitization resulted in empty content"}}))
            sys.exit(0)
        
        print(f"✅ Text sanitized: {len(raw_text)} → {len(clean_text)} chars", file=sys.stderr)
        
        # Process with spaCy (use clean_text instead of raw_text)
        doc = nlp(clean_text)
        
        # Extract entities (nodes)
        nodes = []
        node_ids = {}
        counter = 1
        
        for ent in doc.ents:
            nodes.append({
                "id": counter,
                "label": ent.text,
                "type": ent.label_
            })
            node_ids[ent.text] = counter
            counter += 1
        
        print(f"✅ Extracted {len(nodes)} entities", file=sys.stderr)
        
        # Level 1: Dependency relationships
        dep_edges = extract_dependency_relationships(doc, doc.ents, node_ids)
        print(f"✅ Level 1: Found {len(dep_edges)} dependency relationships", file=sys.stderr)
        
        # Level 2: Pattern relationships
        pattern_edges = extract_pattern_relationships(doc, doc.ents, node_ids)
        print(f"✅ Level 2: Found {len(pattern_edges)} pattern relationships", file=sys.stderr)
        
        # Level 3: Semantic relationships (uses cached model)
        semantic_edges = extract_semantic_relationships(doc, nodes, node_ids)
        
        # Level 4: Topic modeling (uses cached model)
        theme_nodes, theme_edges, counter = extract_topics(clean_text, nodes, counter)
        
        # Combine all
        all_nodes = nodes + theme_nodes
        all_edges = dep_edges + pattern_edges + semantic_edges + theme_edges
        
        # Remove duplicates
        unique_edges = {}
        for edge in all_edges:
            key = (edge["from"], edge["to"], edge["label"])
            if key not in unique_edges:
                unique_edges[key] = edge
        
        edges = list(unique_edges.values())
        
        # Build result
        result = {
            "nodes": all_nodes,
            "edges": edges,
            "metadata": {
                "total_entities": len(nodes),
                "total_themes": len(theme_nodes),
                "total_relationships": len(edges),
                "dependency_edges": len(dep_edges),
                "pattern_edges": len(pattern_edges),
                "semantic_edges": len(semantic_edges),
                "theme_edges": len(theme_edges)
            }
        }
        
        print(json.dumps(result))
    
    except Exception as e:
        print(f"PYTHON ERROR: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()