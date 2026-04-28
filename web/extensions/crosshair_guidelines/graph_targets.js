import {
	is_group_like,
	is_node_like
} from "./graph_geometry.js";

export const DRAG_GROUP_KEYS = ["dragging_group", "draggingGroup", "drag_group", "dragGroup", "group_dragged", "groupDragged"];
export const RESIZE_GROUP_KEYS = ["resizing_group", "resizingGroup"];
export const RESIZE_GROUP_FLAG_KEYS = ["selected_group_resizing", "selectedGroupResizing", "resizing_group_corner", "resizingGroupCorner"];

export function get_node_identifier(node)
{
	if (!node)
	{
		return null;
	}
	if (node.id !== undefined && node.id !== null)
	{
		return String(node.id);
	}
	if (node.uid !== undefined && node.uid !== null)
	{
		return String(node.uid);
	}
	if (node.uuid !== undefined && node.uuid !== null)
	{
		return String(node.uuid);
	}
	if (node.node_id !== undefined && node.node_id !== null)
	{
		return String(node.node_id);
	}
	return null;
}

export function get_group_identifier(group)
{
	if (!group)
	{
		return null;
	}
	if (group.id !== undefined && group.id !== null)
	{
		return String(group.id);
	}
	if (group.uid !== undefined && group.uid !== null)
	{
		return String(group.uid);
	}
	if (group.uuid !== undefined && group.uuid !== null)
	{
		return String(group.uuid);
	}
	if (group.group_id !== undefined && group.group_id !== null)
	{
		return String(group.group_id);
	}
	return null;
}

export function get_graph_nodes(canvas)
{
	const graph = canvas?.graph;
	if (!graph)
	{
		return [];
	}
	if (Array.isArray(graph._nodes))
	{
		return graph._nodes;
	}
	if (Array.isArray(graph.nodes))
	{
		return graph.nodes;
	}
	const nodes_by_id = graph._nodes_by_id;
	if (nodes_by_id instanceof Map)
	{
		return Array.from(nodes_by_id.values());
	}
	if (nodes_by_id && typeof nodes_by_id === "object")
	{
		return Object.values(nodes_by_id);
	}
	return [];
}

export function get_graph_groups(canvas)
{
	const graph = canvas?.graph;
	if (!graph)
	{
		return [];
	}
	if (Array.isArray(graph._groups))
	{
		return graph._groups;
	}
	if (Array.isArray(graph.groups))
	{
		return graph.groups;
	}
	return [];
}

export function resolve_node_candidate(canvas, candidate)
{
	if (is_node_like(candidate))
	{
		return candidate;
	}
	if (candidate === null || candidate === undefined)
	{
		return null;
	}
	let candidate_id = null;
	if (typeof candidate === "object")
	{
		candidate_id = get_node_identifier(candidate);
	}
	if (!candidate_id && typeof candidate !== "number" && typeof candidate !== "string")
	{
		return null;
	}
	if (!candidate_id)
	{
		candidate_id = String(candidate);
	}
	if (!candidate_id)
	{
		return null;
	}
	const nodes = get_graph_nodes(canvas);
	for (const node of nodes)
	{
		if (!node)
		{
			continue;
		}
		const node_id = get_node_identifier(node);
		if (node_id && node_id === candidate_id)
		{
			return node;
		}
	}
	return null;
}

export function resolve_group_candidate(canvas, candidate)
{
	if (is_group_like(candidate))
	{
		return candidate;
	}
	if (candidate === null || candidate === undefined)
	{
		return null;
	}
	let candidate_id = null;
	if (typeof candidate === "object")
	{
		candidate_id = get_group_identifier(candidate);
	}
	if (!candidate_id && typeof candidate !== "number" && typeof candidate !== "string")
	{
		return null;
	}
	if (!candidate_id)
	{
		candidate_id = String(candidate);
	}
	if (!candidate_id)
	{
		return null;
	}
	const groups = get_graph_groups(canvas);
	for (const group of groups)
	{
		if (!group)
		{
			continue;
		}
		const group_id = get_group_identifier(group);
		if (group_id && group_id === candidate_id)
		{
			return group;
		}
	}
	return null;
}

export function find_node_by_keys(canvas, keys)
{
	if (!canvas || !Array.isArray(keys))
	{
		return null;
	}
	const sources = [
		canvas,
		canvas?.graph,
		canvas?._graph,
		canvas?.graph?._graph
	].filter((source) => !!source);
	for (const key of keys)
	{
		if (!key)
		{
			continue;
		}
		for (const source of sources)
		{
			const candidate = source[key];
			const resolved = resolve_node_candidate(canvas, candidate);
			if (resolved)
			{
				return resolved;
			}
		}
	}
	return null;
}

export function find_group_by_keys(canvas, keys)
{
	if (!canvas || !Array.isArray(keys))
	{
		return null;
	}
	const sources = [
		canvas,
		canvas?.graph,
		canvas?._graph,
		canvas?.graph?._graph
	].filter((source) => !!source);
	for (const key of keys)
	{
		if (!key)
		{
			continue;
		}
		for (const source of sources)
		{
			const candidate = source[key];
			const resolved = resolve_group_candidate(canvas, candidate);
			if (resolved)
			{
				return resolved;
			}
		}
	}
	return null;
}

export function get_canvas_drag_node(canvas)
{
	if (!canvas)
	{
		return null;
	}
	const candidates = [
		canvas.node_dragged,
		canvas.dragging_node,
		canvas.draggingNode,
		canvas.node_dragging,
		canvas.nodeDragging,
		canvas.drag_node,
		canvas.dragNode,
		canvas.dragged_node,
		canvas.draggedNode
	];
	for (const candidate of candidates)
	{
		const resolved = resolve_node_candidate(canvas, candidate);
		if (resolved)
		{
			return resolved;
		}
	}
	return null;
}

export function get_canvas_resize_node(canvas)
{
	if (!canvas)
	{
		return null;
	}
	const candidates = [
		canvas.resizing_node,
		canvas.node_resizing,
		canvas.resizingNode,
		canvas.nodeResizing,
		canvas.resize_node,
		canvas.resizeNode,
		canvas.resizing_node_data,
		canvas.resizingNodeData
	];
	for (const candidate of candidates)
	{
		const resolved = resolve_node_candidate(canvas, candidate);
		if (resolved)
		{
			return resolved;
		}
	}
	return null;
}

export function get_active_node_from_canvas(canvas)
{
	if (!canvas)
	{
		return null;
	}
	const drag_node = get_canvas_drag_node(canvas);
	if (drag_node)
	{
		return drag_node;
	}
	const resize_node = get_canvas_resize_node(canvas);
	if (resize_node)
	{
		return resize_node;
	}
	const active_target = canvas.__crosshair_active_target;
	if (active_target?.resize_node_candidate)
	{
		return active_target.resize_node_candidate;
	}
	if (active_target?.drag_node_target)
	{
		return active_target.drag_node_target;
	}
	if (canvas.__crosshair_node_resize_target)
	{
		return canvas.__crosshair_node_resize_target;
	}
	if (canvas.__crosshair_drag_node_target)
	{
		return canvas.__crosshair_drag_node_target;
	}
	return canvas.__crosshair_last_active_node || null;
}

export function get_canvas_drag_group(canvas)
{
	return find_group_by_keys(canvas, DRAG_GROUP_KEYS);
}

export function get_canvas_resize_group(canvas)
{
	return find_group_by_keys(canvas, RESIZE_GROUP_KEYS);
}

export function get_active_group_from_canvas(canvas)
{
	if (!canvas)
	{
		return null;
	}
	const drag_group = get_canvas_drag_group(canvas);
	if (drag_group)
	{
		return drag_group;
	}
	const resize_group = get_canvas_resize_group(canvas);
	if (resize_group)
	{
		return resize_group;
	}
	const active_target = canvas.__crosshair_active_target;
	if (active_target?.active_resize_group)
	{
		return active_target.active_resize_group;
	}
	if (active_target?.drag_group)
	{
		return active_target.drag_group;
	}
	if (canvas.__crosshair_group_resize_target)
	{
		return canvas.__crosshair_group_resize_target;
	}
	if (canvas.__crosshair_drag_group_target)
	{
		return canvas.__crosshair_drag_group_target;
	}
	return canvas.__crosshair_last_active_group || null;
}

export function has_group_resize_flags(canvas)
{
	if (!canvas)
	{
		return false;
	}
	for (const key of RESIZE_GROUP_FLAG_KEYS)
	{
		if (canvas[key])
		{
			return true;
		}
	}
	return false;
}
