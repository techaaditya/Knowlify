import networkx as nx

def build_knowledge_graph(topics: list) -> nx.DiGraph:
    G = nx.DiGraph()
    
    # 1. Add Entities (Nodes)
    for topic in topics:
        G.add_node(
            topic['name'],
            display_name=topic.get('display_name'),
            description=topic.get('description'),
            difficulty=topic.get('difficulty', 1)
        )
        
    # 2. Add Relationships (Edges)
    for topic in topics:
        for prereq in topic.get('prerequisites', []):
            if prereq in G.nodes: # Prevents orphaned links
                G.add_edge(prereq, topic['name'], type='prerequisite')
                
    return G