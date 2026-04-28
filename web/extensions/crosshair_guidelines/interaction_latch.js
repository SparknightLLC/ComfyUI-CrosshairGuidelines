import {
	get_graph_mouse,
	get_node_at_graph_point,
	get_node_at_screen_point,
	is_screen_point_inside_group,
	is_screen_point_inside_node
} from "./graph_coordinates.js";
import {
	get_canvas_drag_group,
	get_canvas_resize_group
} from "./graph_targets.js";
import { is_selected_node_match } from "./graph_selection.js";

export function update_selected_interaction_latch(canvas, selected_nodes, selected_group, screen_point)
{
	if (!canvas)
	{
		return false;
	}
	const selected_list = Array.isArray(selected_nodes)
		? selected_nodes.filter((node) => !!node)
		: [];
	const selected_nodes_set = selected_list.length > 0 ? new Set(selected_list) : null;
	let started_on_selected_node = !!canvas.__crosshair_drag_start_on_selected;

	if (!started_on_selected_node && selected_nodes_set && screen_point)
	{
		for (const node of selected_list)
		{
			if (is_screen_point_inside_node(canvas, node, screen_point))
			{
				started_on_selected_node = true;
				break;
			}
		}
	}

	const pointer_node = canvas.__crosshair_latched_pointer_node
		|| canvas.__crosshair_pointer_node
		|| canvas.__crosshair_drag_node_target
		|| canvas.__crosshair_node_resize_target
		|| null;
	if (!started_on_selected_node && is_selected_node_match(pointer_node, selected_nodes_set))
	{
		started_on_selected_node = true;
	}
	if (!started_on_selected_node && is_selected_node_match(canvas.__crosshair_drag_node_target, selected_nodes_set))
	{
		started_on_selected_node = true;
	}
	if (!started_on_selected_node && is_selected_node_match(canvas.__crosshair_node_resize_target, selected_nodes_set))
	{
		started_on_selected_node = true;
	}

	canvas.__crosshair_drag_start_on_selected = started_on_selected_node;

	const selected_group_target = !!selected_group
		&& (canvas.__crosshair_drag_group_target === selected_group
			|| canvas.__crosshair_group_resize_target === selected_group);
	const has_latched_selected_interaction = started_on_selected_node
		|| selected_group_target
		|| !!canvas.__crosshair_group_resize_latched
		|| !!canvas.__crosshair_node_resize_latched;
	if (has_latched_selected_interaction)
	{
		canvas.__crosshair_selected_interaction_latched = true;
	}
	return !!canvas.__crosshair_selected_interaction_latched;
}

export function capture_selected_start_candidate(canvas, selected_nodes, selected_group, screen_point, graph_point)
{
	if (!canvas)
	{
		return false;
	}
	const selected_list = Array.isArray(selected_nodes)
		? selected_nodes.filter((node) => !!node)
		: [];
	const selected_nodes_set = selected_list.length > 0 ? new Set(selected_list) : null;
	const node_candidates = [
		canvas.__crosshair_pointer_node,
		canvas.__crosshair_latched_pointer_node,
		canvas.__crosshair_drag_node_target,
		canvas.__crosshair_node_resize_target,
		get_node_at_screen_point(canvas, screen_point),
		get_node_at_graph_point(canvas, graph_point || get_graph_mouse(canvas))
	];
	let started_on_selected_node = false;
	for (const node_candidate of node_candidates)
	{
		if (is_selected_node_match(node_candidate, selected_nodes_set))
		{
			started_on_selected_node = true;
			break;
		}
	}
	let started_on_selected_group = false;
	if (selected_group)
	{
		if (canvas.__crosshair_drag_group_target === selected_group
			|| canvas.__crosshair_group_resize_target === selected_group
			|| get_canvas_drag_group(canvas) === selected_group
			|| get_canvas_resize_group(canvas) === selected_group)
		{
			started_on_selected_group = true;
		}
		else if (screen_point)
		{
			started_on_selected_group = is_screen_point_inside_group(canvas, selected_group, screen_point);
		}
	}
	const selected_start_candidate = started_on_selected_node || started_on_selected_group;
	canvas.__crosshair_selected_start_candidate = selected_start_candidate;
	canvas.__crosshair_selected_start_candidate_captured = true;
	if (selected_start_candidate)
	{
		canvas.__crosshair_drag_start_on_selected = canvas.__crosshair_drag_start_on_selected || started_on_selected_node;
		canvas.__crosshair_selected_interaction_latched = true;
	}
	return selected_start_candidate;
}
