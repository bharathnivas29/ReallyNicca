#!/usr/bin/env python3
"""
Really Nicca - Gap Discovery Engine
Detects structural holes using betweenness centrality + community detection
"""

import sys
import json
import networkx as nx

# Try importing community detection library
try:
    from community import community_louvain
    COMMUNITY_AVAILABLE = True
except ImportError:
    print("Warning: python-louvain not installed. Run: pip install python-louvain", file=sys.stderr)
    COMMUNITY_AVAILABLE = False

# Try importing sentence transformers for semantic distance
try:
    from sentence_transformers import SentenceTransformer
    from sklearn.metrics.pairwise import cosine_similarity
    SEMANTIC_AVAILABLE = True
except ImportError:
    SEMANTIC_AVAILABLE = False

def build_networkx_graph(nodes, edges):
    """Convert graph data to NetworkX format."""
    G = nx.Graph()
    
    for node in nodes:
        G.add_node(node['id'], label=node['label'], type=node.get('type', 'UNKNOWN'))
    
    for edge in edges:
        G.add_edge(edge['from'], edge['to'], label=edge.get('label', 'related'))
    
    return G

def calculate_betweenness_centrality(G):
    """Calculate betweenness centrality for all nodes."""
    return nx.betweenness_centrality(G)

def detect_communities(G):
    """Detect community clusters using Louvain algorithm."""
    if not COMMUNITY_AVAILABLE:
        # Fallback: use connected components
        return {node: idx for idx, component in enumerate(nx.connected_components(G)) for node in component}
    
    return community_louvain.best_partition(G)

def count_edges_between(G, nodes_c1, nodes_c2):
    """Count edges connecting two communities."""
    count = 0
    for n1 in nodes_c1:
        for n2 in nodes_c2:
            if G.has_edge(n1, n2):
                count += 1
    return count

def get_cluster_keywords(G, community_nodes, top_n=5):
    """Get representative labels from a community."""
    labels = [G.nodes[node]['label'] for node in community_nodes if node in G.nodes]
    return labels[:top_n]

def calculate_semantic_distance(cluster_1_keywords, cluster_2_keywords):
    """Calculate semantic distance between two clusters using embeddings."""
    if not SEMANTIC_AVAILABLE or not cluster_1_keywords or not cluster_2_keywords:
        return 0.5  # Default medium distance
    
    try:
        model = SentenceTransformer('all-mpnet-base-v2')
        
        text_c1 = " ".join(cluster_1_keywords)
        text_c2 = " ".join(cluster_2_keywords)
        
        emb_c1 = model.encode([text_c1])
        emb_c2 = model.encode([text_c2])
        
        similarity = cosine_similarity(emb_c1, emb_c2)[0][0]
        distance = 1 - similarity
        
        return float(distance)
    except Exception as e:
        print(f"Warning: Semantic distance calculation failed: {str(e)}", file=sys.stderr)
        return 0.5

def find_bridge_nodes(betweenness, nodes_c1, nodes_c2, top_n=3):
    """Find nodes with highest betweenness centrality connecting two communities."""
    all_nodes = set(nodes_c1 + nodes_c2)
    bridge_candidates = [(node, bc) for node, bc in betweenness.items() if node in all_nodes]
    bridge_candidates.sort(key=lambda x: x[1], reverse=True)
    return [node for node, _ in bridge_candidates[:top_n]]

def find_structural_gaps(G, communities, betweenness, min_cluster_size=3, max_gaps=10):
    """Identify structural gaps between communities."""
    gaps = []
    community_ids = set(communities.values())
    
    for c1 in community_ids:
        for c2 in community_ids:
            if c1 >= c2:
                continue
            
            # Get nodes in each community
            nodes_c1 = [n for n, c in communities.items() if c == c1]
            nodes_c2 = [n for n, c in communities.items() if c == c2]
            
            # Filter small clusters
            if len(nodes_c1) < min_cluster_size or len(nodes_c2) < min_cluster_size:
                continue
            
            # Count inter-community edges
            inter_edges = count_edges_between(G, nodes_c1, nodes_c2)
            
            # Calculate connectivity
            max_possible_edges = len(nodes_c1) * len(nodes_c2)
            connectivity = inter_edges / max_possible_edges if max_possible_edges > 0 else 0
            
            # Get cluster keywords
            cluster_1_keywords = get_cluster_keywords(G, nodes_c1)
            cluster_2_keywords = get_cluster_keywords(G, nodes_c2)
            
            # Calculate semantic distance
            semantic_distance = calculate_semantic_distance(cluster_1_keywords, cluster_2_keywords)
            
            # Gap score: prioritize large clusters with low connectivity
            cluster_size_score = len(nodes_c1) * len(nodes_c2)
            connectivity_penalty = (1 - connectivity)
            semantic_bonus = semantic_distance
            
            gap_score = cluster_size_score * connectivity_penalty * (1 + semantic_bonus)
            
            # Only include significant gaps (low connectivity)
            if connectivity < 0.2:  # Less than 20% connectivity
                gaps.append({
                    "community_1": int(c1),
                    "community_2": int(c2),
                    "nodes_1": nodes_c1,
                    "nodes_2": nodes_c2,
                    "cluster_1_keywords": cluster_1_keywords,
                    "cluster_2_keywords": cluster_2_keywords,
                    "gap_score": float(gap_score),
                    "connectivity": float(connectivity),
                    "semantic_distance": float(semantic_distance),
                    "potential_connections": inter_edges,
                    "cluster_size": len(nodes_c1) + len(nodes_c2),
                    "bridge_nodes": find_bridge_nodes(betweenness, nodes_c1, nodes_c2)
                })
    
    # Sort by gap score (descending)
    gaps.sort(key=lambda x: x['gap_score'], reverse=True)
    return gaps[:max_gaps]

def generate_gap_insights(gap, G):
    """Generate human-readable insights for a gap."""
    c1_keywords = gap['cluster_1_keywords']
    c2_keywords = gap['cluster_2_keywords']
    
    # Determine significance
    if gap['gap_score'] > 100:
        significance = "High"
    elif gap['gap_score'] > 50:
        significance = "Medium"
    else:
        significance = "Low"
    
    insight = {
        "title": f"Gap between '{c1_keywords[0]}' and '{c2_keywords[0]}' clusters",
        "description": f"Found {len(gap['nodes_1'])} concepts related to {c1_keywords[0]} and {len(gap['nodes_2'])} concepts related to {c2_keywords[0]}, but only {int(gap['connectivity']*100)}% connectivity.",
        "significance": significance,
        "cluster_1_keywords": c1_keywords,
        "cluster_2_keywords": c2_keywords,
        "bridge_suggestion": f"Explore: How does {c1_keywords[0]} relate to {c2_keywords[0]}?",
        "gap_score": gap['gap_score'],
        "semantic_distance": gap['semantic_distance'],
        "potential_connections": gap['potential_connections'],
        "bridge_nodes": [G.nodes[n]['label'] for n in gap['bridge_nodes'] if n in G.nodes]
    }
    
    return insight

def main():
    try:
        # Read graph data from stdin
        graph_data = json.loads(sys.stdin.read())
        
        nodes = graph_data.get('nodes', [])
        edges = graph_data.get('edges', [])
        
        if len(nodes) < 5 or len(edges) < 2:
            print(json.dumps({
                "gaps": [], 
                "message": "Graph too small for gap analysis (need 5+ nodes, 2+ edges)",
                "num_communities": 0,
                "num_gaps_detected": 0
            }))
            sys.exit(0)
        
        # Build NetworkX graph
        G = build_networkx_graph(nodes, edges)
        
        # Calculate betweenness centrality
        betweenness = calculate_betweenness_centrality(G)
        print(f"✅ Calculated betweenness centrality for {len(betweenness)} nodes", file=sys.stderr)
        
        # Detect communities
        communities = detect_communities(G)
        num_communities = len(set(communities.values()))
        print(f"✅ Detected {num_communities} communities", file=sys.stderr)
        
        # Find structural gaps
        gaps = find_structural_gaps(G, communities, betweenness)
        print(f"✅ Found {len(gaps)} structural gaps", file=sys.stderr)
        
        # Generate insights
        gap_insights = [generate_gap_insights(gap, G) for gap in gaps]
        
        result = {
            "gaps": gap_insights,
            "num_communities": num_communities,
            "num_gaps_detected": len(gaps),
            "analysis_metadata": {
                "total_nodes": len(nodes),
                "total_edges": len(edges),
                "num_communities": num_communities,
                "average_gap_score": sum(g['gap_score'] for g in gaps) / len(gaps) if gaps else 0
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
