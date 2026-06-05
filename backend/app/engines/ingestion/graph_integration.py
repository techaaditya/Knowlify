import networkx as nx
from typing import Any


def topics_to_graph(topics: list[dict]) -> nx.DiGraph:
    from ..context.graph_builder import build_knowledge_graph
    return build_knowledge_graph(topics)


def graph_to_storage(topics: list[dict], G: nx.DiGraph) -> dict[str, Any]:
    nodes = []
    for node in G.nodes(data=True):
        nodes.append({
            "id": node[0],
            "display_name": node[1].get("display_name", node[0]),
            "description": node[1].get("description", ""),
            "difficulty": node[1].get("difficulty", 1),
            "prerequisites": list(G.predecessors(node[0])),
        })

    edges = []
    for edge in G.edges(data=True):
        edges.append({"from": edge[0], "to": edge[1], "type": edge[2].get("type", "prerequisite")})

    entities = [n["display_name"] for n in nodes]
    return {
        "nodes": nodes,
        "edges": edges,
        "entity_count": len(nodes),
        "relationship_count": len(edges),
        "entities": entities,
    }


def merge_workspace_graph(existing: dict | None, new_graph: dict) -> dict:
    if not existing:
        return new_graph

    node_map = {n["id"]: n for n in existing.get("nodes", [])}
    for node in new_graph.get("nodes", []):
        if node["id"] not in node_map:
            node_map[node["id"]] = node

    edge_set = {(e["from"], e["to"]) for e in existing.get("edges", [])}
    edges = list(existing.get("edges", []))
    for edge in new_graph.get("edges", []):
        key = (edge["from"], edge["to"])
        if key not in edge_set:
            edge_set.add(key)
            edges.append(edge)

    nodes = list(node_map.values())
    return {
        "nodes": nodes,
        "edges": edges,
        "entity_count": len(nodes),
        "relationship_count": len(edges),
    }
