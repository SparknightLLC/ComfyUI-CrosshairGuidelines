import {
	get_closest_corner_by_screen,
	get_graph_mouse,
	get_node_at_graph_point,
	get_node_at_screen_point,
	graph_point_to_screen,
	is_screen_point_inside_node,
	screen_point_to_graph
} from "./graph_coordinates.js";
import {
	get_group_activity_state,
	get_group_bounds,
	get_node_activity_state,
	get_node_bounds,
	is_point_inside_bounds
} from "./graph_geometry.js";
import {
	find_node_by_keys,
	get_graph_groups,
	get_graph_nodes
} from "./graph_targets.js";
import { get_selected_nodes } from "./graph_selection.js";

const RESIZE_HITBOX_PX = 14;
const ACTIVITY_THRESHOLD_PX = 0.5;
const RESIZE_EDGE_THRESHOLD_PX = 0.5;
const ACTIVITY_SCAN_INTERVAL_MS = 32;

export function collect_nodes_in_group(canvas, group)
{
	if (!canvas || !group)
	{
		return [];
	}
	const bounds = get_group_bounds(group);
	if (!bounds)
	{
		return [];
	}
	const nodes = get_graph_nodes(canvas);
	const matches = [];
	for (const node of nodes)
	{
		if (!node)
		{
			continue;
		}
		const node_bounds = get_node_bounds(node);
		if (!node_bounds)
		{
			continue;
		}
		const center = [
			(node_bounds.left + node_bounds.right) * 0.5,
			(node_bounds.top + node_bounds.bottom) * 0.5
		];
		if (is_point_inside_bounds(center, bounds))
		{
			matches.push(node);
		}
	}
	return matches;
}

function normalize_corner(value)
{
	if (typeof value === "number")
	{
		if (value === 0)
		{
			return "top_left";
		}
		if (value === 1)
		{
			return "top_right";
		}
		if (value === 2)
		{
			return "bottom_right";
		}
		if (value === 3)
		{
			return "bottom_left";
		}
		return null;
	}
	if (typeof value !== "string")
	{
		return null;
	}
	const normalized = value.toLowerCase().replace(/\s+/g, "_").replace(/-+/g, "_");
	const aliases = {
		"tl": "top_left",
		"top_left": "top_left",
		"topleft": "top_left",
		"tr": "top_right",
		"top_right": "top_right",
		"topright": "top_right",
		"br": "bottom_right",
		"bottom_right": "bottom_right",
		"bottomright": "bottom_right",
		"bl": "bottom_left",
		"bottom_left": "bottom_left",
		"bottomleft": "bottom_left"
	};
	return aliases[normalized] || null;
}

export function get_corner_point(bounds, corner)
{
	if (!bounds || !corner)
	{
		return null;
	}
	if (corner === "top_left")
	{
		return [bounds.left, bounds.top];
	}
	if (corner === "top_right")
	{
		return [bounds.right, bounds.top];
	}
	if (corner === "bottom_left")
	{
		return [bounds.left, bounds.bottom];
	}
	if (corner === "bottom_right")
	{
		return [bounds.right, bounds.bottom];
	}
	return null;
}

function get_closest_corner(bounds, point)
{
	if (!bounds || !point)
	{
		return null;
	}
	const corners = [
		{ key: "top_left", point: [bounds.left, bounds.top] },
		{ key: "top_right", point: [bounds.right, bounds.top] },
		{ key: "bottom_left", point: [bounds.left, bounds.bottom] },
		{ key: "bottom_right", point: [bounds.right, bounds.bottom] }
	];
	let best = null;
	let best_distance = Infinity;
	for (const corner of corners)
	{
		const dx = corner.point[0] - point[0];
		const dy = corner.point[1] - point[1];
		const distance = dx * dx + dy * dy;
		if (distance < best_distance)
		{
			best_distance = distance;
			best = corner.key;
		}
	}
	return best;
}

export function get_active_resize_corner(canvas, bounds)
{
	const raw_corner = canvas?.resizing_corner
		?? canvas?.resizing_group_corner
		?? canvas?.resizing_node_corner;
	const normalized = normalize_corner(raw_corner);
	if (normalized)
	{
		return normalized;
	}
	const mouse = get_graph_mouse(canvas);
	return get_closest_corner(bounds, mouse);
}

export function is_point_near_bottom_right(canvas, bounds)
{
	const mouse = get_graph_mouse(canvas);
	if (!mouse || !bounds)
	{
		return false;
	}
	const scale = canvas && canvas.ds ? canvas.ds.scale : 1;
	const threshold = 10 / (scale || 1);
	const point = [bounds.right, bounds.bottom];
	const dx = mouse[0] - point[0];
	const dy = mouse[1] - point[1];
	return (dx * dx + dy * dy) <= (threshold * threshold);
}

function get_hovered_node(canvas)
{
	return find_node_by_keys(canvas, [
		"node_over",
		"nodeOver",
		"node_over_by_pos",
		"nodeOverByPos",
		"node_hovered",
		"nodeHovered",
		"hovered_node",
		"hoveredNode"
	]);
}

function get_activity_threshold(canvas, screen_px)
{
	const scale = canvas?.ds?.scale;
	const safe_scale = Number.isFinite(scale) && scale > 0 ? scale : 1;
	return screen_px / safe_scale;
}

function get_resize_corner_from_bounds(previous_bounds, next_bounds, threshold)
{
	if (!previous_bounds || !next_bounds)
	{
		return null;
	}
	const edge_threshold = Number.isFinite(threshold) ? threshold : 0;
	const moved_left = Math.abs(next_bounds.left - previous_bounds.left) > edge_threshold;
	const moved_right = Math.abs(next_bounds.right - previous_bounds.right) > edge_threshold;
	const moved_top = Math.abs(next_bounds.top - previous_bounds.top) > edge_threshold;
	const moved_bottom = Math.abs(next_bounds.bottom - previous_bounds.bottom) > edge_threshold;
	if (moved_left && moved_top)
	{
		return "top_left";
	}
	if (moved_right && moved_top)
	{
		return "top_right";
	}
	if (moved_left && moved_bottom)
	{
		return "bottom_left";
	}
	if (moved_right && moved_bottom)
	{
		return "bottom_right";
	}
	if (moved_right && !moved_top && !moved_bottom)
	{
		return "bottom_right";
	}
	if (moved_left && !moved_top && !moved_bottom)
	{
		return "bottom_left";
	}
	if (moved_right)
	{
		return moved_bottom ? "bottom_right" : "top_right";
	}
	if (moved_left)
	{
		return moved_bottom ? "bottom_left" : "top_left";
	}
	if (moved_bottom)
	{
		return "bottom_right";
	}
	if (moved_top)
	{
		return "top_left";
	}
	return null;
}

export function detect_graph_activity(canvas)
{
	if (!canvas)
	{
		return null;
	}
	const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
	const last_scan = canvas.__crosshair_activity_last_time;
	if (Number.isFinite(last_scan) && (now - last_scan) < ACTIVITY_SCAN_INTERVAL_MS)
	{
		return canvas.__crosshair_activity_last_result || null;
	}
	canvas.__crosshair_activity_last_time = now;
	const nodes = get_graph_nodes(canvas);
	const groups = get_graph_groups(canvas);
	const previous_node_states = canvas.__crosshair_last_node_states instanceof Map
		? canvas.__crosshair_last_node_states
		: new Map();
	const previous_group_states = canvas.__crosshair_last_group_states instanceof Map
		? canvas.__crosshair_last_group_states
		: new Map();
	const next_node_states = new Map();
	const next_group_states = new Map();
	const move_threshold = get_activity_threshold(canvas, ACTIVITY_THRESHOLD_PX);
	const resize_threshold = get_activity_threshold(canvas, RESIZE_EDGE_THRESHOLD_PX);

	let move_node = null;
	let move_node_score = 0;
	let resize_node = null;
	let resize_node_score = 0;
	let resize_node_previous = null;
	let resize_node_next = null;
	let moved_nodes_count = 0;

	for (const node of nodes)
	{
		if (!node)
		{
			continue;
		}
		const state = get_node_activity_state(node);
		if (!state)
		{
			continue;
		}
		next_node_states.set(node, state);
		const previous = previous_node_states.get(node);
		if (!previous)
		{
			continue;
		}
		const dx = Math.abs(state.left - previous.left);
		const dy = Math.abs(state.top - previous.top);
		const dw = Math.abs(state.width - previous.width);
		const dh = Math.abs(state.height - previous.height);
		const moved = dx > move_threshold || dy > move_threshold;
		const resized = dw > resize_threshold || dh > resize_threshold;
		if (resized)
		{
			const score = dx + dy + dw + dh;
			if (score > resize_node_score)
			{
				resize_node_score = score;
				resize_node = node;
				resize_node_previous = previous;
				resize_node_next = state;
			}
		}
		else if (moved)
		{
			moved_nodes_count += 1;
			const score = dx + dy;
			if (score > move_node_score)
			{
				move_node_score = score;
				move_node = node;
			}
		}
	}

	let move_group = null;
	let move_group_score = 0;
	let resize_group = null;
	let resize_group_score = 0;

	for (const group of groups)
	{
		if (!group)
		{
			continue;
		}
		const state = get_group_activity_state(group);
		if (!state)
		{
			continue;
		}
		next_group_states.set(group, state);
		const previous = previous_group_states.get(group);
		if (!previous)
		{
			continue;
		}
		const dx = Math.abs(state.left - previous.left);
		const dy = Math.abs(state.top - previous.top);
		const dw = Math.abs(state.width - previous.width);
		const dh = Math.abs(state.height - previous.height);
		const moved = dx > move_threshold || dy > move_threshold;
		const resized = dw > resize_threshold || dh > resize_threshold;
		if (resized)
		{
			const score = dx + dy + dw + dh;
			if (score > resize_group_score)
			{
				resize_group_score = score;
				resize_group = group;
			}
		}
		else if (moved)
		{
			const score = dx + dy;
			if (score > move_group_score)
			{
				move_group_score = score;
				move_group = group;
			}
		}
	}

	canvas.__crosshair_last_node_states = next_node_states;
	canvas.__crosshair_last_group_states = next_group_states;

	const resize_corner = resize_node && resize_node_previous && resize_node_next
		? get_resize_corner_from_bounds(resize_node_previous, resize_node_next, resize_threshold)
		: null;
	const has_activity = !!move_node || !!resize_node || !!move_group || !!resize_group;
	const result = {
		has_activity,
		move_node,
		resize_node,
		resize_corner,
		move_group,
		resize_group,
		moved_nodes_count
	};
	canvas.__crosshair_activity_last_result = result;
	return result;
}

export function get_drag_node_target(canvas, screen_point, graph_point)
{
	if (!canvas)
	{
		return null;
	}
	const direct_hit = get_node_at_screen_point(canvas, screen_point)
		|| get_node_at_graph_point(canvas, graph_point);
	if (direct_hit)
	{
		return direct_hit;
	}
	const hovered = get_hovered_node(canvas);
	if (!hovered)
	{
		return null;
	}
	if (screen_point && is_screen_point_inside_node(canvas, hovered, screen_point))
	{
		return hovered;
	}
	if (graph_point && is_point_inside_bounds(graph_point, get_node_bounds(hovered)))
	{
		return hovered;
	}
	return null;
}

export function collect_resize_candidates(canvas)
{
	const selected_nodes = get_selected_nodes(canvas).filter((node) => !!node);
	const hovered_node = get_hovered_node(canvas);
	const resize_candidates = [];
	const add_resize_candidate = (node) =>
	{
		if (!node || resize_candidates.includes(node))
		{
			return;
		}
		resize_candidates.push(node);
	};
	for (const node of selected_nodes)
	{
		add_resize_candidate(node);
	}
	add_resize_candidate(hovered_node);
	for (const node of get_graph_nodes(canvas))
	{
		add_resize_candidate(node);
	}
	return resize_candidates;
}

function get_resize_candidate_node(canvas, nodes, graph_point, screen_point)
{
	if (!canvas || !Array.isArray(nodes) || nodes.length === 0)
	{
		return null;
	}
	let best_node_screen = null;
	let best_distance_screen = Infinity;
	if (screen_point)
	{
		const screen_threshold = RESIZE_HITBOX_PX;
		const screen_threshold_sq = screen_threshold * screen_threshold;
		for (const node of nodes)
		{
			if (!node)
			{
				continue;
			}
			const node_bounds = get_node_bounds(node);
			const top_left = graph_point_to_screen(canvas, [node_bounds.left, node_bounds.top]);
			const bottom_right = graph_point_to_screen(canvas, [node_bounds.right, node_bounds.bottom]);
			if (!top_left || !bottom_right)
			{
				continue;
			}
			const min_x = Math.min(top_left[0], bottom_right[0]) - screen_threshold;
			const max_x = Math.max(top_left[0], bottom_right[0]) + screen_threshold;
			const min_y = Math.min(top_left[1], bottom_right[1]) - screen_threshold;
			const max_y = Math.max(top_left[1], bottom_right[1]) + screen_threshold;
			if (screen_point[0] < min_x || screen_point[0] > max_x
				|| screen_point[1] < min_y || screen_point[1] > max_y)
			{
				continue;
			}
			const corners = [
				[node_bounds.left, node_bounds.top],
				[node_bounds.right, node_bounds.top],
				[node_bounds.left, node_bounds.bottom],
				[node_bounds.right, node_bounds.bottom]
			];
			for (const corner of corners)
			{
				const screen_corner = graph_point_to_screen(canvas, corner);
				if (!screen_corner)
				{
					continue;
				}
				const dx = screen_point[0] - screen_corner[0];
				const dy = screen_point[1] - screen_corner[1];
				const distance = (dx * dx) + (dy * dy);
				if (distance <= screen_threshold_sq && distance < best_distance_screen)
				{
					best_distance_screen = distance;
					best_node_screen = node;
				}
			}
		}
	}

	if (best_node_screen)
	{
		return best_node_screen;
	}

	const target_graph_point = graph_point || (screen_point ? null : get_graph_mouse(canvas));
	if (!target_graph_point)
	{
		return null;
	}
	const scale = canvas && canvas.ds ? canvas.ds.scale : 1;
	const graph_threshold = RESIZE_HITBOX_PX / (scale || 1);
	const graph_threshold_sq = graph_threshold * graph_threshold;
	let best_node_graph = null;
	let best_distance_graph = Infinity;
	for (const node of nodes)
	{
		if (!node)
		{
			continue;
		}
		const bounds = get_node_bounds(node);
		if (target_graph_point[0] < bounds.left - graph_threshold
			|| target_graph_point[0] > bounds.right + graph_threshold
			|| target_graph_point[1] < bounds.top - graph_threshold
			|| target_graph_point[1] > bounds.bottom + graph_threshold)
		{
			continue;
		}
		const corner = get_closest_corner(bounds, target_graph_point);
		const corner_point = get_corner_point(bounds, corner);
		if (!corner_point)
		{
			continue;
		}
		const dx = target_graph_point[0] - corner_point[0];
		const dy = target_graph_point[1] - corner_point[1];
		const distance = (dx * dx) + (dy * dy);
		if (distance <= graph_threshold_sq && distance < best_distance_graph)
		{
			best_distance_graph = distance;
			best_node_graph = node;
		}
	}
	return best_node_graph;
}

export function latch_node_resize_candidate(canvas, nodes, graph_point, screen_point)
{
	if (!canvas)
	{
		return;
	}
	const candidate = get_resize_candidate_node(canvas, nodes, graph_point, screen_point);
	if (!candidate)
	{
		canvas.__crosshair_node_resize_latched = false;
		canvas.__crosshair_node_resize_target = null;
		canvas.__crosshair_node_resize_corner = null;
		return;
	}
	canvas.__crosshair_node_resize_latched = true;
	canvas.__crosshair_node_resize_target = candidate;
	const bounds = get_node_bounds(candidate);
	let corner = null;
	if (screen_point)
	{
		corner = get_closest_corner_by_screen(canvas, bounds, screen_point);
	}
	if (!corner)
	{
		const graph_point_candidate = graph_point || screen_point_to_graph(canvas, screen_point);
		corner = graph_point_candidate ? get_closest_corner(bounds, graph_point_candidate) : null;
	}
	canvas.__crosshair_node_resize_corner = corner;
}
