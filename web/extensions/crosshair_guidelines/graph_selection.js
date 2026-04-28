import {
	is_group_selected,
	is_node_like,
	is_node_selected
} from "./graph_geometry.js";
import {
	get_graph_groups,
	get_graph_nodes,
	get_node_identifier
} from "./graph_targets.js";

export function get_selected_nodes(canvas)
{
	let nodes_by_id = null;
	const resolve_node_id = (value) =>
	{
		if (value === null || value === undefined)
		{
			return null;
		}
		if (!nodes_by_id)
		{
			nodes_by_id = new Map();
			for (const node of get_graph_nodes(canvas))
			{
				const id = get_node_identifier(node);
				if (id)
				{
					nodes_by_id.set(id, node);
				}
			}
		}
		const key = (typeof value === "string" || typeof value === "number")
			? String(value)
			: get_node_identifier(value);
		if (!key)
		{
			return null;
		}
		return nodes_by_id.get(key) || null;
	};
	const resolve_nodes_from_values = (values) =>
	{
		if (!values)
		{
			return [];
		}
		const resolved = [];
		for (const value of values)
		{
			if (is_node_like(value))
			{
				resolved.push(value);
				continue;
			}
			const node = resolve_node_id(value);
			if (node)
			{
				resolved.push(node);
			}
		}
		return resolved;
	};

	const candidates = [
		canvas?.selected_nodes,
		canvas?.selectedNodes,
		canvas?.selected_nodes_list,
		canvas?.selectedNodesList
	];
	for (const selected of candidates)
	{
		if (!selected)
		{
			continue;
		}
		if (Array.isArray(selected))
		{
			const resolved = resolve_nodes_from_values(selected);
			if (resolved.length > 0)
			{
				return resolved;
			}
			continue;
		}
		if (selected instanceof Map || selected instanceof Set)
		{
			const resolved = resolve_nodes_from_values(Array.from(selected.values()));
			if (resolved.length > 0)
			{
				return resolved;
			}
			continue;
		}
		if (typeof selected === "object")
		{
			const resolved = resolve_nodes_from_values(Object.values(selected));
			if (resolved.length > 0)
			{
				return resolved;
			}
			const resolved_keys = resolve_nodes_from_values(Object.keys(selected));
			if (resolved_keys.length > 0)
			{
				return resolved_keys;
			}
		}
	}
	const graph_nodes = get_graph_nodes(canvas);
	if (graph_nodes.length > 0)
	{
		const selected_nodes = graph_nodes.filter((node) => is_node_selected(node));
		if (selected_nodes.length > 0)
		{
			return selected_nodes;
		}
	}
	return [];
}

export function get_selected_group(canvas)
{
	const direct = canvas?.selected_group || canvas?.selectedGroup || null;
	if (direct)
	{
		return direct;
	}
	const groups = get_graph_groups(canvas);
	for (const group of groups)
	{
		if (is_group_selected(group))
		{
			return group;
		}
	}
	return null;
}

export function has_selected_interaction_latch(canvas)
{
	if (!canvas)
	{
		return false;
	}
	return !!canvas.__crosshair_selected_interaction_latched
		|| !!canvas.__crosshair_drag_start_on_selected
		|| !!canvas.__crosshair_drag_group_target
		|| !!canvas.__crosshair_group_resize_latched
		|| !!canvas.__crosshair_node_resize_latched;
}

export function is_selected_node_match(node, selected_nodes_set)
{
	if (!node)
	{
		return false;
	}
	if (selected_nodes_set?.has(node))
	{
		return true;
	}
	return is_node_selected(node);
}
