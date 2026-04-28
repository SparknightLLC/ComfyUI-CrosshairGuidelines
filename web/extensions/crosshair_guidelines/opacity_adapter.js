import
	{
		get_canvas_element,
		graph_point_to_screen
	} from "./graph_coordinates.js";
import
	{
		get_group_bounds,
		get_node_bounds,
		get_node_box_bounds
	} from "./graph_geometry.js";
import
	{
		get_active_group_from_canvas,
		get_active_node_from_canvas,
		get_group_identifier,
		get_node_identifier
	} from "./graph_targets.js";
import
	{
		get_selected_group,
		get_selected_nodes
	} from "./graph_selection.js";
import { settings_state } from "./settings.js";

const DOM_OPACITY_TRANSITION_MS = 120;
const DOM_CACHE_TTL_MS = 120;
const OPACITY_EXEMPT_BOUNDS_PADDING_PX = 8;
const OPACITY_EXEMPT_SLOT_RADIUS_PX = 10;
const OPACITY_EXEMPT_DRAW_POINT_PADDING_PX = 2;

export const DOM_NODE_SELECTORS = [
	"[data-node-id]",
	"[data-nodeid]",
	"[data-node]",
	"[data-node_id]",
	".comfy-node",
	".graph-node",
	".node-view",
	".node-container",
	".litegraph-node",
	".lg-node"
];

export const DOM_GROUP_SELECTORS = [
	"[data-group-id]",
	"[data-groupid]",
	"[data-group]",
	"[data-group_id]",
	".comfy-group",
	".graph-group",
	".litegraph-group",
	".lg-group",
	".group-box"
];

const DOM_NODE_DATA_KEYS = ["nodeId", "nodeid", "node", "id", "node_id"];
const DOM_GROUP_DATA_KEYS = ["groupId", "groupid", "group", "id", "group_id"];
const EMPTY_DOM_CACHE = { node_elements: [], group_elements: [], container: null };

function to_kebab_case(value)
{
	return String(value)
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/_/g, "-")
		.toLowerCase();
}

function get_dom_data_value(element, keys)
{
	if (!element || !Array.isArray(keys))
	{
		return null;
	}
	const dataset = element.dataset;
	if (dataset)
	{
		for (const key of keys)
		{
			const value = dataset[key];
			if (value !== undefined && value !== null && String(value).trim())
			{
				return String(value);
			}
		}
	}
	if (typeof element.getAttribute !== "function")
	{
		return null;
	}
	for (const key of keys)
	{
		const attribute = `data-${to_kebab_case(key)}`;
		const value = element.getAttribute(attribute);
		if (value !== undefined && value !== null && String(value).trim())
		{
			return String(value);
		}
	}
	return null;
}

export function collect_id_set(items, resolver)
{
	if (!items || typeof resolver !== "function")
	{
		return null;
	}
	const iterator = items instanceof Set
		? items
		: (Array.isArray(items) ? items : null);
	if (!iterator)
	{
		return null;
	}
	const ids = new Set();
	for (const item of iterator)
	{
		const id = resolver(item);
		if (id)
		{
			ids.add(id);
		}
	}
	return ids.size ? ids : null;
}

function collect_dom_elements(container, selectors, data_keys)
{
	if (!container || typeof container.querySelectorAll !== "function" || !Array.isArray(selectors))
	{
		return [];
	}
	const found = new Set();
	for (const selector of selectors)
	{
		if (!selector)
		{
			continue;
		}
		const matches = container.querySelectorAll(selector);
		for (const element of matches)
		{
			found.add(element);
		}
	}
	if (found.size === 0)
	{
		return [];
	}
	const list = Array.from(found);
	if (Array.isArray(data_keys) && data_keys.length)
	{
		const with_data = list.filter((element) => !!get_dom_data_value(element, data_keys));
		if (with_data.length)
		{
			const top_data = with_data.filter((element) =>
			{
				for (const other of with_data)
				{
					if (other !== element && other.contains(element))
					{
						return false;
					}
				}
				return true;
			});
			return top_data.length ? top_data : with_data;
		}
	}
	const leaf_nodes = list.filter((element) =>
	{
		for (const other of found)
		{
			if (other !== element && element.contains(other))
			{
				return false;
			}
		}
		return true;
	});
	return leaf_nodes;
}

export function get_graph_container(canvas)
{
	if (typeof document === "undefined")
	{
		return null;
	}
	const element = get_canvas_element(canvas);
	if (!element)
	{
		return document.body;
	}
	const container_selectors = [
		".graph-container",
		".graph-canvas",
		".litegraph",
		".node-editor",
		".node-editor-root",
		".comfy-graph",
		".graph-wrapper",
		".graph-tab"
	];
	const candidates = [];
	for (const selector of container_selectors)
	{
		if (typeof element.closest === "function")
		{
			const candidate = element.closest(selector);
			if (candidate && !candidates.includes(candidate))
			{
				candidates.push(candidate);
			}
		}
	}
	if (element.parentElement && !candidates.includes(element.parentElement))
	{
		candidates.push(element.parentElement);
	}
	if (element.ownerDocument?.body && !candidates.includes(element.ownerDocument.body))
	{
		candidates.push(element.ownerDocument.body);
	}
	const node_selector_list = DOM_NODE_SELECTORS.join(", ");
	for (const candidate of candidates)
	{
		if (!candidate || typeof candidate.querySelector !== "function")
		{
			continue;
		}
		if (node_selector_list && candidate.querySelector(node_selector_list))
		{
			return candidate;
		}
	}
	return candidates.find((candidate) => !!candidate) || null;
}

function get_dom_elements_cached(canvas)
{
	if (!canvas || typeof document === "undefined")
	{
		return EMPTY_DOM_CACHE;
	}
	const container = get_graph_container(canvas);
	if (!container)
	{
		return EMPTY_DOM_CACHE;
	}
	const now = Date.now();
	const cache = canvas.__crosshair_dom_cache;
	if (cache
		&& cache.container === container
		&& (now - cache.time) < DOM_CACHE_TTL_MS)
	{
		return cache;
	}
	const node_elements = collect_dom_elements(container, DOM_NODE_SELECTORS, DOM_NODE_DATA_KEYS);
	const group_elements = collect_dom_elements(container, DOM_GROUP_SELECTORS, DOM_GROUP_DATA_KEYS);
	const next = {
		container,
		node_elements,
		group_elements,
		time: now
	};
	canvas.__crosshair_dom_cache = next;
	return next;
}

function get_screen_bounds_from_graph(canvas, bounds)
{
	if (!canvas || !bounds)
	{
		return null;
	}
	const top_left = graph_point_to_screen(canvas, [bounds.left, bounds.top]);
	const bottom_right = graph_point_to_screen(canvas, [bounds.right, bounds.bottom]);
	if (!top_left || !bottom_right)
	{
		return null;
	}
	return {
		left: Math.min(top_left[0], bottom_right[0]),
		top: Math.min(top_left[1], bottom_right[1]),
		right: Math.max(top_left[0], bottom_right[0]),
		bottom: Math.max(top_left[1], bottom_right[1])
	};
}

function get_rect_intersection_area(rect_a, rect_b)
{
	if (!rect_a || !rect_b)
	{
		return 0;
	}
	const left = Math.max(rect_a.left, rect_b.left);
	const right = Math.min(rect_a.right, rect_b.right);
	const top = Math.max(rect_a.top, rect_b.top);
	const bottom = Math.min(rect_a.bottom, rect_b.bottom);
	if (right <= left || bottom <= top)
	{
		return 0;
	}
	return (right - left) * (bottom - top);
}

function normalize_bounds(left, top, right, bottom)
{
	const normalized_left = Math.min(left, right);
	const normalized_right = Math.max(left, right);
	const normalized_top = Math.min(top, bottom);
	const normalized_bottom = Math.max(top, bottom);
	return {
		left: normalized_left,
		top: normalized_top,
		right: normalized_right,
		bottom: normalized_bottom
	};
}

function get_transform_point(transform, x, y)
{
	if (!transform)
	{
		return { x, y };
	}
	const tx = (transform.a * x) + (transform.c * y) + transform.e;
	const ty = (transform.b * x) + (transform.d * y) + transform.f;
	return { x: tx, y: ty };
}

function get_transform_scale(transform)
{
	if (!transform)
	{
		return 1;
	}
	const scale_x = Math.sqrt((transform.a * transform.a) + (transform.b * transform.b));
	const scale_y = Math.sqrt((transform.c * transform.c) + (transform.d * transform.d));
	const safe_x = Number.isFinite(scale_x) && scale_x > 0 ? scale_x : 1;
	const safe_y = Number.isFinite(scale_y) && scale_y > 0 ? scale_y : 1;
	return Math.max(safe_x, safe_y);
}

function get_canvas_device_ratio(canvas, ctx)
{
	const element = get_canvas_element(canvas) || ctx?.canvas;
	if (!element || typeof element.getBoundingClientRect !== "function")
	{
		return 1;
	}
	const rect = element.getBoundingClientRect();
	if (!rect || !Number.isFinite(rect.width) || rect.width <= 0)
	{
		return 1;
	}
	const width = element.width || 0;
	if (!Number.isFinite(width) || width <= 0)
	{
		return 1;
	}
	const element_ratio = width / rect.width;
	if (!Number.isFinite(element_ratio) || element_ratio <= 0)
	{
		return 1;
	}

	if (!ctx || typeof ctx.getTransform !== "function")
	{
		return element_ratio;
	}

	let transform = null;
	try
	{
		transform = ctx.getTransform();
	}
	catch (err)
	{
		transform = null;
	}
	if (!transform)
	{
		return element_ratio;
	}
	const transform_scale = get_transform_scale(transform);
	const ds_scale = canvas?.ds?.scale;
	const safe_ds_scale = Number.isFinite(ds_scale) && ds_scale > 0 ? ds_scale : 1;
	const ratio_guess = transform_scale / safe_ds_scale;

	const dist_identity = Math.abs(ratio_guess - 1);
	const dist_element = Math.abs(ratio_guess - element_ratio);
	return dist_element < dist_identity ? element_ratio : 1;
}

function transform_bounds(ctx, bounds)
{
	if (!ctx || !bounds)
	{
		return bounds;
	}
	if (typeof ctx.getTransform !== "function")
	{
		return bounds;
	}
	let transform = null;
	try
	{
		transform = ctx.getTransform();
	}
	catch (err)
	{
		transform = null;
	}
	if (!transform)
	{
		return bounds;
	}
	const p1 = get_transform_point(transform, bounds.left, bounds.top);
	const p2 = get_transform_point(transform, bounds.right, bounds.top);
	const p3 = get_transform_point(transform, bounds.left, bounds.bottom);
	const p4 = get_transform_point(transform, bounds.right, bounds.bottom);
	return {
		left: Math.min(p1.x, p2.x, p3.x, p4.x),
		top: Math.min(p1.y, p2.y, p3.y, p4.y),
		right: Math.max(p1.x, p2.x, p3.x, p4.x),
		bottom: Math.max(p1.y, p2.y, p3.y, p4.y)
	};
}

export function build_exempt_node_bounds(canvas, ctx, exempt_nodes)
{
	if (!(exempt_nodes instanceof Set) || exempt_nodes.size === 0)
	{
		return null;
	}
	const padding_px = OPACITY_EXEMPT_BOUNDS_PADDING_PX;
	const slot_radius_px = OPACITY_EXEMPT_SLOT_RADIUS_PX;
	const primary_nodes = new Set();
	if (canvas?.__crosshair_pointer_node)
	{
		primary_nodes.add(canvas.__crosshair_pointer_node);
	}
	if (canvas?.__crosshair_last_active_node)
	{
		primary_nodes.add(canvas.__crosshair_last_active_node);
	}
	const active_target = canvas?.__crosshair_active_target;
	if (active_target?.drag_node_target)
	{
		primary_nodes.add(active_target.drag_node_target);
	}
	if (active_target?.resize_node_candidate)
	{
		primary_nodes.add(active_target.resize_node_candidate);
	}
	const device_ratio = get_canvas_device_ratio(canvas, ctx);
	const padding = padding_px * device_ratio;
	const slot_radius = slot_radius_px * device_ratio;
	const bounds_list = [];
	for (const node of exempt_nodes)
	{
		if (!node)
		{
			continue;
		}
		const graph_bounds = get_node_bounds(node) || get_node_box_bounds(node);
		const bounds = get_screen_bounds_from_graph(canvas, graph_bounds);
		if (!bounds)
		{
			continue;
		}
		let left = (bounds.left * device_ratio) - padding;
		let top = (bounds.top * device_ratio) - padding;
		let right = (bounds.right * device_ratio) + padding;
		let bottom = (bounds.bottom * device_ratio) + padding;

		if (primary_nodes.has(node) && typeof node.getConnectionPos === "function")
		{
			const inputs = Array.isArray(node.inputs) ? node.inputs : [];
			for (let index = 0; index < inputs.length; index += 1)
			{
				let position = null;
				try
				{
					position = node.getConnectionPos(true, index);
				}
				catch (err)
				{
					position = null;
				}
				if (!Array.isArray(position) || position.length < 2)
				{
					continue;
				}
				const screen = graph_point_to_screen(canvas, position);
				if (!screen)
				{
					continue;
				}
				const x = screen[0] * device_ratio;
				const y = screen[1] * device_ratio;
				left = Math.min(left, x - slot_radius - padding);
				right = Math.max(right, x + slot_radius + padding);
				top = Math.min(top, y - slot_radius - padding);
				bottom = Math.max(bottom, y + slot_radius + padding);
			}
			const outputs = Array.isArray(node.outputs) ? node.outputs : [];
			for (let index = 0; index < outputs.length; index += 1)
			{
				let position = null;
				try
				{
					position = node.getConnectionPos(false, index);
				}
				catch (err)
				{
					position = null;
				}
				if (!Array.isArray(position) || position.length < 2)
				{
					continue;
				}
				const screen = graph_point_to_screen(canvas, position);
				if (!screen)
				{
					continue;
				}
				const x = screen[0] * device_ratio;
				const y = screen[1] * device_ratio;
				left = Math.min(left, x - slot_radius - padding);
				right = Math.max(right, x + slot_radius + padding);
				top = Math.min(top, y - slot_radius - padding);
				bottom = Math.max(bottom, y + slot_radius + padding);
			}
		}
		bounds_list.push({
			left,
			top,
			right,
			bottom
		});
	}
	return bounds_list.length > 0 ? bounds_list : null;
}

export function update_path_bounds(ctx, left, top, right, bottom)
{
	if (!ctx)
	{
		return;
	}
	const normalized = normalize_bounds(left, top, right, bottom);
	const transformed = transform_bounds(ctx, normalized);
	const current = ctx.__crosshair_path_bounds;
	if (!current)
	{
		ctx.__crosshair_path_bounds = transformed;
		return;
	}
	current.left = Math.min(current.left, transformed.left);
	current.top = Math.min(current.top, transformed.top);
	current.right = Math.max(current.right, transformed.right);
	current.bottom = Math.max(current.bottom, transformed.bottom);
}

export function reset_path_bounds(ctx)
{
	if (!ctx)
	{
		return;
	}
	ctx.__crosshair_path_bounds = null;
}

export function is_bounds_intersecting_list(bounds, bounds_list)
{
	if (!bounds || !Array.isArray(bounds_list) || bounds_list.length === 0)
	{
		return false;
	}
	for (const candidate of bounds_list)
	{
		if (!candidate)
		{
			continue;
		}
		if (get_rect_intersection_area(bounds, candidate) > 0)
		{
			return true;
		}
	}
	return false;
}

function get_draw_operation_bounds(ctx, method_name, args)
{
	if (!method_name || !args || args.length === 0)
	{
		return null;
	}
	let transform = null;
	if (ctx && typeof ctx.getTransform === "function")
	{
		try
		{
			transform = ctx.getTransform();
		}
		catch (err)
		{
			transform = null;
		}
	}
	const safe_scale = get_transform_scale(transform);
	const point_padding = OPACITY_EXEMPT_DRAW_POINT_PADDING_PX / safe_scale;
	if (method_name === "fillText" || method_name === "strokeText")
	{
		const x = Number(args[1]);
		const y = Number(args[2]);
		if (!Number.isFinite(x) || !Number.isFinite(y))
		{
			return null;
		}
		const bounds = {
			left: x - point_padding,
			top: y - point_padding,
			right: x + point_padding,
			bottom: y + point_padding
		};
		return transform_bounds(ctx, bounds);
	}
	if (method_name === "fillRect" || method_name === "strokeRect")
	{
		const x = Number(args[0]);
		const y = Number(args[1]);
		const width = Number(args[2]);
		const height = Number(args[3]);
		if (!Number.isFinite(x) || !Number.isFinite(y)
			|| !Number.isFinite(width) || !Number.isFinite(height))
		{
			return null;
		}
		return transform_bounds(ctx, normalize_bounds(x, y, x + width, y + height));
	}
	if (method_name === "drawImage")
	{
		if (args.length >= 9)
		{
			const x = Number(args[5]);
			const y = Number(args[6]);
			const width = Number(args[7]);
			const height = Number(args[8]);
			if (!Number.isFinite(x) || !Number.isFinite(y)
				|| !Number.isFinite(width) || !Number.isFinite(height))
			{
				return null;
			}
			return transform_bounds(ctx, normalize_bounds(x, y, x + width, y + height));
		}
		if (args.length >= 5)
		{
			const x = Number(args[1]);
			const y = Number(args[2]);
			const width = Number(args[3]);
			const height = Number(args[4]);
			if (!Number.isFinite(x) || !Number.isFinite(y)
				|| !Number.isFinite(width) || !Number.isFinite(height))
			{
				return null;
			}
			return transform_bounds(ctx, normalize_bounds(x, y, x + width, y + height));
		}
		if (args.length >= 3)
		{
			const x = Number(args[1]);
			const y = Number(args[2]);
			if (!Number.isFinite(x) || !Number.isFinite(y))
			{
				return null;
			}
			const image = args[0];
			const width = image && Number.isFinite(image.width) ? image.width : 0;
			const height = image && Number.isFinite(image.height) ? image.height : 0;
			if (width && height)
			{
				return transform_bounds(ctx, normalize_bounds(x, y, x + width, y + height));
			}
			const bounds = {
				left: x - point_padding,
				top: y - point_padding,
				right: x + point_padding,
				bottom: y + point_padding
			};
			return transform_bounds(ctx, bounds);
		}
	}
	return null;
}

export function is_draw_operation_inside_bounds(ctx, method_name, args, bounds_list)
{
	if (!Array.isArray(bounds_list) || bounds_list.length === 0)
	{
		return false;
	}
	const draw_bounds = get_draw_operation_bounds(ctx, method_name, args);
	if (!draw_bounds)
	{
		return false;
	}
	for (const bounds of bounds_list)
	{
		if (!bounds)
		{
			continue;
		}
		if (get_rect_intersection_area(bounds, draw_bounds) > 0)
		{
			return true;
		}
	}
	return false;
}

function find_dom_element_for_bounds(elements, bounds)
{
	if (!Array.isArray(elements) || elements.length === 0 || !bounds)
	{
		return null;
	}
	let best = null;
	let best_area = 0;
	for (const element of elements)
	{
		if (!element || typeof element.getBoundingClientRect !== "function")
		{
			continue;
		}
		const rect = element.getBoundingClientRect();
		const area = get_rect_intersection_area(rect, bounds);
		if (area > best_area)
		{
			best_area = area;
			best = element;
		}
	}
	return best_area > 0 ? best : null;
}

function find_dom_element_for_node(canvas, node, elements)
{
	if (!canvas || !node)
	{
		return null;
	}
	const bounds = get_node_box_bounds(node);
	const screen_bounds = get_screen_bounds_from_graph(canvas, bounds);
	if (!screen_bounds)
	{
		return null;
	}
	return find_dom_element_for_bounds(elements, screen_bounds);
}

function find_dom_element_for_group(canvas, group, elements)
{
	if (!canvas || !group)
	{
		return null;
	}
	const bounds = get_group_bounds(group);
	const screen_bounds = get_screen_bounds_from_graph(canvas, bounds);
	if (!screen_bounds)
	{
		return null;
	}
	return find_dom_element_for_bounds(elements, screen_bounds);
}

function apply_dom_opacity_to_elements(elements, target_opacity, exempt_elements, should_dim)
{
	if (!Array.isArray(elements) || elements.length === 0)
	{
		return;
	}
	const exempt_set = exempt_elements instanceof Set ? exempt_elements : new Set();
	for (const element of elements)
	{
		if (!element || !element.style)
		{
			continue;
		}
		if (!should_dim)
		{
			if (element.__crosshair_opacity_applied)
			{
				element.style.opacity = "";
				element.style.transition = element.__crosshair_prev_transition || "";
				element.style.willChange = element.__crosshair_prev_will_change || "";
				element.__crosshair_opacity_applied = false;
				element.__crosshair_prev_transition = null;
				element.__crosshair_prev_will_change = null;
				element.__crosshair_opacity_value = null;
			}
			continue;
		}
		if (!element.__crosshair_opacity_applied)
		{
			element.__crosshair_prev_transition = element.style.transition;
			element.__crosshair_prev_will_change = element.style.willChange;
		}
		const opacity_value = exempt_set.has(element) ? 1 : target_opacity;
		if (element.__crosshair_opacity_value !== opacity_value)
		{
			element.style.opacity = String(opacity_value);
			element.__crosshair_opacity_value = opacity_value;
		}
		const existing_transition = element.style.transition || "";
		if (!String(existing_transition).includes("opacity"))
		{
			const trimmed = String(existing_transition).trim();
			const separator = trimmed ? ", " : "";
			element.style.transition = `${trimmed}${separator}opacity ${DOM_OPACITY_TRANSITION_MS}ms ease-out`;
		}
		element.style.willChange = "opacity";
		element.__crosshair_opacity_applied = true;
	}
}

function apply_dom_outline_to_elements(elements, target_elements, should_hide)
{
	if (!Array.isArray(elements) || elements.length === 0)
	{
		return;
	}
	const target_set = target_elements instanceof Set ? target_elements : new Set();
	for (const element of elements)
	{
		if (!element || !element.style)
		{
			continue;
		}
		const hide = should_hide && target_set.has(element);
		if (!hide)
		{
			if (element.__crosshair_outline_hidden)
			{
				element.style.outline = element.__crosshair_prev_outline || "";
				element.style.boxShadow = element.__crosshair_prev_box_shadow || "";
				element.__crosshair_prev_outline = null;
				element.__crosshair_prev_box_shadow = null;
				element.__crosshair_outline_hidden = false;
			}
			continue;
		}
		if (!element.__crosshair_outline_hidden)
		{
			element.__crosshair_prev_outline = element.style.outline;
			element.__crosshair_prev_box_shadow = element.style.boxShadow;
		}
		element.style.outline = "none";
		element.style.boxShadow = "none";
		element.__crosshair_outline_hidden = true;
	}
}

export function apply_dom_outline_visibility(canvas)
{
	if (!canvas || typeof document === "undefined")
	{
		return;
	}
	const should_hide = settings_state.hide_active_outline
		&& !!canvas.__crosshair_hide_active_outline;
	if (!should_hide && !canvas.__crosshair_dom_outline_active)
	{
		return;
	}
	canvas.__crosshair_dom_outline_active = should_hide;

	const dom = get_dom_elements_cached(canvas);
	const node_elements = dom.node_elements;
	const group_elements = dom.group_elements;
	if (node_elements.length === 0 && group_elements.length === 0)
	{
		return;
	}

	const outline_nodes = new Set();
	const outline_groups = new Set();

	if (should_hide)
	{
		const active_node = get_active_node_from_canvas(canvas);
		if (active_node)
		{
			outline_nodes.add(active_node);
		}
		const active_group = get_active_group_from_canvas(canvas);
		if (active_group)
		{
			outline_groups.add(active_group);
		}
		const active_target = canvas.__crosshair_active_target;
		if (active_target)
		{
			if (active_target.drag_node_target)
			{
				outline_nodes.add(active_target.drag_node_target);
			}
			if (active_target.resize_node_candidate)
			{
				outline_nodes.add(active_target.resize_node_candidate);
			}
			if (active_target.active_resize_group)
			{
				outline_groups.add(active_target.active_resize_group);
			}
			if (active_target.drag_group)
			{
				outline_groups.add(active_target.drag_group);
			}
		}
		if (canvas.__crosshair_drag_node_target)
		{
			outline_nodes.add(canvas.__crosshair_drag_node_target);
		}
		if (canvas.__crosshair_node_resize_target)
		{
			outline_nodes.add(canvas.__crosshair_node_resize_target);
		}
		if (canvas.__crosshair_drag_group_target)
		{
			outline_groups.add(canvas.__crosshair_drag_group_target);
		}
		if (canvas.__crosshair_group_resize_target)
		{
			outline_groups.add(canvas.__crosshair_group_resize_target);
		}
		for (const node of get_selected_nodes(canvas))
		{
			if (node)
			{
				outline_nodes.add(node);
			}
		}
		const selected_group = get_selected_group(canvas);
		if (selected_group)
		{
			outline_groups.add(selected_group);
		}
	}

	const outline_node_elements = new Set();
	const outline_group_elements = new Set();
	const outline_node_ids = collect_id_set(outline_nodes, get_node_identifier);
	const outline_group_ids = collect_id_set(outline_groups, get_group_identifier);

	if (outline_node_ids && outline_node_ids.size > 0)
	{
		for (const element of node_elements)
		{
			const id = get_dom_data_value(element, DOM_NODE_DATA_KEYS);
			if (id && outline_node_ids.has(id))
			{
				outline_node_elements.add(element);
			}
		}
	}
	if (outline_group_ids && outline_group_ids.size > 0)
	{
		for (const element of group_elements)
		{
			const id = get_dom_data_value(element, DOM_GROUP_DATA_KEYS);
			if (id && outline_group_ids.has(id))
			{
				outline_group_elements.add(element);
			}
		}
	}
	if (outline_nodes.size > 0 && outline_node_elements.size === 0 && node_elements.length > 0)
	{
		for (const node of outline_nodes)
		{
			const match = find_dom_element_for_node(canvas, node, node_elements);
			if (match)
			{
				outline_node_elements.add(match);
			}
		}
	}
	if (outline_groups.size > 0 && outline_group_elements.size === 0 && group_elements.length > 0)
	{
		for (const group of outline_groups)
		{
			const match = find_dom_element_for_group(canvas, group, group_elements);
			if (match)
			{
				outline_group_elements.add(match);
			}
		}
	}

	apply_dom_outline_to_elements(node_elements, outline_node_elements, should_hide);
	apply_dom_outline_to_elements(group_elements, outline_group_elements, should_hide);
}

export function apply_dom_node_opacity(canvas)
{
	if (!canvas || typeof document === "undefined")
	{
		return;
	}
	const node_opacity_value = Number.isFinite(canvas.__crosshair_nodes_current_opacity)
		? canvas.__crosshair_nodes_current_opacity
		: 1;
	const target_opacity = Math.min(1, Math.max(0, node_opacity_value));
	const should_dim = target_opacity < 0.999;
	if (!should_dim && !canvas.__crosshair_dom_opacity_active)
	{
		return;
	}
	canvas.__crosshair_dom_opacity_active = should_dim;

	const dom = get_dom_elements_cached(canvas);
	const node_elements = dom.node_elements;
	const group_elements = dom.group_elements;
	if (node_elements.length === 0 && group_elements.length === 0)
	{
		return;
	}

	const exempt_node_elements = new Set();
	const exempt_group_elements = new Set();
	const exempt_nodes = canvas.__crosshair_node_opacity_exempt_nodes;
	const exempt_groups = canvas.__crosshair_node_opacity_exempt_groups;
	const has_exempt_nodes = !!exempt_nodes && exempt_nodes.size > 0;
	const exempt_node_ids = canvas.__crosshair_node_opacity_exempt_node_ids
		|| collect_id_set(exempt_nodes, get_node_identifier);
	const exempt_group_ids = canvas.__crosshair_node_opacity_exempt_group_ids
		|| collect_id_set(exempt_groups, get_group_identifier);

	if (exempt_node_ids && exempt_node_ids.size > 0)
	{
		for (const element of node_elements)
		{
			const id = get_dom_data_value(element, DOM_NODE_DATA_KEYS);
			if (id && exempt_node_ids.has(id))
			{
				exempt_node_elements.add(element);
			}
		}
	}
	if (exempt_group_ids && exempt_group_ids.size > 0)
	{
		for (const element of group_elements)
		{
			const id = get_dom_data_value(element, DOM_GROUP_DATA_KEYS);
			if (id && exempt_group_ids.has(id))
			{
				exempt_group_elements.add(element);
			}
		}
	}

	if (exempt_nodes && exempt_node_elements.size === 0 && node_elements.length > 0)
	{
		for (const node of exempt_nodes)
		{
			const match = find_dom_element_for_node(canvas, node, node_elements);
			if (match)
			{
				exempt_node_elements.add(match);
			}
		}
	}
	if (exempt_groups && exempt_group_elements.size === 0 && group_elements.length > 0)
	{
		for (const group of exempt_groups)
		{
			const match = find_dom_element_for_group(canvas, group, group_elements);
			if (match)
			{
				exempt_group_elements.add(match);
			}
		}
	}

	let should_dim_nodes = should_dim;
	if (has_exempt_nodes && exempt_node_elements.size === 0)
	{
		should_dim_nodes = false;
	}
	apply_dom_opacity_to_elements(node_elements, target_opacity, exempt_node_elements, should_dim_nodes);
	const dim_groups = should_dim_nodes && !has_exempt_nodes;
	apply_dom_opacity_to_elements(group_elements, target_opacity, exempt_group_elements, dim_groups);
}
