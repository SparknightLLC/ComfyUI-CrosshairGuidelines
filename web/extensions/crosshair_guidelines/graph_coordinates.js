import {
	get_group_bounds,
	get_node_bounds,
	is_point_inside_bounds
} from "./graph_geometry.js";
import { get_graph_nodes } from "./graph_targets.js";

export function get_graph_mouse(canvas)
{
	if (canvas?.graph_mouse && canvas.graph_mouse.length >= 2)
	{
		return canvas.graph_mouse;
	}
	if (canvas?.last_mouse && canvas.last_mouse.length >= 2)
	{
		return canvas.last_mouse;
	}
	if (canvas?.__crosshair_last_mouse_graph && canvas.__crosshair_last_mouse_graph.length >= 2)
	{
		return canvas.__crosshair_last_mouse_graph;
	}
	if (canvas?.__crosshair_last_mouse && canvas.__crosshair_last_mouse.length >= 2)
	{
		return canvas.__crosshair_last_mouse;
	}
	return null;
}

export function get_canvas_element(canvas)
{
	if (!canvas)
	{
		return null;
	}
	if (canvas.canvas instanceof HTMLCanvasElement)
	{
		return canvas.canvas;
	}
	if (canvas.ds?.canvas instanceof HTMLCanvasElement)
	{
		return canvas.ds.canvas;
	}
	if (canvas.element instanceof HTMLCanvasElement)
	{
		return canvas.element;
	}
	if (canvas.canvas?.canvas instanceof HTMLCanvasElement)
	{
		return canvas.canvas.canvas;
	}
	return null;
}

export function get_event_screen_point(event, canvas, prefer_canvas_offsets = false)
{
	if (prefer_canvas_offsets)
	{
		if (typeof event?.offsetX === "number" && typeof event?.offsetY === "number")
		{
			return [event.offsetX, event.offsetY];
		}
		if (typeof event?.canvasX === "number" && typeof event?.canvasY === "number")
		{
			return [event.canvasX, event.canvasY];
		}
	}
	if (canvas
		&& typeof event?.clientX === "number"
		&& typeof event?.clientY === "number")
	{
		const canvas_element = get_canvas_element(canvas);
		if (canvas_element && typeof canvas_element.getBoundingClientRect === "function")
		{
			const rect = canvas_element.getBoundingClientRect();
			return [
				event.clientX - rect.left,
				event.clientY - rect.top
			];
		}
	}
	if (typeof event?.offsetX === "number" && typeof event?.offsetY === "number")
	{
		return [event.offsetX, event.offsetY];
	}
	if (typeof event?.canvasX === "number" && typeof event?.canvasY === "number")
	{
		return [event.canvasX, event.canvasY];
	}
	if (typeof event?.clientX === "number" && typeof event?.clientY === "number")
	{
		return [event.clientX, event.clientY];
	}
	return null;
}

export function get_event_graph_point(canvas, event)
{
	if (!event)
	{
		return null;
	}
	if (canvas?.convertEventToGraph && typeof canvas.convertEventToGraph === "function")
	{
		const point = canvas.convertEventToGraph(event);
		if (Array.isArray(point) && point.length >= 2)
		{
			return point;
		}
	}
	if (typeof event?.canvasX === "number"
		&& typeof event?.canvasY === "number"
		&& typeof event?.offsetX !== "number"
		&& typeof event?.offsetY !== "number")
	{
		return [event.canvasX, event.canvasY];
	}
	if (canvas?.convertEventToLocal && typeof canvas.convertEventToLocal === "function")
	{
		const point = canvas.convertEventToLocal(event);
		if (Array.isArray(point) && point.length >= 2)
		{
			return point;
		}
	}
	if (typeof event.graphX === "number" && typeof event.graphY === "number")
	{
		return [event.graphX, event.graphY];
	}
	if (typeof event.graph_x === "number" && typeof event.graph_y === "number")
	{
		return [event.graph_x, event.graph_y];
	}
	const screen_point = get_event_screen_point(event, canvas, true);
	return screen_point_to_graph(canvas, screen_point);
}

export function graph_point_to_screen(canvas, point)
{
	if (!canvas || !point)
	{
		return null;
	}
	const scale = canvas?.ds?.scale;
	const offset = canvas?.ds?.offset;
	if (!Number.isFinite(scale) || !Array.isArray(offset) || offset.length < 2)
	{
		return null;
	}
	const safe_scale = scale || 1;
	return [
		(point[0] + offset[0]) * safe_scale,
		(point[1] + offset[1]) * safe_scale
	];
}

export function screen_point_to_graph(canvas, point)
{
	if (!canvas || !point)
	{
		return null;
	}
	const scale = canvas?.ds?.scale;
	const offset = canvas?.ds?.offset;
	if (!Number.isFinite(scale) || !Array.isArray(offset) || offset.length < 2)
	{
		return null;
	}
	const safe_scale = scale || 1;
	return [
		(point[0] / safe_scale) - offset[0],
		(point[1] / safe_scale) - offset[1]
	];
}

export function get_node_at_graph_point(canvas, graph_point)
{
	if (!canvas || !graph_point)
	{
		return null;
	}
	const nodes = get_graph_nodes(canvas);
	for (let index = nodes.length - 1; index >= 0; index -= 1)
	{
		const node = nodes[index];
		if (!node)
		{
			continue;
		}
		if (is_point_inside_bounds(graph_point, get_node_bounds(node)))
		{
			return node;
		}
	}
	return null;
}

export function is_screen_point_inside_bounds(canvas, screen_point, bounds)
{
	if (!canvas || !screen_point || !bounds)
	{
		return false;
	}
	const top_left = graph_point_to_screen(canvas, [bounds.left, bounds.top]);
	const bottom_right = graph_point_to_screen(canvas, [bounds.right, bounds.bottom]);
	if (!top_left || !bottom_right)
	{
		return false;
	}
	const min_x = Math.min(top_left[0], bottom_right[0]);
	const max_x = Math.max(top_left[0], bottom_right[0]);
	const min_y = Math.min(top_left[1], bottom_right[1]);
	const max_y = Math.max(top_left[1], bottom_right[1]);
	return screen_point[0] >= min_x
		&& screen_point[0] <= max_x
		&& screen_point[1] >= min_y
		&& screen_point[1] <= max_y;
}

export function get_node_at_screen_point(canvas, screen_point)
{
	if (!canvas || !screen_point)
	{
		return null;
	}
	const nodes = get_graph_nodes(canvas);
	for (let index = nodes.length - 1; index >= 0; index -= 1)
	{
		const node = nodes[index];
		if (!node)
		{
			continue;
		}
		if (is_screen_point_inside_bounds(canvas, screen_point, get_node_bounds(node)))
		{
			return node;
		}
	}
	return null;
}

export function is_screen_point_inside_node(canvas, node, screen_point)
{
	if (!node)
	{
		return false;
	}
	return is_screen_point_inside_bounds(canvas, screen_point, get_node_bounds(node));
}

export function is_screen_point_inside_group(canvas, group, screen_point)
{
	if (!group)
	{
		return false;
	}
	return is_screen_point_inside_bounds(canvas, screen_point, get_group_bounds(group));
}

export function get_closest_corner_by_screen(canvas, bounds, screen_point)
{
	if (!canvas || !bounds || !screen_point)
	{
		return null;
	}
	const scale = canvas?.ds?.scale;
	const offset = canvas?.ds?.offset;
	if (!Number.isFinite(scale) || !Array.isArray(offset) || offset.length < 2)
	{
		return null;
	}
	const safe_scale = scale || 1;
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
		const screen_corner = [
			(corner.point[0] + offset[0]) * safe_scale,
			(corner.point[1] + offset[1]) * safe_scale
		];
		const dx = screen_point[0] - screen_corner[0];
		const dy = screen_point[1] - screen_corner[1];
		const distance = (dx * dx) + (dy * dy);
		if (distance < best_distance)
		{
			best_distance = distance;
			best = corner.key;
		}
	}
	return best;
}
