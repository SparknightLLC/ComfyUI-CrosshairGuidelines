import { app } from "../../../scripts/app.js";

const EXTENSION_NAME = "comfy.crosshair_guidelines";
const SETTING_MOVE_MODE_ID = "crosshair_guidelines.move_mode";
const SETTING_RESIZE_MODE_ID = "crosshair_guidelines.resize_mode";
const SETTING_IDLE_MODE_ID = "crosshair_guidelines.idle_mode";
const SETTING_COLOR_ID = "crosshair_guidelines.color";
const SETTING_THICKNESS_ID = "crosshair_guidelines.thickness";
const SETTING_LINK_OPACITY_ID = "crosshair_guidelines.link_opacity";
const SETTING_NODE_OPACITY_ID = "crosshair_guidelines.node_opacity";
const SETTING_HIDE_ACTIVE_OUTLINE_ID = "crosshair_guidelines.hide_active_outline";
const SETTINGS_PANEL_LABEL = "Crosshair Guidelines";
const SETTINGS_SECTION_LABEL = "General";
const LEGACY_SETTING_STORAGE_KEY = "crosshair_guidelines.enabled";
const DEFAULT_LINE_COLOR = "#0B8CE9";
const DEFAULT_LINE_WIDTH = 2;
const DEFAULT_MOVE_MODE = "all";
const DEFAULT_RESIZE_MODE = "selected";
const DEFAULT_IDLE_MODE = "off";
const DEFAULT_LINK_OPACITY_MULTIPLIER = 0.05;
const DEFAULT_NODE_OPACITY_MULTIPLIER = 0.6;
const DEFAULT_HIDE_ACTIVE_OUTLINE = false;
const LINK_OPACITY_INPUT_PATCH_MAX_TRIES = 120;
const DRAG_THRESHOLD_PX = 4;
const RESIZE_HITBOX_PX = 14;
const POINTER_IDLE_RESET_MS = 250;
const FORCE_HIDE_AFTER_RELEASE_MS = 120;
const INITIAL_HIDE_MS = 250;
const ACTIVITY_THRESHOLD_PX = 0.5;
const RESIZE_EDGE_THRESHOLD_PX = 0.5;
const DOM_OPACITY_TRANSITION_MS = 120;
const DOM_CACHE_TTL_MS = 120;
const OPACITY_EXEMPT_BOUNDS_PADDING_PX = 8;
const OPACITY_EXEMPT_SLOT_RADIUS_PX = 10;
const OPACITY_EXEMPT_DRAW_POINT_PADDING_PX = 2;
const ACTIVITY_SCAN_INTERVAL_MS = 32;
const SLOT_LABEL_HITBOX_PX = 88;
const SLOT_ROW_HITBOX_PX = 20;
const SLOT_HANDLE_HITBOX_PX = 10;
const SLOT_HANDLE_HITBOX_COMPACT_PX = 6;
const SLOT_LABEL_EDGE_HITBOX_PX = 26;
const DOM_NODE_SELECTORS = [
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
const DOM_GROUP_SELECTORS = [
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
const GRAPH_EVENT_SELECTORS = [
	"canvas",
	".litegraph",
	".graph-canvas",
	".graph-container",
	".comfy-graph",
	".node-editor",
	".node-editor-root",
	...DOM_NODE_SELECTORS,
	...DOM_GROUP_SELECTORS
];
const DOM_NODE_DATA_KEYS = ["nodeId", "nodeid", "node", "id", "node_id"];
const DOM_GROUP_DATA_KEYS = ["groupId", "groupid", "group", "id", "group_id"];
const DRAG_GROUP_KEYS = ["dragging_group", "draggingGroup", "drag_group", "dragGroup", "group_dragged", "groupDragged"];
const RESIZE_GROUP_KEYS = ["resizing_group", "resizingGroup"];
const RESIZE_GROUP_FLAG_KEYS = ["selected_group_resizing", "selectedGroupResizing", "resizing_group_corner", "resizingGroupCorner"];
const CONNECTION_STATE_KEYS = [
	"connecting_node",
	"connectingNode",
	"connecting_link",
	"connectingLink",
	"connecting_input",
	"connectingInput",
	"connecting_output",
	"connectingOutput",
	"connecting_slot",
	"connectingSlot",
	"connecting_pos",
	"connectingPos",
	"connectingSlotPos",
	"linking_node",
	"linkingNode",
	"linking_output",
	"linkingOutput",
	"linking_input",
	"linkingInput",
	"linking_link",
	"linkingLink",
	"dragging_link",
	"draggingLink",
	"dragging_link_info",
	"draggingLinkInfo",
	"link_dragging",
	"linkDragging"
];
const OPACITY_KEYS = {
	links: {
		current: "__crosshair_links_current_opacity",
		target: "__crosshair_links_opacity_target",
		last: "__crosshair_links_opacity_last_time",
		animating: "__crosshair_links_opacity_animating",
		ctx_active: "__crosshair_links_opacity_active",
		ctx_multiplier: "__crosshair_links_opacity_multiplier"
	},
	nodes: {
		current: "__crosshair_nodes_current_opacity",
		target: "__crosshair_nodes_opacity_target",
		last: "__crosshair_nodes_opacity_last_time",
		animating: "__crosshair_nodes_opacity_animating",
		ctx_active: "__crosshair_node_opacity_active",
		ctx_multiplier: "__crosshair_node_opacity_multiplier"
	}
};
const EMPTY_DOM_CACHE = { node_elements: [], group_elements: [], container: null };

if (typeof window !== "undefined")
{
	window.__crosshair_guidelines_loaded = true;
}

let move_mode = DEFAULT_MOVE_MODE;
let resize_mode = DEFAULT_RESIZE_MODE;
let idle_mode = DEFAULT_IDLE_MODE;
let line_color = DEFAULT_LINE_COLOR;
let line_width = DEFAULT_LINE_WIDTH;
let link_opacity_multiplier = DEFAULT_LINK_OPACITY_MULTIPLIER;
let link_opacity_input_patch_attempts = 0;
let node_opacity_multiplier = DEFAULT_NODE_OPACITY_MULTIPLIER;
let hide_active_outline = DEFAULT_HIDE_ACTIVE_OUTLINE;

function normalize_move_mode(value)
{
	if (value === "off" || value === "all")
	{
		return value;
	}
	return DEFAULT_MOVE_MODE;
}

function normalize_resize_mode(value)
{
	if (value === "off" || value === "selected" || value === "all")
	{
		return value;
	}
	return DEFAULT_RESIZE_MODE;
}

function normalize_idle_mode(value)
{
	if (value === "off" || value === "all")
	{
		return value;
	}
	return DEFAULT_IDLE_MODE;
}

function normalize_line_color(value)
{
	if (typeof value === "string" && value.trim())
	{
		return value;
	}
	return DEFAULT_LINE_COLOR;
}

function normalize_line_width(value)
{
	const number_value = Number.parseFloat(value);
	if (!Number.isFinite(number_value))
	{
		return DEFAULT_LINE_WIDTH;
	}
	return Math.max(0.5, number_value);
}

function normalize_link_opacity_multiplier(value)
{
	if (typeof value === "boolean")
	{
		return value ? DEFAULT_LINK_OPACITY_MULTIPLIER : 1;
	}
	const normalized_value = typeof value === "string" ? value.replace(",", ".") : value;
	const number_value = Number.parseFloat(normalized_value);
	if (!Number.isFinite(number_value))
	{
		return DEFAULT_LINK_OPACITY_MULTIPLIER;
	}
	return Math.min(1, Math.max(0, number_value));
}

function normalize_node_opacity_multiplier(value)
{
	const normalized_value = typeof value === "string" ? value.replace(",", ".") : value;
	const number_value = Number.parseFloat(normalized_value);
	if (!Number.isFinite(number_value))
	{
		return DEFAULT_NODE_OPACITY_MULTIPLIER;
	}
	return Math.min(1, Math.max(0, number_value));
}

function normalize_hide_active_outline(value)
{
	if (typeof value === "boolean")
	{
		return value;
	}
	if (typeof value === "string")
	{
		const normalized = value.trim().toLowerCase();
		if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on")
		{
			return true;
		}
		if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off")
		{
			return false;
		}
	}
	return DEFAULT_HIDE_ACTIVE_OUTLINE;
}

function load_setting(key, fallback, normalizer)
{
	const stored = localStorage.getItem(key);
	if (stored === null)
	{
		localStorage.setItem(key, JSON.stringify(fallback));
		return fallback;
	}
	try
	{
		const parsed = JSON.parse(stored);
		return typeof normalizer === "function" ? normalizer(parsed) : parsed;
	}
	catch (err)
	{
		localStorage.setItem(key, JSON.stringify(fallback));
		return fallback;
	}
}

function save_setting(key, value)
{
	localStorage.setItem(key, JSON.stringify(value));
}

function get_title_height(node)
{
	if (!window.LiteGraph || !node || !node.constructor)
	{
		return 0;
	}
	const title_mode = node.constructor.title_mode;
	if (title_mode === window.LiteGraph.NO_TITLE || title_mode === window.LiteGraph.TRANSPARENT_TITLE)
	{
		return 0;
	}
	return window.LiteGraph.NODE_TITLE_HEIGHT || 30;
}

function get_node_bounds(node)
{
	const pos = node && node.pos ? node.pos : [0, 0];
	let width = node && node.size ? node.size[0] : 0;
	let height = node && node.size ? node.size[1] : 0;
	if (node && node.flags && node.flags.collapsed)
	{
		if (typeof node._collapsed_width === "number")
		{
			width = node._collapsed_width;
		}
		height = 0;
	}
	const title_height = get_title_height(node);
	const left = pos[0];
	const top = pos[1] - title_height;
	const right = pos[0] + width;
	const bottom = pos[1] + height;
	return { left, top, right, bottom };
}

function get_node_box_bounds(node)
{
	const pos = node && node.pos ? node.pos : [0, 0];
	let width = node && node.size ? node.size[0] : 0;
	let height = node && node.size ? node.size[1] : 0;
	if (node && node.flags && node.flags.collapsed)
	{
		if (typeof node._collapsed_width === "number")
		{
			width = node._collapsed_width;
		}
	}
	const left = pos[0];
	const top = pos[1];
	const right = pos[0] + width;
	const bottom = pos[1] + height;
	return { left, top, right, bottom };
}

function is_point_inside_bounds(point, bounds)
{
	if (!point || !bounds)
	{
		return false;
	}
	return point[0] >= bounds.left
		&& point[0] <= bounds.right
		&& point[1] >= bounds.top
		&& point[1] <= bounds.bottom;
}

function is_node_like(node)
{
	if (!node || typeof node !== "object")
	{
		return false;
	}
	return Array.isArray(node.pos)
		&& node.pos.length >= 2
		&& Array.isArray(node.size)
		&& node.size.length >= 2;
}

function is_group_like(group)
{
	if (!group || typeof group !== "object")
	{
		return false;
	}
	const pos = group._pos || group.pos;
	const size = group._size || group.size;
	if (!Array.isArray(pos) || pos.length < 2 || !Array.isArray(size) || size.length < 2)
	{
		return false;
	}
	if (group._pos || group._size)
	{
		return true;
	}
	const name = group.constructor?.name;
	if (typeof name === "string" && name.toLowerCase().includes("group"))
	{
		return true;
	}
	return false;
}

function is_node_selected(node)
{
	if (!node || typeof node !== "object")
	{
		return false;
	}
	return !!(node.is_selected || node.isSelected || node.selected);
}

function is_group_selected(group)
{
	if (!group || typeof group !== "object")
	{
		return false;
	}
	return !!(group.is_selected || group.isSelected || group.selected);
}

function resolve_node_candidate(canvas, candidate)
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

function resolve_group_candidate(canvas, candidate)
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

function find_node_by_keys(canvas, keys)
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

function find_group_by_keys(canvas, keys)
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

function get_canvas_drag_node(canvas)
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

function get_canvas_resize_node(canvas)
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

function get_active_node_from_canvas(canvas)
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

function get_canvas_drag_group(canvas)
{
	return find_group_by_keys(canvas, DRAG_GROUP_KEYS);
}

function get_canvas_resize_group(canvas)
{
	return find_group_by_keys(canvas, RESIZE_GROUP_KEYS);
}

function get_active_group_from_canvas(canvas)
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

function has_group_resize_flags(canvas)
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

function is_interaction_active(canvas)
{
	if (!canvas)
	{
		return false;
	}
	if (canvas.__crosshair_mouse_down && canvas.__crosshair_dragging)
	{
		return true;
	}
	if (canvas.__crosshair_pointer_down && canvas.__crosshair_pointer_dragging)
	{
		return true;
	}
	if (canvas.__crosshair_node_resize_latched || canvas.__crosshair_group_resize_latched)
	{
		return true;
	}
	const dragging_canvas = !!canvas.dragging_canvas
		|| !!canvas.draggingCanvas
		|| !!canvas.dragging_background
		|| !!canvas.draggingBackground;
	const has_node_action = !!get_active_node_from_canvas(canvas);
	const has_group_action = !!get_active_group_from_canvas(canvas);
	if (has_node_action || has_group_action)
	{
		return true;
	}
	if (has_group_resize_flags(canvas) && get_selected_group(canvas))
	{
		return true;
	}
	if (canvas.__crosshair_interaction_active)
	{
		return true;
	}
	if (dragging_canvas)
	{
		return false;
	}
	return false;
}

function get_canvas_frame_id(canvas)
{
	if (!canvas)
	{
		return null;
	}
	const candidates = [
		canvas.last_draw_time,
		canvas.lastDrawTime,
		canvas._last_draw_time
	];
	for (const candidate of candidates)
	{
		if (Number.isFinite(candidate))
		{
			return candidate;
		}
	}
	return null;
}

function ensure_interaction_state(canvas, ctx)
{
	if (!canvas)
	{
		return null;
	}
	const now = (typeof performance !== "undefined" && performance.now)
		? performance.now()
		: Date.now();
	const frame_id = get_canvas_frame_id(canvas);
	if (Number.isFinite(frame_id)
		&& canvas.__crosshair_state_frame_id === frame_id
		&& canvas.__crosshair_state_snapshot)
	{
		return canvas.__crosshair_state_snapshot;
	}
	if (!Number.isFinite(frame_id)
		&& Number.isFinite(canvas.__crosshair_state_time)
		&& (now - canvas.__crosshair_state_time) < 8
		&& canvas.__crosshair_state_snapshot)
	{
		return canvas.__crosshair_state_snapshot;
	}
	const state = compute_interaction_state(canvas, ctx);
	canvas.__crosshair_state_snapshot = state;
	canvas.__crosshair_state_frame_id = Number.isFinite(frame_id) ? frame_id : null;
	canvas.__crosshair_state_time = now;
	return state;
}

function get_selected_nodes(canvas)
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
			continue;
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

function get_selected_group(canvas)
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

function get_node_dimensions(node)
{
	if (!node)
	{
		return {
			pos: [0, 0],
			width: 0,
			height: 0,
			title_height: 0
		};
	}
	const pos = node.pos || [0, 0];
	let width = node.size ? node.size[0] : 0;
	let height = node.size ? node.size[1] : 0;
	if (node.flags && node.flags.collapsed)
	{
		if (typeof node._collapsed_width === "number")
		{
			width = node._collapsed_width;
		}
		height = 0;
	}
	return { pos, width, height, title_height: get_title_height(node) };
}

function get_group_bounds(group)
{
	if (!group)
	{
		return null;
	}
	const pos = group._pos || group.pos || [0, 0];
	const size = group._size || group.size || [0, 0];
	return { left: pos[0], top: pos[1], right: pos[0] + size[0], bottom: pos[1] + size[1] };
}

function collect_nodes_in_group(canvas, group)
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

function draw_guidelines_at(ctx, canvas, point, visible_rect)
{
	const rect = visible_rect || canvas.visible_rect;
	if (!rect || rect.length < 4)
	{
		return;
	}
	const left = rect[0];
	const top = rect[1];
	const right = rect[0] + rect[2];
	const bottom = rect[1] + rect[3];
	const scale = canvas && canvas.ds ? canvas.ds.scale : 1;
	const width = line_width / (scale || 1);

	ctx.save();
	ctx.strokeStyle = line_color;
	ctx.lineWidth = width;
	ctx.beginPath();
	ctx.moveTo(left, point[1]);
	ctx.lineTo(right, point[1]);
	ctx.moveTo(point[0], top);
	ctx.lineTo(point[0], bottom);
	ctx.stroke();
	ctx.restore();
}

function get_grid_size()
{
	if (window.LiteGraph && typeof window.LiteGraph.CANVAS_GRID_SIZE === "number")
	{
		return window.LiteGraph.CANVAS_GRID_SIZE;
	}
	return 10;
}

function is_snap_enabled()
{
	if (app?.shiftDown)
	{
		return true;
	}

	if (app?.ui?.settings?.getSettingValue)
	{
		const candidates = [
			"pysssss.SnapToGrid",
			"snap_to_grid",
			"Comfy.SnapToGrid"
		];
		for (const candidate of candidates)
		{
			try
			{
				const value = app.ui.settings.getSettingValue(candidate);
				if (value)
				{
					return true;
				}
			}
			catch (err)
			{
			}
		}
	}

	return false;
}

function snap_value(value, grid_size)
{
	if (!grid_size)
	{
		return value;
	}
	return Math.round(value / grid_size) * grid_size;
}

function snap_bounds_by_position(bounds, grid_size)
{
	if (!bounds || !grid_size)
	{
		return bounds;
	}
	const width = bounds.right - bounds.left;
	const height = bounds.bottom - bounds.top;
	const left = snap_value(bounds.left, grid_size);
	const top = snap_value(bounds.top, grid_size);
	return {
		left,
		top,
		right: left + width,
		bottom: top + height
	};
}

function snap_node_bounds_by_position(node, grid_size)
{
	const geometry = get_node_dimensions(node);
	if (!grid_size)
	{
		return get_node_bounds(node);
	}
	const snapped_pos = [
		snap_value(geometry.pos[0], grid_size),
		snap_value(geometry.pos[1], grid_size)
	];
	return {
		left: snapped_pos[0],
		top: snapped_pos[1] - geometry.title_height,
		right: snapped_pos[0] + geometry.width,
		bottom: snapped_pos[1] + geometry.height
	};
}

function get_graph_mouse(canvas)
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

function get_event_screen_point(event, canvas, prefer_canvas_offsets = false)
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

function get_event_graph_point(canvas, event)
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
	if (!screen_point)
	{
		return null;
	}
	const scale = canvas?.ds?.scale;
	const offset = canvas?.ds?.offset;
	if (Number.isFinite(scale) && Array.isArray(offset) && offset.length >= 2)
	{
		const safe_scale = scale || 1;
		return [
			(screen_point[0] / safe_scale) - offset[0],
			(screen_point[1] / safe_scale) - offset[1]
		];
	}
	return screen_point;
}

function get_canvas_element(canvas)
{
	if (!canvas)
	{
		return null;
	}
	if (canvas.canvas && typeof canvas.canvas.addEventListener === "function")
	{
		return canvas.canvas;
	}
	if (canvas.element && typeof canvas.element.addEventListener === "function")
	{
		return canvas.element;
	}
	return null;
}

function is_interactive_input_target(target)
{
	if (!target)
	{
		return false;
	}
	const element = target instanceof Element ? target : null;
	if (!element)
	{
		return false;
	}
	const tag_name = element.tagName ? element.tagName.toLowerCase() : "";
	if (tag_name === "input" || tag_name === "textarea" || tag_name === "select")
	{
		return true;
	}
	if (element.isContentEditable)
	{
		return true;
	}
	if (typeof element.getAttribute === "function")
	{
		const editable = element.getAttribute("contenteditable");
		if (editable && editable !== "false")
		{
			return true;
		}
	}
	if (typeof element.closest === "function")
	{
		const selector = "input, textarea, select, [contenteditable='true'], [contenteditable='plaintext-only'], .comfy-input, .comfy-number, .comfy-multiline";
		if (element.closest(selector))
		{
			return true;
		}
	}
	return false;
}

function is_pointer_down_active(canvas)
{
	return !!canvas?.__crosshair_mouse_down
		|| !!canvas?.__crosshair_pointer_down
		|| get_global_pointer_down();
}

function is_node_hovered_by_pointer(canvas, node)
{
	if (!canvas || !node)
	{
		return false;
	}
	const pointer_down = !!canvas.__crosshair_pointer_down
		|| !!canvas.__crosshair_mouse_down
		|| get_global_pointer_down();
	if (!pointer_down)
	{
		return false;
	}
	const mouse = get_graph_mouse(canvas);
	if (!mouse)
	{
		return false;
	}
	return is_point_inside_bounds(mouse, get_node_bounds(node));
}

function has_connection_drag(canvas)
{
	if (!canvas)
	{
		return false;
	}
	const sources = [canvas];
	if (canvas.graph && canvas.graph !== canvas)
	{
		sources.push(canvas.graph);
	}
	if (canvas.graph?._graph && canvas.graph._graph !== canvas.graph)
	{
		sources.push(canvas.graph._graph);
	}
	for (const source of sources)
	{
		for (const key of CONNECTION_STATE_KEYS)
		{
			if (source[key])
			{
				return true;
			}
		}
	}
	return false;
}
function is_connection_handle_target(target)
{
	if (!target)
	{
		return false;
	}
	const element = target instanceof Element ? target : null;
	if (!element || typeof element.closest !== "function")
	{
		return false;
	}
	const selector = [
		".output",
		".node-output",
		".output-slot",
		".slot-output",
		".node-slot.output",
		".slot.output",
		".comfy-output",
		".lg-slot.output",
		".lg-slot-output",
		"[data-slot-type='output']",
		"[data-slot='output']",
		".input",
		".node-input",
		".input-slot",
		".slot-input",
		".node-slot.input",
		".slot.input",
		".comfy-input-slot",
		".lg-slot.input",
		".lg-slot-input",
		"[data-slot-type='input']",
		"[data-slot='input']"
	].join(", ");
	return !!element.closest(selector);
}

function is_pointer_near_output_slot(canvas, node, graph_point)
{
	if (!canvas || !node || !graph_point)
	{
		return false;
	}
	if (typeof node.getConnectionPos !== "function")
	{
		return false;
	}
	const outputs = Array.isArray(node.outputs) ? node.outputs : [];
	if (outputs.length === 0)
	{
		return false;
	}
	const scale = canvas?.ds?.scale;
	const safe_scale = Number.isFinite(scale) && scale > 0 ? scale : 1;
	const row_threshold = SLOT_ROW_HITBOX_PX / safe_scale;
	for (let index = 0; index < outputs.length; index += 1)
	{
		const slot = outputs[index];
		const label_text = get_slot_label_text(node, slot);
		const has_label_text = !!label_text;
		const handle_hitbox = (has_label_text ? SLOT_HANDLE_HITBOX_PX : SLOT_HANDLE_HITBOX_COMPACT_PX) / safe_scale;
		const threshold_sq = handle_hitbox * handle_hitbox;
		const position = node.getConnectionPos(false, index);
		if (!Array.isArray(position) || position.length < 2)
		{
			continue;
		}
		const dx = graph_point[0] - position[0];
		const dy = graph_point[1] - position[1];
		if ((dx * dx + dy * dy) <= threshold_sq)
		{
			return true;
		}
		if (!label_text)
		{
			continue;
		}
		const label_span = estimate_slot_label_span_px(label_text) / safe_scale;
		const label_edge_threshold = Math.min(label_span, SLOT_LABEL_EDGE_HITBOX_PX / safe_scale);
		const within_row = Math.abs(dy) <= row_threshold;
		const label_distance = position[0] - graph_point[0];
		const within_output_label = label_distance >= (-handle_hitbox)
			&& label_distance <= label_edge_threshold;
		if (within_row && within_output_label)
		{
			return true;
		}
	}
	return false;
}

function is_pointer_near_input_slot(canvas, node, graph_point)
{
	if (!canvas || !node || !graph_point)
	{
		return false;
	}
	if (typeof node.getConnectionPos !== "function")
	{
		return false;
	}
	const inputs = Array.isArray(node.inputs) ? node.inputs : [];
	if (inputs.length === 0)
	{
		return false;
	}
	const scale = canvas?.ds?.scale;
	const safe_scale = Number.isFinite(scale) && scale > 0 ? scale : 1;
	const row_threshold = SLOT_ROW_HITBOX_PX / safe_scale;
	for (let index = 0; index < inputs.length; index += 1)
	{
		const slot = inputs[index];
		const label_text = get_slot_label_text(node, slot);
		const has_label_text = !!label_text;
		const handle_hitbox = (has_label_text ? SLOT_HANDLE_HITBOX_PX : SLOT_HANDLE_HITBOX_COMPACT_PX) / safe_scale;
		const threshold_sq = handle_hitbox * handle_hitbox;
		const position = node.getConnectionPos(true, index);
		if (!Array.isArray(position) || position.length < 2)
		{
			continue;
		}
		const dx = graph_point[0] - position[0];
		const dy = graph_point[1] - position[1];
		if ((dx * dx + dy * dy) <= threshold_sq)
		{
			return true;
		}
		if (!label_text)
		{
			continue;
		}
		const label_span = estimate_slot_label_span_px(label_text) / safe_scale;
		const label_edge_threshold = Math.min(label_span, SLOT_LABEL_EDGE_HITBOX_PX / safe_scale);
		const within_row = Math.abs(dy) <= row_threshold;
		const label_distance = graph_point[0] - position[0];
		const within_input_label = label_distance >= (-handle_hitbox)
			&& label_distance <= label_edge_threshold;
		if (within_row && within_input_label)
		{
			return true;
		}
	}
	return false;
}

function is_node_collapsed_for_slots(node)
{
	if (!node || typeof node !== "object")
	{
		return false;
	}
	return !!(node.flags?.collapsed || node.collapsed || node._collapsed);
}

function get_slot_label_text(node, slot)
{
	if (!slot || is_node_collapsed_for_slots(node))
	{
		return "";
	}
	const label = typeof slot.label === "string" ? slot.label.trim() : "";
	if (label)
	{
		return label;
	}
	const name = typeof slot.name === "string" ? slot.name.trim() : "";
	if (name)
	{
		return name;
	}
	return "";
}

function estimate_slot_label_span_px(text)
{
	if (!text)
	{
		return 0;
	}
	let width = 0;
	for (const ch of text)
	{
		if (/\s/.test(ch))
		{
			width += 4;
			continue;
		}
		if (/[A-Z]/.test(ch))
		{
			width += 8.5;
			continue;
		}
		if (/[a-z0-9]/.test(ch))
		{
			width += 7.25;
			continue;
		}
		width += 10.5;
	}
	const padded = width + 16;
	return Math.min(160, Math.max(SLOT_LABEL_HITBOX_PX, padded));
}

function is_pointer_near_connection_slot(canvas, node, graph_point)
{
	return is_pointer_near_output_slot(canvas, node, graph_point)
		|| is_pointer_near_input_slot(canvas, node, graph_point);
}

function get_node_near_connection_slot(canvas, graph_point)
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
		if (is_pointer_near_connection_slot(canvas, node, graph_point))
		{
			return node;
		}
	}
	return null;
}

function record_pointer_activity(canvas)
{
	if (!canvas)
	{
		return;
	}
	canvas.__crosshair_pointer_last_time = Date.now();
}

function set_pointer_down(canvas, is_down, point)
{
	if (!canvas)
	{
		return;
	}
	canvas.__crosshair_pointer_down = is_down;
	if (is_down)
	{
		canvas.__crosshair_active_target = null;
		canvas.__crosshair_force_hide_until = 0;
		canvas.__crosshair_pointer_dragging = false;
		canvas.__crosshair_dragging = false;
		canvas.__crosshair_last_node_states = new Map();
		canvas.__crosshair_last_group_states = new Map();
		canvas.__crosshair_activity_last_time = 0;
		canvas.__crosshair_activity_last_result = null;
		canvas.__crosshair_hide_active_outline = false;
		canvas.__crosshair_interaction_active = false;
		canvas.__crosshair_node_opacity_exempt_node_ids = null;
		canvas.__crosshair_node_opacity_exempt_group_ids = null;
		canvas.__crosshair_node_opacity_exempt_bounds = null;
		canvas.__crosshair_node_resize_session_target = null;
		canvas.__crosshair_node_resize_session_corner = null;
		if (point)
		{
			canvas.__crosshair_pointer_down_pos = point;
		}
	}
	else
	{
		canvas.__crosshair_mouse_down = false;
		canvas.__crosshair_dragging = false;
		canvas.__crosshair_pointer_down_pos = null;
		canvas.__crosshair_pointer_dragging = false;
		canvas.__crosshair_pointer_on_input = false;
		canvas.__crosshair_pointer_on_connection = false;
		canvas.__crosshair_pointer_node = null;
		canvas.__crosshair_latched_pointer_node = null;
		canvas.__crosshair_group_resize_latched = false;
		canvas.__crosshair_group_resize_target = null;
		canvas.__crosshair_node_resize_latched = false;
		canvas.__crosshair_node_resize_target = null;
		canvas.__crosshair_node_resize_corner = null;
		canvas.__crosshair_node_resize_session_target = null;
		canvas.__crosshair_node_resize_session_corner = null;
		canvas.__crosshair_drag_node_target = null;
		canvas.__crosshair_drag_group_target = null;
		canvas.__crosshair_drag_start_on_selected = false;
		canvas.__crosshair_multi_select_modifier_down = false;
		canvas.__crosshair_drag_start = null;
		canvas.__crosshair_node_opacity_active = false;
		canvas.__crosshair_node_opacity_multiplier = 1;
		canvas.__crosshair_node_opacity_exempt_nodes = null;
		canvas.__crosshair_node_opacity_exempt_groups = null;
		canvas.__crosshair_node_opacity_exempt_node_ids = null;
		canvas.__crosshair_node_opacity_exempt_group_ids = null;
		canvas.__crosshair_node_opacity_exempt_bounds = null;
		canvas.__crosshair_last_active_node = null;
		canvas.__crosshair_last_active_group = null;
		canvas.__crosshair_hide_active_outline = false;
		canvas.__crosshair_interaction_active = false;
		canvas.__crosshair_force_hide_until = Date.now() + FORCE_HIDE_AFTER_RELEASE_MS;
		request_canvas_redraw(canvas);
	}
	record_pointer_activity(canvas);
}

function clear_interaction_visuals(canvas, ctx)
{
	if (!canvas)
	{
		return { can_draw: false };
	}
	clear_opacity_state(canvas, ctx, OPACITY_KEYS.links);
	clear_opacity_state(canvas, ctx, OPACITY_KEYS.nodes);
	canvas.__crosshair_node_opacity_active = false;
	canvas.__crosshair_node_opacity_multiplier = 1;
	canvas.__crosshair_node_opacity_exempt_nodes = null;
	canvas.__crosshair_node_opacity_exempt_groups = null;
	canvas.__crosshair_node_opacity_exempt_node_ids = null;
	canvas.__crosshair_node_opacity_exempt_group_ids = null;
	canvas.__crosshair_node_opacity_exempt_bounds = null;
	canvas.__crosshair_interaction_active = false;
	canvas.__crosshair_hide_active_outline = false;
	apply_dom_node_opacity(canvas);
	apply_dom_outline_visibility(canvas);
	return { can_draw: false };
}

function reset_interaction_state(canvas)
{
	if (!canvas)
	{
		return;
	}
	canvas.__crosshair_mouse_down = false;
	canvas.__crosshair_dragging = false;
	canvas.__crosshair_last_mouse = null;
	canvas.__crosshair_last_mouse_screen = null;
	canvas.__crosshair_last_mouse_graph = null;
	canvas.__crosshair_drag_start = null;
	canvas.__crosshair_group_resize_latched = false;
	canvas.__crosshair_group_resize_target = null;
	set_pointer_down(canvas, false);
	clear_interaction_visuals(canvas);
	request_canvas_redraw(canvas);
}

function update_pointer_dragging(canvas, threshold)
{
	if (!canvas?.__crosshair_pointer_down)
	{
		return false;
	}
	const start = canvas.__crosshair_pointer_down_pos;
	const current = canvas.__crosshair_last_mouse_screen || canvas.__crosshair_last_mouse;
	if (!start || !current)
	{
		return false;
	}
	const dx = current[0] - start[0];
	const dy = current[1] - start[1];
	const distance = Math.sqrt((dx * dx) + (dy * dy));
	if (distance >= threshold)
	{
		canvas.__crosshair_pointer_dragging = true;
		return true;
	}
	return false;
}

function is_graph_event_target(event)
{
	if (!event)
	{
		return false;
	}
	const target = event.target;
	if (!target || typeof target.closest !== "function")
	{
		return false;
	}
	for (const selector of GRAPH_EVENT_SELECTORS)
	{
		if (selector && target.closest(selector))
		{
			return true;
		}
	}
	return false;
}

function get_global_pointer_down()
{
	if (typeof window === "undefined")
	{
		return false;
	}
	return !!window.__crosshair_global_pointer_down;
}

function get_global_pointer_on_input()
{
	if (typeof window === "undefined")
	{
		return false;
	}
	return !!window.__crosshair_global_pointer_on_input;
}

function get_global_pointer_on_connection()
{
	if (typeof window === "undefined")
	{
		return false;
	}
	return !!window.__crosshair_global_pointer_on_connection;
}

function is_multi_select_modifier_event(event)
{
	return !!(event?.ctrlKey || event?.metaKey);
}

function update_multi_select_modifier(canvas, event)
{
	const modifier_active = is_multi_select_modifier_event(event);
	if (canvas)
	{
		canvas.__crosshair_multi_select_modifier_down = modifier_active;
	}
	if (typeof window !== "undefined")
	{
		window.__crosshair_multi_select_modifier_down = modifier_active;
	}
	return modifier_active;
}

function is_multi_select_modifier_active(canvas)
{
	if (canvas?.__crosshair_multi_select_modifier_down)
	{
		return true;
	}
	if (typeof window === "undefined")
	{
		return false;
	}
	return !!window.__crosshair_multi_select_modifier_down;
}

function install_global_pointer_listeners(canvas)
{
	if (typeof window === "undefined")
	{
		return;
	}
	if (window.__crosshair_global_pointer_listeners_installed)
	{
		return;
	}
	const get_entries = () =>
	{
		const canvases = window.__crosshair_guidelines_canvases;
		if (canvases instanceof Set)
		{
			return Array.from(canvases);
		}
		return canvas ? [canvas] : [];
	};
	const on_global_down = (event) =>
	{
		if (event?.button !== undefined && event.button !== 0)
		{
			return;
		}
		update_multi_select_modifier(null, event);
		if (is_interactive_input_target(event?.target))
		{
			window.__crosshair_global_pointer_on_input = true;
			return;
		}
		if (is_connection_handle_target(event?.target))
		{
			window.__crosshair_global_pointer_on_connection = true;
			return;
		}
		if (!is_graph_event_target(event))
		{
			return;
		}
		window.__crosshair_global_pointer_down = true;
		window.__crosshair_global_pointer_on_input = false;
		window.__crosshair_global_pointer_on_connection = false;
		const entries = get_entries();
		const matches = [];
		const target = event?.target;
		for (const entry of entries)
		{
			if (!entry)
			{
				continue;
			}
			entry.__crosshair_active_target = null;
			entry.__crosshair_last_node_states = new Map();
			entry.__crosshair_last_group_states = new Map();
			entry.__crosshair_drag_node_target = null;
			entry.__crosshair_drag_group_target = null;
			entry.__crosshair_node_resize_latched = false;
			entry.__crosshair_node_resize_target = null;
			entry.__crosshair_node_resize_corner = null;
			entry.__crosshair_node_resize_session_target = null;
			entry.__crosshair_node_resize_session_corner = null;
			entry.__crosshair_multi_select_modifier_down = is_multi_select_modifier_event(event);
			if (target && target instanceof Element)
			{
				const element = get_canvas_element(entry);
				const container = entry.__crosshair_dom_cache?.container || get_graph_container(entry);
				if ((element && element.contains(target)) || (container && container.contains(target)))
				{
					matches.push(entry);
				}
			}
		}
		const target_entries = matches.length ? matches : entries;
		for (const entry of target_entries)
		{
			if (!entry)
			{
				continue;
			}
			const screen_point = get_event_screen_point(event, entry);
			entry.__crosshair_pointer_on_input = false;
			entry.__crosshair_pointer_on_connection = false;
			const graph_point = screen_point ? screen_point_to_graph(entry, screen_point) : null;
			const near_connection_node = graph_point ? get_node_near_connection_slot(entry, graph_point) : null;
			entry.__crosshair_pointer_node = screen_point
				? (get_node_at_screen_point(entry, screen_point)
					|| (graph_point ? get_node_at_graph_point(entry, graph_point) : null)
					|| near_connection_node)
				: ((graph_point ? get_node_at_graph_point(entry, graph_point) : null) || near_connection_node);
			if (entry.__crosshair_pointer_node)
			{
				entry.__crosshair_latched_pointer_node = entry.__crosshair_pointer_node;
			}
			if (!entry.__crosshair_pointer_on_connection && graph_point && (entry.__crosshair_pointer_node || near_connection_node))
			{
				const slot_node = entry.__crosshair_pointer_node || near_connection_node;
				entry.__crosshair_pointer_on_connection = is_pointer_near_connection_slot(entry, slot_node, graph_point);
			}
			if (!entry.__crosshair_pointer_on_connection && has_connection_drag(entry))
			{
				entry.__crosshair_pointer_on_connection = true;
			}
			const resize_candidates = collect_resize_candidates(entry);
			latch_node_resize_candidate(entry, resize_candidates, graph_point, screen_point);
			if (screen_point)
			{
				entry.__crosshair_last_mouse = screen_point;
				entry.__crosshair_last_mouse_screen = screen_point;
				entry.__crosshair_drag_start = screen_point;
			}
			if (graph_point)
			{
				entry.__crosshair_last_mouse_graph = graph_point;
			}
			set_pointer_down(entry, true, screen_point);
			record_pointer_activity(entry);
		}
	};
	const on_global_move = (event) =>
	{
		if (!window.__crosshair_global_pointer_down)
		{
			return;
		}
		update_multi_select_modifier(null, event);
		const canvases = window.__crosshair_guidelines_canvases;
		if (canvases instanceof Set)
		{
			for (const entry of canvases)
			{
				if (!entry || !entry.__crosshair_pointer_down)
				{
					continue;
				}
				entry.__crosshair_multi_select_modifier_down = is_multi_select_modifier_event(event);
				const screen_point = get_event_screen_point(event, entry);
				if (!screen_point)
				{
					continue;
				}
				entry.__crosshair_last_mouse = screen_point;
				entry.__crosshair_last_mouse_screen = screen_point;
				if (!entry.__crosshair_pointer_down_pos)
				{
					entry.__crosshair_pointer_down_pos = screen_point;
					entry.__crosshair_drag_start = screen_point;
				}
				const graph_point = screen_point_to_graph(entry, screen_point);
				if (graph_point)
				{
					entry.__crosshair_last_mouse_graph = graph_point;
				}
				update_pointer_dragging(entry, DRAG_THRESHOLD_PX);
				record_pointer_activity(entry);
			}
			return;
		}
		if (canvas && canvas.__crosshair_pointer_down)
		{
			canvas.__crosshair_multi_select_modifier_down = is_multi_select_modifier_event(event);
			const screen_point = get_event_screen_point(event, canvas);
			if (!screen_point)
			{
				return;
			}
			canvas.__crosshair_last_mouse = screen_point;
			canvas.__crosshair_last_mouse_screen = screen_point;
			if (!canvas.__crosshair_pointer_down_pos)
			{
				canvas.__crosshair_pointer_down_pos = screen_point;
				canvas.__crosshair_drag_start = screen_point;
			}
			const graph_point = screen_point_to_graph(canvas, screen_point);
			if (graph_point)
			{
				canvas.__crosshair_last_mouse_graph = graph_point;
			}
			update_pointer_dragging(canvas, DRAG_THRESHOLD_PX);
			record_pointer_activity(canvas);
		}
	};
	const reset = () =>
	{
		const canvases = window.__crosshair_guidelines_canvases;
		if (canvases instanceof Set)
		{
			for (const entry of canvases)
			{
				reset_interaction_state(entry);
			}
			window.__crosshair_global_pointer_down = false;
			window.__crosshair_global_pointer_on_input = false;
			window.__crosshair_global_pointer_on_connection = false;
			return;
		}
		reset_interaction_state(canvas);
		window.__crosshair_global_pointer_down = false;
		window.__crosshair_global_pointer_on_input = false;
		window.__crosshair_global_pointer_on_connection = false;
	};
	const on_key_down = (event) =>
	{
		if (event?.key === "Control" || event?.key === "Meta")
		{
			window.__crosshair_multi_select_modifier_down = true;
		}
	};
	const on_key_up = (event) =>
	{
		if (event?.key === "Control" || event?.key === "Meta")
		{
			window.__crosshair_multi_select_modifier_down = false;
			const canvases = window.__crosshair_guidelines_canvases;
			if (canvases instanceof Set)
			{
				for (const entry of canvases)
				{
					if (entry)
					{
						entry.__crosshair_multi_select_modifier_down = false;
					}
				}
			}
		}
	};
	const on_window_blur = () =>
	{
		reset();
		window.__crosshair_multi_select_modifier_down = false;
	};
	window.addEventListener("pointerdown", on_global_down, { passive: true, capture: true });
	window.addEventListener("mousedown", on_global_down, { passive: true, capture: true });
	window.addEventListener("pointermove", on_global_move, { passive: true, capture: true });
	window.addEventListener("mousemove", on_global_move, { passive: true, capture: true });
	window.addEventListener("pointerup", reset, { passive: true, capture: true });
	window.addEventListener("mouseup", reset, { passive: true, capture: true });
	window.addEventListener("keydown", on_key_down, { passive: true, capture: true });
	window.addEventListener("keyup", on_key_up, { passive: true, capture: true });
	window.addEventListener("blur", on_window_blur, { passive: true });
	window.__crosshair_global_pointer_listeners_installed = true;
}

function register_canvas(canvas)
{
	if (typeof window === "undefined" || !canvas)
	{
		return;
	}
	if (!window.__crosshair_guidelines_canvases)
	{
		window.__crosshair_guidelines_canvases = new Set();
	}
	window.__crosshair_guidelines_canvases.add(canvas);
}

function install_canvas_watch()
{
	if (typeof window === "undefined")
	{
		return;
	}
	if (window.__crosshair_canvas_watch_installed)
	{
		return;
	}
	const tick = () =>
	{
		if (app?.canvas)
		{
			install_guidelines(app.canvas);
		}
		if (app?.graph?.canvas)
		{
			install_guidelines(app.graph.canvas);
		}
		if (app?.graph?._canvas)
		{
			install_guidelines(app.graph._canvas);
		}
		requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);
	window.__crosshair_canvas_watch_installed = true;
}

function install_pointer_listeners(canvas)
{
	if (!canvas || canvas.__crosshair_pointer_listeners_installed)
	{
		return;
	}
	const element = get_canvas_element(canvas);
	if (!element)
	{
		return;
	}

	const on_pointer_down = (event) =>
	{
		if (event?.button !== undefined && event.button !== 0)
		{
			return;
		}
		update_multi_select_modifier(canvas, event);
		canvas.__crosshair_pointer_on_input = is_interactive_input_target(event?.target);
		canvas.__crosshair_pointer_on_connection = is_connection_handle_target(event?.target);
		const screen_point = get_event_screen_point(event, canvas, true);
		const graph_point = get_event_graph_point(canvas, event)
			|| screen_point_to_graph(canvas, screen_point)
			|| get_graph_mouse(canvas);
		const near_connection_node = graph_point ? get_node_near_connection_slot(canvas, graph_point) : null;
		canvas.__crosshair_pointer_node = screen_point
			? (get_node_at_screen_point(canvas, screen_point)
				|| (graph_point ? get_node_at_graph_point(canvas, graph_point) : null)
				|| near_connection_node)
			: ((graph_point ? get_node_at_graph_point(canvas, graph_point) : null) || near_connection_node);
		if (canvas.__crosshair_pointer_node
			&& !canvas.__crosshair_pointer_on_input
			&& !canvas.__crosshair_pointer_on_connection)
		{
			canvas.__crosshair_latched_pointer_node = canvas.__crosshair_pointer_node;
		}
		if (!canvas.__crosshair_pointer_on_connection && graph_point && (canvas.__crosshair_pointer_node || near_connection_node))
		{
			const slot_node = canvas.__crosshair_pointer_node || near_connection_node;
			canvas.__crosshair_pointer_on_connection = is_pointer_near_connection_slot(canvas, slot_node, graph_point);
		}
		if (!canvas.__crosshair_pointer_on_connection && has_connection_drag(canvas))
		{
			canvas.__crosshair_pointer_on_connection = true;
		}
		if (screen_point)
		{
			canvas.__crosshair_last_mouse = screen_point;
			canvas.__crosshair_last_mouse_screen = screen_point;
			canvas.__crosshair_drag_start = screen_point;
			canvas.__crosshair_pointer_down_pos = screen_point;
		}
		if (graph_point)
		{
			canvas.__crosshair_last_mouse_graph = graph_point;
		}
		const resize_candidates = collect_resize_candidates(canvas);
		latch_node_resize_candidate(canvas, resize_candidates, graph_point, screen_point);
		canvas.__crosshair_drag_node_target = get_drag_node_target(canvas, screen_point, graph_point);
		const selected_nodes = get_selected_nodes(canvas).filter((node) => !!node);
		const selected_group = get_selected_group(canvas);
		canvas.__crosshair_drag_start_on_selected = !!screen_point
			&& selected_nodes.some((node) => is_screen_point_inside_node(canvas, node, screen_point));
		const drag_start_on_group = !!screen_point
			&& !!selected_group
			&& is_screen_point_inside_group(canvas, selected_group, screen_point);
		canvas.__crosshair_drag_group_target = drag_start_on_group ? selected_group : null;
		canvas.__crosshair_group_resize_latched = !!(selected_group && is_point_near_bottom_right(canvas, get_group_bounds(selected_group)));
		canvas.__crosshair_group_resize_target = canvas.__crosshair_group_resize_latched ? selected_group : null;
		set_pointer_down(canvas, true, screen_point);
	};

	const on_pointer_up = () =>
	{
		canvas.__crosshair_multi_select_modifier_down = false;
		reset_interaction_state(canvas);
	};

	const on_pointer_cancel = () =>
	{
		canvas.__crosshair_multi_select_modifier_down = false;
		reset_interaction_state(canvas);
	};

	const on_pointer_move = (event) =>
	{
		update_multi_select_modifier(canvas, event);
		const screen_point = get_event_screen_point(event, canvas, true);
		const graph_point = get_event_graph_point(canvas, event)
			|| screen_point_to_graph(canvas, screen_point)
			|| get_graph_mouse(canvas);
		if (screen_point)
		{
			canvas.__crosshair_last_mouse = screen_point;
			canvas.__crosshair_last_mouse_screen = screen_point;
			if (!canvas.__crosshair_pointer_down_pos)
			{
				canvas.__crosshair_pointer_down_pos = screen_point;
			}
		}
		if (graph_point)
		{
			canvas.__crosshair_last_mouse_graph = graph_point;
		}
		if (typeof event?.buttons === "number" && event.buttons === 0)
		{
			reset_interaction_state(canvas);
			return;
		}
		update_pointer_dragging(canvas, DRAG_THRESHOLD_PX);
		record_pointer_activity(canvas);
	};

	const on_pointer_leave = () =>
	{
		reset_interaction_state(canvas);
	};

	if (typeof window !== "undefined" && window.PointerEvent)
	{
		element.addEventListener("pointerdown", on_pointer_down, { passive: true });
		element.addEventListener("pointerup", on_pointer_up, { passive: true });
		element.addEventListener("pointercancel", on_pointer_cancel, { passive: true });
		element.addEventListener("pointermove", on_pointer_move, { passive: true });
		element.addEventListener("pointerleave", on_pointer_leave, { passive: true });
	}
	else
	{
		element.addEventListener("mousedown", on_pointer_down, { passive: true });
		element.addEventListener("mouseup", on_pointer_up, { passive: true });
		element.addEventListener("mousemove", on_pointer_move, { passive: true });
		element.addEventListener("mouseleave", on_pointer_leave, { passive: true });
	}

	canvas.__crosshair_pointer_listeners_installed = true;
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

function get_corner_point(bounds, corner)
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

function get_active_resize_corner(canvas, bounds)
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

function is_point_near_bottom_right(canvas, bounds)
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

function get_graph_nodes(canvas)
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

function get_graph_groups(canvas)
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

function get_bounds_state(bounds)
{
	if (!bounds)
	{
		return null;
	}
	const width = bounds.right - bounds.left;
	const height = bounds.bottom - bounds.top;
	return {
		left: bounds.left,
		top: bounds.top,
		right: bounds.right,
		bottom: bounds.bottom,
		width,
		height
	};
}

function get_node_activity_state(node)
{
	return get_bounds_state(get_node_box_bounds(node));
}

function get_group_activity_state(group)
{
	return get_bounds_state(get_group_bounds(group));
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

function detect_graph_activity(canvas)
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

function get_node_at_graph_point(canvas, graph_point)
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

function is_screen_point_inside_bounds(canvas, screen_point, bounds)
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

function get_node_at_screen_point(canvas, screen_point)
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

function is_screen_point_inside_node(canvas, node, screen_point)
{
	if (!node)
	{
		return false;
	}
	return is_screen_point_inside_bounds(canvas, screen_point, get_node_bounds(node));
}

function is_screen_point_inside_group(canvas, group, screen_point)
{
	if (!group)
	{
		return false;
	}
	return is_screen_point_inside_bounds(canvas, screen_point, get_group_bounds(group));
}

function get_drag_node_target(canvas, screen_point, graph_point)
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

function graph_point_to_screen(canvas, point)
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

function screen_point_to_graph(canvas, point)
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

function get_closest_corner_by_screen(canvas, bounds, screen_point)
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

function collect_resize_candidates(canvas)
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

function latch_node_resize_candidate(canvas, nodes, graph_point, screen_point)
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

function request_canvas_redraw(target_canvas)
{
	const canvas = target_canvas || app?.canvas;
	if (canvas?.graph && typeof canvas.graph.setDirtyCanvas === "function")
	{
		canvas.graph.setDirtyCanvas(true, true);
		return;
	}
	if (canvas && typeof canvas.setDirty === "function")
	{
		canvas.setDirty(true, true);
		return;
	}
	if (app?.graph && typeof app.graph.setDirtyCanvas === "function")
	{
		app.graph.setDirtyCanvas(true, true);
		return;
	}
	if (app?.canvas && typeof app.canvas.setDirty === "function")
	{
		app.canvas.setDirty(true, true);
	}
}

function resolve_ctx_from_args(args)
{
	if (!args)
	{
		return null;
	}
	for (const arg of args)
	{
		if (arg && typeof arg.save === "function")
		{
			return arg;
		}
	}
	return null;
}

function set_ctx_canvas_ref(canvas)
{
	if (!canvas?.ctx || canvas.ctx.__crosshair_canvas_ref)
	{
		return;
	}
	canvas.ctx.__crosshair_canvas_ref = canvas;
}

function get_canvas_from_context_or_node(ctx, node)
{
	if (ctx?.__crosshair_canvas_ref)
	{
		return ctx.__crosshair_canvas_ref;
	}
	const graph = node?.graph;
	if (graph?.canvas)
	{
		return graph.canvas;
	}
	if (graph?._canvas)
	{
		return graph._canvas;
	}
	if (app?.canvas)
	{
		return app.canvas;
	}
	return null;
}

function install_link_draw_override(canvas)
{
	if (!canvas)
	{
		return;
	}

	install_link_opacity_ctx_patch(canvas);
	set_ctx_canvas_ref(canvas);

	const get_link_draw_method_names = (target_list) =>
	{
		const names = new Set();
		const should_wrap = (name, descriptor) =>
		{
			if (!descriptor || typeof descriptor.value !== "function")
			{
				return false;
			}
			const lower = String(name).toLowerCase();
			return lower.includes("link") || lower.includes("connection") || lower.includes("edge");
		};

		for (const target of target_list)
		{
			if (!target)
			{
				continue;
			}
			const descriptors = Object.getOwnPropertyDescriptors(target);
			for (const name of Object.keys(descriptors))
			{
				if (should_wrap(name, descriptors[name]))
				{
					names.add(name);
				}
			}
		}

		const fallback = [
			"drawConnections",
			"drawLinks",
			"drawNodeLinks",
			"drawNodeConnections",
			"drawLink",
			"drawConnection",
			"drawAllLinks",
			"drawAllConnections"
		];
		for (const name of fallback)
		{
			names.add(name);
		}

		return Array.from(names);
	};

	const resolve_ctx = (instance, args) =>
	{
		if (args && args.length > 0 && args[0] && typeof args[0].save === "function")
		{
			return args[0];
		}
		if (instance?.ctx && typeof instance.ctx.save === "function")
		{
			return instance.ctx;
		}
		return null;
	};

	const wrap = (target, method_name) =>
	{
		if (!target)
		{
			return false;
		}
		const descriptor = Object.getOwnPropertyDescriptor(target, method_name);
		if (!descriptor || typeof descriptor.value !== "function")
		{
			return false;
		}
		const original = descriptor.value;
		if (typeof original !== "function")
		{
			return false;
		}
		if (original.__crosshair_links_wrapper)
		{
			return true;
		}
		const wrapped = function()
		{
			const multiplier = Number.isFinite(this.__crosshair_links_current_opacity)
				? this.__crosshair_links_current_opacity
				: 1;
			const ctx = resolve_ctx(this, arguments);
			if (ctx)
			{
				install_link_opacity_ctx_patch(ctx);
			}
			if (!ctx || multiplier >= 0.999)
			{
				return original.apply(this, arguments);
			}
			const previous_active = ctx.__crosshair_links_opacity_active;
			const previous_multiplier = ctx.__crosshair_links_opacity_multiplier;
			ctx.__crosshair_links_opacity_active = true;
			ctx.__crosshair_links_opacity_multiplier = multiplier;
			try
			{
				return original.apply(this, arguments);
			}
			finally
			{
				ctx.__crosshair_links_opacity_active = previous_active;
				ctx.__crosshair_links_opacity_multiplier = previous_multiplier;
			}
		};
		wrapped.__crosshair_links_wrapper = true;
		try
		{
			Object.defineProperty(target, method_name, {
				configurable: descriptor.configurable,
				enumerable: descriptor.enumerable,
				writable: true,
				value: wrapped
			});
		}
		catch (err)
		{
			return false;
		}
		return true;
	};

	const targets = [];
	targets.push(canvas);
	const canvas_proto = Object.getPrototypeOf(canvas);
	if (canvas_proto)
	{
		targets.push(canvas_proto);
	}
	const litegraph_proto = window.LiteGraph?.LGraphCanvas?.prototype;
	if (litegraph_proto && litegraph_proto !== canvas_proto)
	{
		targets.push(litegraph_proto);
	}
	const fallback_proto = window.LGraphCanvas?.prototype;
	if (fallback_proto && fallback_proto !== canvas_proto && fallback_proto !== litegraph_proto)
	{
		targets.push(fallback_proto);
	}

	let installed = false;
	const methods = get_link_draw_method_names(targets);
	for (const target of targets)
	{
		for (const method of methods)
		{
			installed = wrap(target, method) || installed;
		}
	}
	if (installed)
	{
		canvas.__crosshair_links_draw_override_installed = true;
	}
}

function install_node_instance_draw_override()
{
	const prototypes = [];
	const litegraph_proto = window.LiteGraph?.LGraphNode?.prototype;
	const fallback_proto = window.LGraphNode?.prototype;
	if (litegraph_proto)
	{
		prototypes.push(litegraph_proto);
	}
	if (fallback_proto && fallback_proto !== litegraph_proto)
	{
		prototypes.push(fallback_proto);
	}
	if (prototypes.length === 0)
	{
		return;
	}
	const method_names = [
		"draw",
		"drawCollapsed",
		"drawConnections",
		"drawConnection",
		"drawSlots",
		"drawSockets",
		"drawInputs",
		"drawOutputs",
		"onDrawForeground",
		"onDrawBackground",
		"onDraw"
	];
	const wrap_proto = (node_proto) =>
	{
		if (!node_proto || node_proto.__crosshair_node_instance_draw_installed)
		{
			return;
		}
		for (const method_name of method_names)
		{
			const original = node_proto[method_name];
			if (typeof original !== "function" || original.__crosshair_node_opacity_wrapper)
			{
				continue;
			}
			const wrapped = function()
			{
				const ctx = resolve_ctx_from_args(arguments);
				if (!ctx)
				{
					return original.apply(this, arguments);
				}
				install_link_opacity_ctx_patch(ctx);
				const canvas = get_canvas_from_context_or_node(ctx, this);
				if (canvas && !ctx.__crosshair_canvas_ref)
				{
					ctx.__crosshair_canvas_ref = canvas;
				}
				if (canvas)
				{
					ensure_interaction_state(canvas, ctx);
				}
				const exempt_nodes = canvas?.__crosshair_node_opacity_exempt_nodes;
				const exempt_node_ids = canvas?.__crosshair_node_opacity_exempt_node_ids;
				const node_id = exempt_node_ids ? get_node_identifier(this) : null;
				const active_target = canvas?.__crosshair_active_target;
				const is_active_node = !!active_target
					&& (active_target.drag_node_target === this || active_target.resize_node_candidate === this);
				const fallback_drag_node = get_canvas_drag_node(canvas);
				const fallback_resize_node = get_canvas_resize_node(canvas);
				const pointer_node = canvas?.__crosshair_pointer_node;
				const is_pointer_node = !!pointer_node && pointer_node === this;
				const is_hovered_node = is_node_hovered_by_pointer(canvas, this);
				const is_key_active_node = !!this
					&& (this === fallback_drag_node || this === fallback_resize_node);
				const active_node = get_active_node_from_canvas(canvas);
				const is_canvas_active_node = !!active_node && active_node === this;
				const selected_node = is_node_selected(this);
				const has_pointer_down = is_pointer_down_active(canvas);
				const should_exempt_selected = selected_node
					&& (is_interaction_active(canvas) || has_pointer_down);
				const should_hide_outline = !!canvas
					&& hide_active_outline
					&& canvas.__crosshair_hide_active_outline
					&& (selected_node || is_active_node || is_canvas_active_node || is_key_active_node || is_pointer_node || is_hovered_node);
				const previous_selected = should_hide_outline ? this.selected : null;
				const previous_is_selected = should_hide_outline ? this.is_selected : null;
				const previous_isSelected = should_hide_outline ? this.isSelected : null;
				if (should_hide_outline)
				{
					this.selected = false;
					this.is_selected = false;
					this.isSelected = false;
				}

				const should_exempt = (exempt_nodes instanceof Set && exempt_nodes.has(this))
					|| (node_id && exempt_node_ids?.has(node_id))
					|| is_active_node
					|| is_canvas_active_node
					|| is_key_active_node
					|| is_pointer_node
					|| is_hovered_node
					|| should_exempt_selected;

				// Save previous ctx flag state
				const prev_ctx_exempt = ctx.__crosshair_node_opacity_ctx_exempt;
				const prev_drawing_node = ctx.__crosshair_drawing_node;

				// Track which node is currently being drawn (for fallback exemption check in ctx patch)
				// Only set if not already set by higher-level wrapper
				const did_set_drawing_node = !prev_drawing_node;
				if (did_set_drawing_node)
				{
					ctx.__crosshair_drawing_node = this;
				}

				// CRITICAL: Only set exempt=true, never set it to false
				// This preserves exempt=true set by higher-level wrappers (like drawNode)
				const did_set_exempt = should_exempt && !prev_ctx_exempt;
				if (did_set_exempt)
				{
					ctx.__crosshair_node_opacity_ctx_exempt = true;
				}

				try
				{
					return original.apply(this, arguments);
				}
				finally
				{
					// Only restore if we changed it
					if (did_set_exempt)
					{
						ctx.__crosshair_node_opacity_ctx_exempt = prev_ctx_exempt;
					}
					if (did_set_drawing_node)
					{
						ctx.__crosshair_drawing_node = prev_drawing_node;
					}
					if (should_hide_outline)
					{
						this.selected = previous_selected;
						this.is_selected = previous_is_selected;
						this.isSelected = previous_isSelected;
					}
				}
			};
			wrapped.__crosshair_node_opacity_wrapper = true;
			try
			{
				node_proto[method_name] = wrapped;
			}
			catch (err)
			{
			}
		}
		node_proto.__crosshair_node_instance_draw_installed = true;
	};

	for (const node_proto of prototypes)
	{
		wrap_proto(node_proto);
	}
}

function install_group_instance_draw_override()
{
	const prototypes = [];
	const litegraph_proto = window.LiteGraph?.LGraphGroup?.prototype;
	const fallback_proto = window.LGraphGroup?.prototype;
	if (litegraph_proto)
	{
		prototypes.push(litegraph_proto);
	}
	if (fallback_proto && fallback_proto !== litegraph_proto)
	{
		prototypes.push(fallback_proto);
	}
	if (prototypes.length === 0)
	{
		return;
	}
	const method_names = [
		"draw",
		"onDrawForeground",
		"onDrawBackground"
	];
	const wrap_proto = (group_proto) =>
	{
		if (!group_proto || group_proto.__crosshair_group_instance_draw_installed)
		{
			return;
		}
		for (const method_name of method_names)
		{
			const original = group_proto[method_name];
			if (typeof original !== "function" || original.__crosshair_group_opacity_wrapper)
			{
				continue;
			}
			const wrapped = function()
			{
				const ctx = resolve_ctx_from_args(arguments);
				if (!ctx)
				{
					return original.apply(this, arguments);
				}
				install_link_opacity_ctx_patch(ctx);
				const canvas = get_canvas_from_context_or_node(ctx, this);
				if (canvas && !ctx.__crosshair_canvas_ref)
				{
					ctx.__crosshair_canvas_ref = canvas;
				}
				if (canvas)
				{
					ensure_interaction_state(canvas, ctx);
				}
				const exempt_groups = canvas?.__crosshair_node_opacity_exempt_groups;
				const exempt_group_ids = canvas?.__crosshair_node_opacity_exempt_group_ids;
				const group_id = exempt_group_ids ? get_group_identifier(this) : null;
				const active_target = canvas?.__crosshair_active_target;
				const is_active_group = !!active_target
					&& (active_target.active_resize_group === this || active_target.drag_group === this);
				const active_group = get_active_group_from_canvas(canvas);
				const is_canvas_active_group = !!active_group && active_group === this;
				const selected_group = is_group_selected(this);
				const has_pointer_down = is_pointer_down_active(canvas);
				const should_exempt_selected = selected_group
					&& (is_interaction_active(canvas) || has_pointer_down);
				const should_hide_outline = hide_active_outline
					&& canvas?.__crosshair_hide_active_outline
					&& selected_group;
				const previous_selected = should_hide_outline ? this.selected : null;
				const previous_is_selected = should_hide_outline ? this.is_selected : null;
				if (should_hide_outline)
				{
					this.selected = false;
					this.is_selected = false;
				}

				const should_exempt = (exempt_groups instanceof Set && exempt_groups.has(this))
					|| (group_id && exempt_group_ids?.has(group_id))
					|| is_active_group
					|| is_canvas_active_group
					|| should_exempt_selected;

				// Save previous ctx flag state
				const prev_ctx_exempt = ctx.__crosshair_node_opacity_ctx_exempt;

				// CRITICAL: Only set exempt=true, never set it to false
				// This preserves exempt=true set by higher-level wrappers (like drawGroup)
				const did_set_exempt = should_exempt && !prev_ctx_exempt;
				if (did_set_exempt)
				{
					ctx.__crosshair_node_opacity_ctx_exempt = true;
				}

				try
				{
					return original.apply(this, arguments);
				}
				finally
				{
					// Only restore if we changed it
					if (did_set_exempt)
					{
						ctx.__crosshair_node_opacity_ctx_exempt = prev_ctx_exempt;
					}
					if (should_hide_outline)
					{
						this.selected = previous_selected;
						this.is_selected = previous_is_selected;
					}
				}
			};
			wrapped.__crosshair_group_opacity_wrapper = true;
			try
			{
				group_proto[method_name] = wrapped;
			}
			catch (err)
			{
			}
		}
		group_proto.__crosshair_group_instance_draw_installed = true;
	};

	for (const group_proto of prototypes)
	{
		wrap_proto(group_proto);
	}
}

function install_node_draw_override(canvas)
{
	if (!canvas)
	{
		return;
	}
	set_ctx_canvas_ref(canvas);
	install_node_instance_draw_override();
	install_group_instance_draw_override();

	const get_draw_method_names = (target_list) =>
	{
		const names = new Set();
		const allowed = new Set([
			"drawnode",
			"drawnodes",
			"drawgroup",
			"drawgroups",
			"drawnodeconnections",
			"drawnodeconnection",
			"drawnodeslots",
			"drawnodesockets",
			"drawnodeinputs",
			"drawnodeoutputs"
		]);
		const should_wrap = (name, descriptor) =>
		{
			if (!descriptor || typeof descriptor.value !== "function")
			{
				return false;
			}
			const lower = String(name).toLowerCase();
			if (allowed.has(lower))
			{
				return true;
			}
			if (!lower.includes("draw"))
			{
				return false;
			}
			if (lower.includes("link") || lower.includes("edge"))
			{
				return false;
			}
			// Classic LiteGraph can draw sockets/slots in methods named like drawNodeConnections.
			// Those are node visuals and should be eligible for node opacity exemption.
			if (lower.includes("connection") && !lower.includes("node"))
			{
				return false;
			}
			return lower.includes("node") || lower.includes("group");
		};

		for (const target of target_list)
		{
			if (!target)
			{
				continue;
			}
			const descriptors = Object.getOwnPropertyDescriptors(target);
			for (const name of Object.keys(descriptors))
			{
				if (should_wrap(name, descriptors[name]))
				{
					names.add(name);
				}
			}
		}

		const fallback = [
			"drawNode",
			"drawNodes",
			"drawGroup",
			"drawGroups",
			"drawNodeConnections",
			"drawNodeConnection",
			"drawNodeSlots",
			"drawNodeSockets",
			"drawNodeInputs",
			"drawNodeOutputs"
		];
		for (const name of fallback)
		{
			names.add(name);
		}

		return Array.from(names);
	};

	const resolve_ctx = (instance, args) =>
	{
		if (args && args.length > 0)
		{
			for (const arg of args)
			{
				if (arg && typeof arg.save === "function")
				{
					return arg;
				}
			}
		}
		if (instance?.ctx && typeof instance.ctx.save === "function")
		{
			return instance.ctx;
		}
		return null;
	};

	const resolve_targets = (args) =>
	{
		let node = null;
		let group = null;
		if (args && args.length > 0)
		{
			for (const arg of args)
			{
				if (!node && is_node_like(arg))
				{
					node = arg;
				}
				if (!group && is_group_like(arg))
				{
					group = arg;
				}
				if (node && group)
				{
					break;
				}
			}
		}
		return { node, group };
	};

	const wrap = (target, method_name) =>
	{
		if (!target)
		{
			return false;
		}
		const descriptor = Object.getOwnPropertyDescriptor(target, method_name);
		if (!descriptor || typeof descriptor.value !== "function")
		{
			return false;
		}
		const original = descriptor.value;
		if (original.__crosshair_node_opacity_wrapper)
		{
			return true;
		}
		const wrapped = function()
		{
			const resolved_ctx = resolve_ctx(this, arguments) || this.ctx;
			if (resolved_ctx)
			{
				install_link_opacity_ctx_patch(resolved_ctx);
				ensure_interaction_state(this, resolved_ctx);
			}
			const active = !!this.__crosshair_node_opacity_active;
			const multiplier = this.__crosshair_node_opacity_multiplier;
			const targets = resolve_targets(arguments);
			const exempt_nodes = this.__crosshair_node_opacity_exempt_nodes;
			const exempt_groups = this.__crosshair_node_opacity_exempt_groups;
			const exempt_node_ids = this.__crosshair_node_opacity_exempt_node_ids;
			const exempt_group_ids = this.__crosshair_node_opacity_exempt_group_ids;
			const node_id = exempt_node_ids && targets.node ? get_node_identifier(targets.node) : null;
			const group_id = exempt_group_ids && targets.group ? get_group_identifier(targets.group) : null;
			const active_target = this.__crosshair_active_target;
			const is_active_node = !!active_target
				&& !!targets.node
				&& (active_target.drag_node_target === targets.node
					|| active_target.resize_node_candidate === targets.node);
			const fallback_drag_node = get_canvas_drag_node(this);
			const fallback_resize_node = get_canvas_resize_node(this);
			const pointer_node = this.__crosshair_pointer_node;
			const is_key_active_node = !!targets.node
				&& (targets.node === fallback_drag_node || targets.node === fallback_resize_node);
			const is_pointer_node = !!targets.node && targets.node === pointer_node;
			const is_hovered_node = !!targets.node && is_node_hovered_by_pointer(this, targets.node);
			const is_active_group = !!active_target
				&& !!targets.group
				&& (active_target.active_resize_group === targets.group
					|| active_target.drag_group === targets.group);
			const active_node = get_active_node_from_canvas(this);
			const is_canvas_active_node = !!targets.node && !!active_node && active_node === targets.node;
			const active_group = get_active_group_from_canvas(this);
			const is_canvas_active_group = !!targets.group && !!active_group && active_group === targets.group;
			const selected_node = is_node_selected(targets.node);
			const has_pointer_down = is_pointer_down_active(this);
			const should_exempt_selected = selected_node
				&& (is_interaction_active(this) || has_pointer_down);
			const selected_group = is_group_selected(targets.group);
			const should_exempt_selected_group = selected_group
				&& (is_interaction_active(this) || has_pointer_down);
			const ctx = resolved_ctx;
			if (!ctx)
			{
				return original.apply(this, arguments);
			}
			const should_hide_outline = hide_active_outline
				&& this.__crosshair_hide_active_outline;
			const should_hide_node_outline = should_hide_outline
				&& !!targets.node
				&& (selected_node || is_active_node || is_canvas_active_node || is_key_active_node || is_pointer_node || is_hovered_node);
			const previous_node_selected = should_hide_node_outline ? targets.node.selected : null;
			const previous_node_is_selected = should_hide_node_outline ? targets.node.is_selected : null;
			const previous_node_isSelected = should_hide_node_outline ? targets.node.isSelected : null;
			if (should_hide_node_outline)
			{
				targets.node.selected = false;
				targets.node.is_selected = false;
				targets.node.isSelected = false;
			}
			const should_hide_group_outline = should_hide_outline
				&& !!targets.group
				&& (selected_group || is_active_group || is_canvas_active_group);
			const previous_group_selected = should_hide_group_outline ? targets.group.selected : null;
			const previous_group_is_selected = should_hide_group_outline ? targets.group.is_selected : null;
			if (should_hide_group_outline)
			{
				targets.group.selected = false;
				targets.group.is_selected = false;
			}

			const should_dim = active && Number.isFinite(multiplier) && multiplier < 0.999;
			const should_exempt = (targets.node && (is_active_node
				|| is_canvas_active_node
				|| is_key_active_node
				|| is_pointer_node
				|| is_hovered_node
				|| should_exempt_selected
				|| (exempt_nodes instanceof Set && exempt_nodes.has(targets.node))
				|| (node_id && exempt_node_ids?.has(node_id))))
				|| (targets.group && (is_active_group
					|| is_canvas_active_group
					|| should_exempt_selected_group
					|| (exempt_groups instanceof Set && exempt_groups.has(targets.group))
					|| (group_id && exempt_group_ids?.has(group_id))));

			// Save previous ctx flag state
			const prev_ctx_active = ctx.__crosshair_node_opacity_ctx_active;
			const prev_ctx_multiplier = ctx.__crosshair_node_opacity_ctx_multiplier;
			const prev_ctx_exempt = ctx.__crosshair_node_opacity_ctx_exempt;
			const prev_drawing_node = ctx.__crosshair_drawing_node;

			// Set ctx flags for this drawing operation
			// Always set active/multiplier so lower-level code can dim correctly
			if (should_dim)
			{
				ctx.__crosshair_node_opacity_ctx_active = true;
				ctx.__crosshair_node_opacity_ctx_multiplier = multiplier;
			}

			// Track which node is currently being drawn (for fallback exemption check in ctx patch)
			if (targets.node)
			{
				ctx.__crosshair_drawing_node = targets.node;
			}

			// CRITICAL: Only set exempt=true, never set it to false
			// This allows higher-level wrappers' exempt=true to persist through lower-level calls
			const did_set_exempt = should_exempt && !prev_ctx_exempt;
			if (did_set_exempt)
			{
				ctx.__crosshair_node_opacity_ctx_exempt = true;
			}

			try
			{
				return original.apply(this, arguments);
			}
			finally
			{
				// Restore ctx flags
				ctx.__crosshair_node_opacity_ctx_active = prev_ctx_active;
				ctx.__crosshair_node_opacity_ctx_multiplier = prev_ctx_multiplier;
				if (did_set_exempt)
				{
					ctx.__crosshair_node_opacity_ctx_exempt = prev_ctx_exempt;
				}
				ctx.__crosshair_drawing_node = prev_drawing_node;

				if (should_hide_node_outline)
				{
					targets.node.selected = previous_node_selected;
					targets.node.is_selected = previous_node_is_selected;
					targets.node.isSelected = previous_node_isSelected;
				}
				if (should_hide_group_outline)
				{
					targets.group.selected = previous_group_selected;
					targets.group.is_selected = previous_group_is_selected;
				}
			}
		};
		wrapped.__crosshair_node_opacity_wrapper = true;
		try
		{
			Object.defineProperty(target, method_name, {
				configurable: descriptor.configurable,
				enumerable: descriptor.enumerable,
				writable: true,
				value: wrapped
			});
		}
		catch (err)
		{
			// Some LiteGraph builds define methods with restrictive descriptors.
			// If defineProperty fails but assignment works, prefer assignment over skipping the wrapper.
			try
			{
				target[method_name] = wrapped;
			}
			catch (err2)
			{
				return false;
			}
		}
		return true;
	};

	const targets = [];
	targets.push(canvas);
	const canvas_proto = Object.getPrototypeOf(canvas);
	if (canvas_proto)
	{
		targets.push(canvas_proto);
	}
	const litegraph_proto = window.LiteGraph?.LGraphCanvas?.prototype;
	if (litegraph_proto && litegraph_proto !== canvas_proto)
	{
		targets.push(litegraph_proto);
	}

	let installed = false;
	const methods = get_draw_method_names(targets);
	for (const target of targets)
	{
		for (const method of methods)
		{
			installed = wrap(target, method) || installed;
		}
	}
	if (installed)
	{
		canvas.__crosshair_node_draw_override_installed = true;
	}
}

function install_link_opacity_ctx_patch(ctx_or_canvas)
{
	const ctx = ctx_or_canvas?.save
		? ctx_or_canvas
		: ctx_or_canvas?.ctx;
	if (!ctx || ctx.__crosshair_opacity_patch_installed)
	{
		return;
	}

	const wrap = (method_name) =>
	{
		const original = ctx[method_name];
		if (typeof original !== "function" || original.__crosshair_opacity_wrapper)
		{
			return;
		}
		const wrapped = function()
		{
			// Check link opacity
			const links_active = !!this.__crosshair_links_opacity_active;
			const links_multiplier = this.__crosshair_links_opacity_multiplier;
			const apply_links = links_active && Number.isFinite(links_multiplier) && links_multiplier < 0.999;

			// Check node opacity (active AND NOT exempt)
			const nodes_active = !!this.__crosshair_node_opacity_ctx_active;
			let nodes_exempt = !!this.__crosshair_node_opacity_ctx_exempt;
			const nodes_multiplier = this.__crosshair_node_opacity_ctx_multiplier;
			let canvas = this.__crosshair_canvas_ref;
			if (!canvas)
			{
				const drawing_node = this.__crosshair_drawing_node;
				if (drawing_node)
				{
					canvas = get_canvas_from_context_or_node(this, drawing_node);
				}
				else if (app?.canvas)
				{
					canvas = app.canvas;
				}
				else if (typeof window !== "undefined"
					&& window.__crosshair_guidelines_canvases instanceof Set
					&& window.__crosshair_guidelines_canvases.size === 1)
				{
					canvas = Array.from(window.__crosshair_guidelines_canvases.values())[0] || null;
				}
				if (canvas)
				{
					this.__crosshair_canvas_ref = canvas;
				}
			}

			// Fallback exemption check: if we're currently drawing a node that's in the exempt set
			if (!nodes_exempt && nodes_active)
			{
				const drawing_node = this.__crosshair_drawing_node;
				if (drawing_node && canvas)
				{
					const exempt_nodes = canvas.__crosshair_node_opacity_exempt_nodes;
					const exempt_node_ids = canvas.__crosshair_node_opacity_exempt_node_ids;
					if (exempt_nodes instanceof Set && exempt_nodes.has(drawing_node))
					{
						nodes_exempt = true;
					}
					else if (exempt_node_ids instanceof Set)
					{
						const node_id = drawing_node.id !== undefined ? String(drawing_node.id) : null;
						if (node_id && exempt_node_ids.has(node_id))
						{
							nodes_exempt = true;
						}
					}
				}
			}

			if (!nodes_exempt && nodes_active && canvas)
			{
				const bounds_list = canvas.__crosshair_node_opacity_exempt_bounds;
				if (is_draw_operation_inside_bounds(this, method_name, arguments, bounds_list))
				{
					nodes_exempt = true;
				}
				else if (is_bounds_intersecting_list(this.__crosshair_path_bounds, bounds_list))
				{
					nodes_exempt = true;
				}
			}

			const apply_nodes = nodes_active && !nodes_exempt && Number.isFinite(nodes_multiplier) && nodes_multiplier < 0.999;

			const should_reset_path = method_name === "fill" || method_name === "stroke";
			if (!apply_links && !apply_nodes)
			{
				const result = original.apply(this, arguments);
				if (should_reset_path)
				{
					reset_path_bounds(this);
				}
				return result;
			}

			let multiplier = 1;
			if (apply_links)
			{
				multiplier *= links_multiplier;
			}
			if (apply_nodes)
			{
				multiplier *= nodes_multiplier;
			}

			this.save();
			this.globalAlpha = this.globalAlpha * multiplier;
			try
			{
				return original.apply(this, arguments);
			}
			finally
			{
				this.restore();
				if (should_reset_path)
				{
					reset_path_bounds(this);
				}
			}
		};
		wrapped.__crosshair_opacity_wrapper = true;
		try
		{
			ctx[method_name] = wrapped;
		}
		catch (err)
		{
		}
	};

	wrap("stroke");
	wrap("fill");
	wrap("fillRect");
	wrap("strokeRect");
	wrap("fillText");
	wrap("strokeText");
	wrap("drawImage");

	const wrap_path_bounds = (method_name, updater) =>
	{
		const original = ctx[method_name];
		if (typeof original !== "function" || original.__crosshair_path_bounds_wrapper)
		{
			return;
		}
		const wrapped = function()
		{
			const result = original.apply(this, arguments);
			try
			{
				updater(this, arguments);
			}
			catch (err)
			{
			}
			return result;
		};
		wrapped.__crosshair_path_bounds_wrapper = true;
		try
		{
			ctx[method_name] = wrapped;
		}
		catch (err)
		{
		}
	};

	wrap_path_bounds("beginPath", (ctx_ref) =>
	{
		reset_path_bounds(ctx_ref);
	});

	wrap_path_bounds("arc", (ctx_ref, args) =>
	{
		const x = Number(args[0]);
		const y = Number(args[1]);
		const radius = Number(args[2]);
		if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius))
		{
			return;
		}
		update_path_bounds(ctx_ref, x - radius, y - radius, x + radius, y + radius);
	});

	wrap_path_bounds("ellipse", (ctx_ref, args) =>
	{
		const x = Number(args[0]);
		const y = Number(args[1]);
		const radius_x = Number(args[2]);
		const radius_y = Number(args[3]);
		if (!Number.isFinite(x) || !Number.isFinite(y)
			|| !Number.isFinite(radius_x) || !Number.isFinite(radius_y))
		{
			return;
		}
		update_path_bounds(ctx_ref, x - radius_x, y - radius_y, x + radius_x, y + radius_y);
	});

	wrap_path_bounds("rect", (ctx_ref, args) =>
	{
		const x = Number(args[0]);
		const y = Number(args[1]);
		const width = Number(args[2]);
		const height = Number(args[3]);
		if (!Number.isFinite(x) || !Number.isFinite(y)
			|| !Number.isFinite(width) || !Number.isFinite(height))
		{
			return;
		}
		update_path_bounds(ctx_ref, x, y, x + width, y + height);
	});

	wrap_path_bounds("moveTo", (ctx_ref, args) =>
	{
		const x = Number(args[0]);
		const y = Number(args[1]);
		if (!Number.isFinite(x) || !Number.isFinite(y))
		{
			return;
		}
		update_path_bounds(ctx_ref, x, y, x, y);
	});

	wrap_path_bounds("lineTo", (ctx_ref, args) =>
	{
		const x = Number(args[0]);
		const y = Number(args[1]);
		if (!Number.isFinite(x) || !Number.isFinite(y))
		{
			return;
		}
		update_path_bounds(ctx_ref, x, y, x, y);
	});

	wrap_path_bounds("quadraticCurveTo", (ctx_ref, args) =>
	{
		const cpx = Number(args[0]);
		const cpy = Number(args[1]);
		const x = Number(args[2]);
		const y = Number(args[3]);
		if (!Number.isFinite(cpx) || !Number.isFinite(cpy) || !Number.isFinite(x) || !Number.isFinite(y))
		{
			return;
		}
		update_path_bounds(ctx_ref, cpx, cpy, cpx, cpy);
		update_path_bounds(ctx_ref, x, y, x, y);
	});

	wrap_path_bounds("bezierCurveTo", (ctx_ref, args) =>
	{
		const cp1x = Number(args[0]);
		const cp1y = Number(args[1]);
		const cp2x = Number(args[2]);
		const cp2y = Number(args[3]);
		const x = Number(args[4]);
		const y = Number(args[5]);
		if (!Number.isFinite(cp1x) || !Number.isFinite(cp1y)
			|| !Number.isFinite(cp2x) || !Number.isFinite(cp2y)
			|| !Number.isFinite(x) || !Number.isFinite(y))
		{
			return;
		}
		update_path_bounds(ctx_ref, cp1x, cp1y, cp1x, cp1y);
		update_path_bounds(ctx_ref, cp2x, cp2y, cp2x, cp2y);
		update_path_bounds(ctx_ref, x, y, x, y);
	});

	ctx.__crosshair_opacity_patch_installed = true;
}

function install_active_outline_hide_patch(canvas)
{
	const prototypes = [];
	const litegraph_proto = window.LiteGraph?.LGraphCanvas?.prototype;
	const fallback_proto = window.LGraphCanvas?.prototype;
	if (litegraph_proto)
	{
		prototypes.push(litegraph_proto);
	}
	if (fallback_proto && fallback_proto !== litegraph_proto)
	{
		prototypes.push(fallback_proto);
	}
	if (prototypes.length === 0)
	{
		return;
	}

	const wrap_proto = (canvas_proto) =>
	{
		if (!canvas_proto || canvas_proto.__crosshair_outline_hide_patch_installed)
		{
			return;
		}
		const original = canvas_proto.drawNodeShape;
		if (typeof original !== "function" || original.__crosshair_outline_hide_wrapper)
		{
			canvas_proto.__crosshair_outline_hide_patch_installed = true;
			return;
		}
		const wrapped = function()
		{
			const args = Array.from(arguments);
			const node = args.length > 0 ? args[0] : null;
			const selected = args.length > 5 ? args[5] : null;
			const ctx = resolve_ctx_from_args(args) || this?.ctx;
			if (ctx)
			{
				install_link_opacity_ctx_patch(ctx);
			}
			if (ctx && !ctx.__crosshair_canvas_ref)
			{
				ctx.__crosshair_canvas_ref = this;
			}
			if (this)
			{
				ensure_interaction_state(this, ctx);
			}
			const active_target = this?.__crosshair_active_target;
			const fallback_drag_node = get_canvas_drag_node(this);
			const fallback_resize_node = get_canvas_resize_node(this);
			const pointer_node = this?.__crosshair_pointer_node;
			const is_active_node = !!active_target
				&& (active_target.drag_node_target === node || active_target.resize_node_candidate === node);
			const is_key_active_node = !!node
				&& (node === fallback_drag_node || node === fallback_resize_node);
			const is_pointer_node = !!node && node === pointer_node;
			const is_hovered_node = !!node && is_node_hovered_by_pointer(this, node);
			const active_node = get_active_node_from_canvas(this);
			const is_canvas_active_node = !!active_node && node === active_node;
			const selected_arg = !!selected;
			const selected_node = selected_arg || is_node_selected(node);
			const should_hide = hide_active_outline
				&& this.__crosshair_hide_active_outline
				&& (selected_node || is_active_node || is_canvas_active_node || is_key_active_node || is_pointer_node || is_hovered_node);
			const previous_selected = should_hide ? node?.selected : null;
			const previous_is_selected = should_hide ? node?.is_selected : null;
			const previous_isSelected = should_hide ? node?.isSelected : null;
			if (selected && should_hide)
			{
				args[5] = false;
			}
			if (should_hide)
			{
				if (typeof args[6] === "boolean")
				{
					args[6] = false;
				}
				if (node)
				{
					node.selected = false;
					node.is_selected = false;
					node.isSelected = false;
				}
			}
			const exempt_nodes = this?.__crosshair_node_opacity_exempt_nodes;
			const exempt_node_ids = this?.__crosshair_node_opacity_exempt_node_ids;
			const node_id = exempt_node_ids && node ? get_node_identifier(node) : null;
			const has_pointer_down = is_pointer_down_active(this);
			const should_exempt_selected = selected_node
				&& (is_interaction_active(this) || has_pointer_down);
			const should_exempt = (exempt_nodes instanceof Set && exempt_nodes.has(node))
				|| (node_id && exempt_node_ids?.has(node_id))
				|| is_active_node
				|| is_canvas_active_node
				|| is_key_active_node
				|| is_pointer_node
				|| is_hovered_node
				|| should_exempt_selected;

			// Save previous ctx flag state
			const prev_ctx_exempt = ctx?.__crosshair_node_opacity_ctx_exempt;
			const prev_drawing_node = ctx?.__crosshair_drawing_node;

			// Track which node is currently being drawn (for fallback exemption check in ctx patch)
			const did_set_drawing_node = ctx && node && !prev_drawing_node;
			if (did_set_drawing_node)
			{
				ctx.__crosshair_drawing_node = node;
			}

			// CRITICAL: Only set exempt=true, never set it to false
			// This preserves exempt=true set by higher-level wrappers
			const did_set_exempt = ctx && should_exempt && !prev_ctx_exempt;
			if (did_set_exempt)
			{
				ctx.__crosshair_node_opacity_ctx_exempt = true;
			}

			try
			{
				return original.apply(this, args);
			}
			finally
			{
				// Only restore if we changed it
				if (did_set_exempt)
				{
					ctx.__crosshair_node_opacity_ctx_exempt = prev_ctx_exempt;
				}
				if (did_set_drawing_node)
				{
					ctx.__crosshair_drawing_node = prev_drawing_node;
				}
				if (should_hide && node)
				{
					node.selected = previous_selected;
					node.is_selected = previous_is_selected;
					node.isSelected = previous_isSelected;
				}
			}
		};
		wrapped.__crosshair_outline_hide_wrapper = true;
		try
		{
			canvas_proto.drawNodeShape = wrapped;
		}
		catch (err)
		{
		}
		canvas_proto.__crosshair_outline_hide_patch_installed = true;
	};

	for (const canvas_proto of prototypes)
	{
		wrap_proto(canvas_proto);
	}
}

function escape_attribute_value(value)
{
	if (typeof value !== "string")
	{
		return "";
	}
	return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

function find_setting_input_element(setting_id)
{
	if (typeof document === "undefined")
	{
		return null;
	}
	const by_id = document.getElementById(setting_id);
	if (by_id && by_id.tagName === "INPUT")
	{
		return by_id;
	}
	const escaped_id = escape_attribute_value(setting_id);
	const selectors = [
		`[data-setting-id="${escaped_id}"] input`,
		`[data-settingid="${escaped_id}"] input`,
		`[data-setting-id="${escaped_id}"]`,
		`[data-settingid="${escaped_id}"]`
	];
	for (const selector of selectors)
	{
		const node = document.querySelector(selector);
		if (!node)
		{
			continue;
		}
		if (node.tagName === "INPUT")
		{
			return node;
		}
		const nested = node.querySelector("input");
		if (nested)
		{
			return nested;
		}
	}
	return null;
}

function install_link_opacity_input_patch()
{
	const input = find_setting_input_element(SETTING_LINK_OPACITY_ID);
	if (!input)
	{
		return false;
	}
	if (input.__crosshair_link_opacity_input_patched)
	{
		return true;
	}
	try
	{
		input.type = "text";
		input.inputMode = "decimal";
		input.autocomplete = "off";
		input.spellcheck = false;
		input.setAttribute("inputmode", "decimal");
		input.setAttribute("pattern", "[0-9]*[\\.,]?[0-9]*");
	}
	catch (err)
	{
	}
	input.__crosshair_link_opacity_input_patched = true;
	return true;
}

function schedule_link_opacity_input_patch()
{
	if (link_opacity_input_patch_attempts >= LINK_OPACITY_INPUT_PATCH_MAX_TRIES)
	{
		return;
	}
	link_opacity_input_patch_attempts += 1;
	if (install_link_opacity_input_patch())
	{
		return;
	}
	if (typeof requestAnimationFrame === "function")
	{
		requestAnimationFrame(schedule_link_opacity_input_patch);
	}
}

function install_link_opacity_input_observer()
{
	if (typeof MutationObserver === "undefined" || typeof document === "undefined")
	{
		return;
	}
	if (!document.body)
	{
		return;
	}
	if (document.__crosshair_link_opacity_observer_installed)
	{
		return;
	}
	const observer = new MutationObserver(() =>
	{
		if (install_link_opacity_input_patch())
		{
			observer.disconnect();
		}
	});
	observer.observe(document.body, { childList: true, subtree: true });
	document.__crosshair_link_opacity_observer_installed = true;
}

function schedule_opacity_redraw(canvas, keys)
{
	if (!canvas || canvas[keys.animating])
	{
		return;
	}
	canvas[keys.animating] = true;
	const tick = () =>
	{
		canvas[keys.animating] = false;
		request_canvas_redraw(canvas);
	};
	if (typeof requestAnimationFrame === "function")
	{
		requestAnimationFrame(tick);
	}
	else
	{
		setTimeout(tick, 16);
	}
}

function update_opacity(canvas, target_opacity, keys)
{
	if (!canvas)
	{
		return;
	}
	const clamped_target = Math.min(1, Math.max(0, Number.isFinite(target_opacity) ? target_opacity : 1));
	const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
	const previous_target = Number.isFinite(canvas[keys.target])
		? canvas[keys.target]
		: 1;
	let last = Number.isFinite(canvas[keys.last])
		? canvas[keys.last]
		: now;
	if (Math.abs(previous_target - clamped_target) > 0.001)
	{
		last = now;
	}
	canvas[keys.last] = now;

	if (!Number.isFinite(canvas[keys.current]))
	{
		canvas[keys.current] = 1;
	}

	const delta = Math.min(0.033, Math.max(0, (now - last) / 1000));
	const factor = Math.min(1, delta * 12);
	const current = canvas[keys.current];
	const next = current + (clamped_target - current) * factor;

	const settled = Math.abs(clamped_target - next) <= 0.002;
	canvas[keys.current] = settled ? clamped_target : next;
	canvas[keys.target] = clamped_target;

	if (!settled)
	{
		schedule_opacity_redraw(canvas, keys);
	}
}

function clear_opacity_state(canvas, ctx, keys)
{
	if (!canvas)
	{
		return;
	}
	canvas[keys.current] = 1;
	canvas[keys.target] = 1;

	const context = ctx || canvas.ctx;
	if (context)
	{
		context[keys.ctx_active] = false;
		context[keys.ctx_multiplier] = 1;
	}
}

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

function get_node_identifier(node)
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

function get_group_identifier(group)
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

function collect_id_set(items, resolver)
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

function get_graph_container(canvas)
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

	// If the ctx transform already matches ds.scale (ratio ~ 1), assume coords are already device-based.
	// If it matches element_ratio, treat screen coords as CSS pixels and scale to device pixels.
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

function build_exempt_node_bounds(canvas, ctx, exempt_nodes)
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

function update_path_bounds(ctx, left, top, right, bottom)
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

function reset_path_bounds(ctx)
{
	if (!ctx)
	{
		return;
	}
	ctx.__crosshair_path_bounds = null;
}

function is_bounds_intersecting_list(bounds, bounds_list)
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

function is_draw_operation_inside_bounds(ctx, method_name, args, bounds_list)
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

function apply_dom_outline_visibility(canvas)
{
	if (!canvas || typeof document === "undefined")
	{
		return;
	}
	const should_hide = hide_active_outline
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

function apply_dom_node_opacity(canvas)
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

function compute_interaction_state(canvas, ctx)
{
	if (!canvas)
	{
		return null;
	}

	canvas.__crosshair_interaction_active = false;
	canvas.__crosshair_hide_active_outline = false;

	const mouse_screen = canvas.__crosshair_last_mouse_screen || canvas.__crosshair_last_mouse;
	const now = Date.now();
	if (Number.isFinite(canvas.__crosshair_force_hide_until)
		&& now < canvas.__crosshair_force_hide_until
		&& idle_mode !== "all")
	{
		return clear_interaction_visuals(canvas, ctx);
	}

	let dragging_by_distance = false;
	if (canvas.__crosshair_mouse_down && mouse_screen && canvas.__crosshair_drag_start)
	{
		const dx = mouse_screen[0] - canvas.__crosshair_drag_start[0];
		const dy = mouse_screen[1] - canvas.__crosshair_drag_start[1];
		dragging_by_distance = (dx * dx + dy * dy) >= (DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX);
		if (dragging_by_distance && !canvas.__crosshair_dragging)
		{
			canvas.__crosshair_dragging = true;
		}
	}
	if (!canvas.__crosshair_mouse_down && canvas.__crosshair_dragging)
	{
		canvas.__crosshair_dragging = false;
	}

	if (canvas.__crosshair_pointer_down && Number.isFinite(canvas.__crosshair_pointer_last_time))
	{
		const age = now - canvas.__crosshair_pointer_last_time;
		if (age > POINTER_IDLE_RESET_MS && !canvas.__crosshair_mouse_down)
		{
			canvas.__crosshair_pointer_down = false;
			canvas.__crosshair_pointer_dragging = false;
			canvas.__crosshair_pointer_down_pos = null;
			canvas.__crosshair_pointer_on_input = false;
			canvas.__crosshair_pointer_on_connection = false;
			canvas.__crosshair_pointer_node = null;
		}
	}

	const pointer_down_now = !!canvas.__crosshair_mouse_down
		|| !!canvas.__crosshair_pointer_down
		|| get_global_pointer_down();
	const has_local_pointer = !!canvas.__crosshair_mouse_down || !!canvas.__crosshair_pointer_down;
	let pointer_dragging = pointer_down_now
		&& (!!canvas.__crosshair_pointer_dragging || dragging_by_distance || !!canvas.__crosshair_dragging);
	let pointer_active = pointer_down_now;
	let activity = null;
	const links_opacity_before = Number.isFinite(canvas.__crosshair_links_current_opacity)
		? canvas.__crosshair_links_current_opacity
		: 1;
	if (is_multi_select_modifier_active(canvas))
	{
		const explicit_move_or_resize = pointer_dragging
			|| !!get_canvas_drag_node(canvas)
			|| !!get_canvas_resize_node(canvas)
			|| !!get_canvas_drag_group(canvas)
			|| !!get_canvas_resize_group(canvas)
			|| has_group_resize_flags(canvas);
		if (!explicit_move_or_resize && pointer_down_now)
		{
			activity = detect_graph_activity(canvas);
		}
		const activity_move_or_resize = !!activity?.move_node
			|| !!activity?.resize_node
			|| !!activity?.move_group
			|| !!activity?.resize_group
			|| ((activity?.moved_nodes_count || 0) > 0);
		if (!explicit_move_or_resize && !activity_move_or_resize)
		{
			canvas.__crosshair_pointer_node = null;
			canvas.__crosshair_drag_node_target = null;
			canvas.__crosshair_drag_group_target = null;
			canvas.__crosshair_node_resize_latched = false;
			canvas.__crosshair_node_resize_target = null;
			canvas.__crosshair_node_resize_corner = null;
			canvas.__crosshair_node_resize_session_target = null;
			canvas.__crosshair_node_resize_session_corner = null;
			canvas.__crosshair_active_target = null;
			return clear_interaction_visuals(canvas, ctx);
		}
	}
	if (pointer_down_now && !has_local_pointer && get_global_pointer_on_input())
	{
		canvas.__crosshair_pointer_node = null;
		canvas.__crosshair_pointer_on_input = false;
		return clear_interaction_visuals(canvas, ctx);
	}
	if (pointer_down_now && !has_local_pointer && get_global_pointer_on_connection())
	{
		canvas.__crosshair_pointer_node = null;
		canvas.__crosshair_pointer_on_connection = false;
		return clear_interaction_visuals(canvas, ctx);
	}
	const dragging_canvas = !!canvas.dragging_canvas
		|| !!canvas.draggingCanvas
		|| !!canvas.dragging_background
		|| !!canvas.draggingBackground;
	const connecting_node = has_connection_drag(canvas);
	if (connecting_node)
	{
		canvas.__crosshair_pointer_on_connection = true;
	}
	if (pointer_down_now && canvas.__crosshair_pointer_on_connection && !connecting_node)
	{
		activity = detect_graph_activity(canvas);
		const movement_detected = !!activity?.move_node
			|| !!activity?.resize_node
			|| !!activity?.move_group
			|| !!activity?.resize_group
			|| ((activity?.moved_nodes_count || 0) > 0);
		if (movement_detected)
		{
			canvas.__crosshair_pointer_on_connection = false;
		}
	}
	if (dragging_canvas)
	{
		if (links_opacity_before < 0.999)
		{
			update_opacity(canvas, 1, OPACITY_KEYS.links);
		}
		else
		{
			clear_opacity_state(canvas, ctx, OPACITY_KEYS.links);
		}
		const nodes_opacity_before = Number.isFinite(canvas.__crosshair_nodes_current_opacity)
			? canvas.__crosshair_nodes_current_opacity
			: 1;
		if (nodes_opacity_before < 0.999)
		{
			update_opacity(canvas, 1, OPACITY_KEYS.nodes);
		}
		else
		{
			clear_opacity_state(canvas, ctx, OPACITY_KEYS.nodes);
		}
		canvas.__crosshair_node_opacity_active = false;
		canvas.__crosshair_node_opacity_multiplier = 1;
		canvas.__crosshair_node_opacity_exempt_nodes = null;
		canvas.__crosshair_node_opacity_exempt_groups = null;
		canvas.__crosshair_node_opacity_exempt_node_ids = null;
		canvas.__crosshair_node_opacity_exempt_group_ids = null;
		canvas.__crosshair_interaction_active = false;
		canvas.__crosshair_hide_active_outline = false;
		apply_dom_node_opacity(canvas);
		apply_dom_outline_visibility(canvas);
		return { can_draw: false };
	}
	if (connecting_node || (pointer_down_now && (canvas.__crosshair_pointer_on_input || canvas.__crosshair_pointer_on_connection)))
	{
		canvas.__crosshair_pointer_node = null;
		return clear_interaction_visuals(canvas, ctx);
	}
	if (pointer_down_now && !has_local_pointer)
	{
		if (!canvas.__crosshair_global_pointer_latched)
		{
			canvas.__crosshair_drag_node_target = null;
			canvas.__crosshair_drag_group_target = null;
			canvas.__crosshair_node_resize_latched = false;
			canvas.__crosshair_node_resize_target = null;
			canvas.__crosshair_node_resize_corner = null;
			canvas.__crosshair_node_resize_session_target = null;
			canvas.__crosshair_node_resize_session_corner = null;
			canvas.__crosshair_drag_start_on_selected = false;
			canvas.__crosshair_drag_start = null;
			canvas.__crosshair_global_pointer_latched = true;
		}
	}
	else if (!pointer_down_now)
	{
		canvas.__crosshair_global_pointer_latched = false;
	}
	if (!pointer_down_now && idle_mode !== "all")
	{
		return clear_interaction_visuals(canvas, ctx);
	}
	if (!activity && pointer_down_now)
	{
		activity = detect_graph_activity(canvas);
	}
	if (activity?.has_activity)
	{
		pointer_dragging = true;
	}
	const resize_node = get_canvas_resize_node(canvas);
	const resize_node_fallback = canvas.__crosshair_node_resize_latched
		? canvas.__crosshair_node_resize_target
		: null;
	let resize_node_candidate = resize_node || resize_node_fallback;
	let resize_corner_hint = (canvas.__crosshair_node_resize_latched && canvas.__crosshair_node_resize_corner)
		? canvas.__crosshair_node_resize_corner
		: null;
	let resize_session_target = canvas.__crosshair_node_resize_session_target || null;
	let resize_session_corner = canvas.__crosshair_node_resize_session_corner || null;
	const has_resize_corner = (!!canvas.resizing_node_corner
		|| !!canvas.resizingNodeCorner
		|| !!canvas.resizing_corner
		|| !!canvas.resizingCorner)
		&& pointer_active
		&& (canvas.__crosshair_node_resize_latched || !!resize_node);
	const drag_node = get_canvas_drag_node(canvas);
	let drag_node_target = pointer_active
		? (canvas.__crosshair_drag_node_target || (!dragging_canvas ? drag_node : null))
		: drag_node;
	if (!drag_node_target && canvas.__crosshair_pointer_node
		&& !canvas.__crosshair_pointer_on_input
		&& !canvas.__crosshair_pointer_on_connection)
	{
		drag_node_target = canvas.__crosshair_pointer_node;
	}
	const selected_nodes = get_selected_nodes(canvas).filter((node) => !!node);
	const selected_group = get_selected_group(canvas);
	const allow_selected_fallback = has_local_pointer || !!canvas.__crosshair_drag_start_on_selected;
	let resize_group = canvas.resizing_group
		|| canvas.resizingGroup
		|| ((canvas.selected_group_resizing || canvas.selectedGroupResizing) ? selected_group : null);
	let resize_group_bounds = resize_group ? get_group_bounds(resize_group) : null;
	const has_idle_selection = selected_nodes.length > 0 || !!selected_group;
	let drag_start_on_selected = !!canvas.__crosshair_drag_start_on_selected;
	let drag_group_target = pointer_active ? canvas.__crosshair_drag_group_target : null;
	if (activity?.resize_node && !resize_node_candidate)
	{
		resize_node_candidate = activity.resize_node;
		if (activity.resize_corner)
		{
			resize_corner_hint = activity.resize_corner;
		}
	}
	if (activity?.move_node && !drag_node_target)
	{
		drag_node_target = activity.move_node;
	}
	if (activity?.resize_group && !resize_group)
	{
		resize_group = activity.resize_group;
		resize_group_bounds = get_group_bounds(resize_group);
	}
	if (activity?.move_group && !drag_group_target)
	{
		drag_group_target = activity.move_group;
	}
	if (!drag_start_on_selected && activity?.moved_nodes_count > 1)
	{
		drag_start_on_selected = true;
	}
	const resize_signal_active = !!resize_node_candidate
		|| has_resize_corner
		|| !!activity?.resize_node
		|| !!canvas.resizing_node
		|| !!canvas.node_resizing
		|| !!canvas.resizingNode
		|| !!canvas.nodeResizing
		|| !!canvas.resizing_node_corner
		|| !!canvas.resizingNodeCorner
		|| !!canvas.resizing_corner
		|| !!canvas.resizingCorner
		|| !!canvas.__crosshair_node_resize_latched;
	if (pointer_down_now && resize_signal_active)
	{
		resize_session_target = resize_node_candidate
			|| activity?.resize_node
			|| drag_node_target
			|| resize_session_target;
		if (resize_session_target)
		{
			canvas.__crosshair_node_resize_session_target = resize_session_target;
		}
		resize_session_corner = resize_corner_hint
			|| canvas.__crosshair_node_resize_corner
			|| activity?.resize_corner
			|| resize_session_corner;
		if (resize_session_corner)
		{
			canvas.__crosshair_node_resize_session_corner = resize_session_corner;
		}
	}
	else if (!pointer_down_now)
	{
		canvas.__crosshair_node_resize_session_target = null;
		canvas.__crosshair_node_resize_session_corner = null;
		resize_session_target = null;
		resize_session_corner = null;
	}
	if (pointer_down_now && !resize_node_candidate && resize_session_target)
	{
		resize_node_candidate = resize_session_target;
	}
	if (!resize_corner_hint && resize_session_corner)
	{
		resize_corner_hint = resize_session_corner;
	}
	const has_explicit_node_action = !!resize_node
		|| !!drag_node
		|| !!canvas.__crosshair_node_resize_latched
		|| !!canvas.__crosshair_drag_node_target;
	const has_group_activity = !!resize_group
		|| !!drag_group_target
		|| !!activity?.resize_group
		|| !!activity?.move_group;
	const has_latched_resize = (!!canvas.__crosshair_node_resize_latched && !!canvas.__crosshair_node_resize_target)
		|| !!resize_session_target;
	if (has_group_activity && !has_explicit_node_action && !has_latched_resize)
	{
		resize_node_candidate = null;
		resize_corner_hint = null;
		drag_node_target = null;
	}
	const move_node_target = drag_node_target || drag_node;
	let active_resize_group = resize_group
		|| (pointer_active && canvas.__crosshair_group_resize_latched
			? canvas.__crosshair_group_resize_target
			: null);
	let drag_group = !active_resize_group
		&& !!pointer_dragging
		&& !drag_node_target
		&& !resize_node_candidate
		&& drag_group_target
		? drag_group_target
		: null;
	if (pointer_down_now)
	{
		const has_target = !!resize_node_candidate
			|| !!drag_node_target
			|| !!active_resize_group
			|| !!drag_group;
		if (has_target)
		{
			canvas.__crosshair_active_target = {
				resize_node_candidate,
				drag_node_target,
				active_resize_group,
				drag_group,
				resize_corner_hint
			};
		}
		else if (canvas.__crosshair_active_target)
		{
			resize_node_candidate = canvas.__crosshair_active_target.resize_node_candidate || resize_node_candidate;
			drag_node_target = canvas.__crosshair_active_target.drag_node_target || drag_node_target;
			active_resize_group = canvas.__crosshair_active_target.active_resize_group || active_resize_group;
			drag_group = canvas.__crosshair_active_target.drag_group || drag_group;
			if (canvas.__crosshair_active_target.resize_corner_hint)
			{
				resize_corner_hint = canvas.__crosshair_active_target.resize_corner_hint;
			}
		}
	}
	else
	{
		canvas.__crosshair_active_target = null;
	}
	if (pointer_down_now && canvas.__crosshair_active_target)
	{
		pointer_dragging = pointer_dragging || !!canvas.__crosshair_pointer_dragging || dragging_by_distance || !!canvas.__crosshair_dragging;
	}

	const resize_intent = !!resize_node_candidate || has_resize_corner || has_latched_resize;
	const resize_node_active = !!resize_node_candidate
		&& (pointer_dragging || has_resize_corner || !!resize_node || has_latched_resize);
	const drag_node_active = !!drag_node_target && pointer_dragging && !resize_intent;

	const drag_active_pre = !!canvas.__crosshair_dragging
		|| pointer_dragging
		|| resize_node_active
		|| has_resize_corner
		|| drag_node_active
		|| !!canvas.resizing_group
		|| !!canvas.resizingGroup
		|| !!canvas.selected_group_resizing
		|| !!canvas.selectedGroupResizing
		|| !!canvas.resizing_group_corner
		|| !!canvas.resizingGroupCorner;
	const move_candidate = !!canvas.__crosshair_dragging
		|| pointer_dragging
		|| drag_node_active;
	const move_candidate_active = move_candidate && !resize_intent;
	active_resize_group = active_resize_group
		|| (pointer_active && canvas.__crosshair_group_resize_latched
			? canvas.__crosshair_group_resize_target
			: null);
	drag_group = drag_group
		|| (!active_resize_group
			&& move_candidate_active
			&& !drag_node_target
			&& !resize_node_candidate
			&& drag_group_target
			? drag_group_target
			: null);
	if (!active_resize_group && activity?.resize_group)
	{
		active_resize_group = activity.resize_group;
		resize_group_bounds = get_group_bounds(active_resize_group);
	}
	if (!drag_group && activity?.move_group)
	{
		drag_group = activity.move_group;
	}
	let pointer_node = pointer_down_now
		? (canvas.__crosshair_latched_pointer_node || canvas.__crosshair_pointer_node)
		: null;
	if (!pointer_node && pointer_down_now)
	{
		pointer_node = (mouse_screen ? get_node_at_screen_point(canvas, mouse_screen) : null)
			|| get_node_at_graph_point(canvas, get_graph_mouse(canvas));
	}
	if (pointer_down_now && pointer_node && !canvas.__crosshair_latched_pointer_node
		&& !canvas.__crosshair_pointer_on_input
		&& !canvas.__crosshair_pointer_on_connection)
	{
		canvas.__crosshair_latched_pointer_node = pointer_node;
	}
	if (pointer_down_now)
	{
		canvas.__crosshair_pointer_node = pointer_node;
	}
	else
	{
		canvas.__crosshair_pointer_node = null;
	}
	const last_active_node = resize_node_candidate
		|| drag_node_target
		|| move_node_target
		|| pointer_node
		|| activity?.resize_node
		|| activity?.move_node
		|| null;
	const last_active_group = active_resize_group
		|| drag_group
		|| drag_group_target
		|| activity?.resize_group
		|| activity?.move_group
		|| null;
	if (pointer_down_now)
	{
		if (last_active_node)
		{
			canvas.__crosshair_last_active_node = last_active_node;
		}
		if (last_active_group)
		{
			canvas.__crosshair_last_active_group = last_active_group;
		}
	}
	const dragging_nodes_fallback = !drag_node_target
		&& move_candidate_active
		&& !resize_node_candidate
		&& !active_resize_group
		&& !canvas.dragging_canvas
		&& !canvas.draggingCanvas
		&& !canvas.dragging_rectangle
		&& !canvas.draggingRectangle
		&& !canvas.connecting_node
		&& !canvas.connectingNode
		&& !canvas.connecting_input
		&& !canvas.connectingInput
		&& !canvas.connecting_output
		&& !canvas.connectingOutput
		&& selected_nodes.length > 0
		&& drag_start_on_selected
		&& allow_selected_fallback;

	const move_active = move_candidate_active || !!drag_group || dragging_nodes_fallback;
	const drag_active = drag_active_pre || move_active || !!active_resize_group;

	const has_move_targets = move_active && (drag_node_active || drag_group || dragging_nodes_fallback);
	const has_resize_targets = resize_node_active || has_resize_corner || !!active_resize_group;

	const interaction_active = has_resize_targets || has_move_targets;
	canvas.__crosshair_interaction_active = interaction_active;
	canvas.__crosshair_hide_active_outline = hide_active_outline && interaction_active;

	const should_dim_links = link_opacity_multiplier < 1
		&& (has_resize_targets || has_move_targets);
	if (should_dim_links)
	{
		update_opacity(canvas, link_opacity_multiplier, OPACITY_KEYS.links);
	}
	else
	{
		if (links_opacity_before < 0.999)
		{
			update_opacity(canvas, 1, OPACITY_KEYS.links);
		}
		else
		{
			clear_opacity_state(canvas, ctx, OPACITY_KEYS.links);
		}
	}
	const nodes_opacity_before = Number.isFinite(canvas.__crosshair_nodes_current_opacity)
		? canvas.__crosshair_nodes_current_opacity
		: 1;
	const should_dim_nodes = node_opacity_multiplier < 1
		&& (has_resize_targets || has_move_targets);
	if (should_dim_nodes)
	{
		update_opacity(canvas, node_opacity_multiplier, OPACITY_KEYS.nodes);
	}
	else
	{
		if (nodes_opacity_before < 0.999)
		{
			update_opacity(canvas, 1, OPACITY_KEYS.nodes);
		}
		else
		{
			clear_opacity_state(canvas, ctx, OPACITY_KEYS.nodes);
		}
	}
	const node_opacity_value = Number.isFinite(canvas.__crosshair_nodes_current_opacity)
		? canvas.__crosshair_nodes_current_opacity
		: 1;
	if (node_opacity_value < 0.999)
	{
		canvas.__crosshair_node_opacity_active = true;
		canvas.__crosshair_node_opacity_multiplier = node_opacity_value;
		if (should_dim_nodes || pointer_down_now)
		{
			const exempt_nodes = new Set();
			const exempt_groups = new Set();
			if (activity?.resize_node)
			{
				exempt_nodes.add(activity.resize_node);
			}
			if (activity?.move_node)
			{
				exempt_nodes.add(activity.move_node);
			}
			const active_canvas_node = get_active_node_from_canvas(canvas);
			if (active_canvas_node)
			{
				exempt_nodes.add(active_canvas_node);
			}
			if (canvas.__crosshair_last_active_node)
			{
				exempt_nodes.add(canvas.__crosshair_last_active_node);
			}
			if (pointer_node)
			{
				exempt_nodes.add(pointer_node);
			}
			const active_canvas_group = get_active_group_from_canvas(canvas);
			if (active_canvas_group)
			{
				exempt_groups.add(active_canvas_group);
			}
			if (resize_node_active || has_resize_corner)
			{
				if (resize_node_candidate)
				{
					exempt_nodes.add(resize_node_candidate);
				}
				else if (drag_node_target)
				{
					exempt_nodes.add(drag_node_target);
				}
				else if (allow_selected_fallback && selected_nodes.length === 1)
				{
					exempt_nodes.add(selected_nodes[0]);
				}
			}
			if (drag_node_active && drag_node_target)
			{
				exempt_nodes.add(drag_node_target);
			}
			if (move_candidate_active && move_node_target)
			{
				exempt_nodes.add(move_node_target);
			}
			if (dragging_nodes_fallback)
			{
				for (const node of selected_nodes)
				{
					if (node)
					{
						exempt_nodes.add(node);
					}
				}
			}
			if (active_resize_group)
			{
				exempt_groups.add(active_resize_group);
			}
			if (drag_group)
			{
				exempt_groups.add(drag_group);
			}
			if (move_candidate_active && !drag_node_target && !resize_node_candidate && drag_group_target)
			{
				exempt_groups.add(drag_group_target);
			}
			if (selected_nodes.length > 0)
			{
				for (const node of selected_nodes)
				{
					if (node)
					{
						exempt_nodes.add(node);
					}
				}
			}
			if (selected_group)
			{
				exempt_groups.add(selected_group);
			}
			const opacity_groups = new Set();
			if (drag_group)
			{
				opacity_groups.add(drag_group);
			}
			if (active_resize_group)
			{
				opacity_groups.add(active_resize_group);
			}
			if (drag_group_target)
			{
				opacity_groups.add(drag_group_target);
			}
			if (activity?.move_group)
			{
				opacity_groups.add(activity.move_group);
			}
			if (activity?.resize_group)
			{
				opacity_groups.add(activity.resize_group);
			}
			for (const group of opacity_groups)
			{
				const group_nodes = collect_nodes_in_group(canvas, group);
				for (const node of group_nodes)
				{
					exempt_nodes.add(node);
				}
			}
			canvas.__crosshair_node_opacity_exempt_nodes = exempt_nodes;
			canvas.__crosshair_node_opacity_exempt_groups = exempt_groups;
			canvas.__crosshair_node_opacity_exempt_node_ids = collect_id_set(exempt_nodes, get_node_identifier);
			canvas.__crosshair_node_opacity_exempt_group_ids = collect_id_set(exempt_groups, get_group_identifier);
			canvas.__crosshair_node_opacity_exempt_bounds = build_exempt_node_bounds(canvas, ctx, exempt_nodes);
		}
		else
		{
			canvas.__crosshair_node_opacity_exempt_nodes = null;
			canvas.__crosshair_node_opacity_exempt_groups = null;
			canvas.__crosshair_node_opacity_exempt_node_ids = null;
			canvas.__crosshair_node_opacity_exempt_group_ids = null;
			canvas.__crosshair_node_opacity_exempt_bounds = null;
		}
	}
	else
	{
		canvas.__crosshair_node_opacity_active = false;
		canvas.__crosshair_node_opacity_multiplier = 1;
		canvas.__crosshair_node_opacity_exempt_nodes = null;
		canvas.__crosshair_node_opacity_exempt_groups = null;
		canvas.__crosshair_node_opacity_exempt_node_ids = null;
		canvas.__crosshair_node_opacity_exempt_group_ids = null;
		canvas.__crosshair_node_opacity_exempt_bounds = null;
	}
	apply_dom_node_opacity(canvas);
	apply_dom_outline_visibility(canvas);

	return {
		can_draw: has_resize_targets || has_move_targets || (idle_mode === "all" && has_idle_selection),
		has_resize_targets,
		has_move_targets,
		resize_node_active,
		has_resize_corner,
		resize_node_candidate,
		resize_corner_hint,
		drag_node_target,
		allow_selected_fallback,
		selected_nodes,
		selected_group,
		active_resize_group,
		resize_group_bounds,
		move_active,
		dragging_nodes_fallback,
		drag_group,
		drag_active,
		pointer_active,
		has_idle_selection
	};
}

function build_setting_category(label)
{
	return [SETTINGS_PANEL_LABEL, SETTINGS_SECTION_LABEL, label];
}

function install_setting()
{
	if (!app?.ui?.settings)
	{
		return false;
	}
	if (app.ui.settings.__crosshair_guidelines_setting_installed)
	{
		return true;
	}
	app.ui.settings.__crosshair_guidelines_setting_installed = true;
	const legacy_value = load_setting(LEGACY_SETTING_STORAGE_KEY, true, (value) => !!value);
	if (!legacy_value)
	{
		move_mode = "off";
		resize_mode = "off";
		idle_mode = "off";
		save_setting(SETTING_MOVE_MODE_ID, move_mode);
		save_setting(SETTING_RESIZE_MODE_ID, resize_mode);
		save_setting(SETTING_IDLE_MODE_ID, idle_mode);
	}
	else
	{
		move_mode = load_setting(SETTING_MOVE_MODE_ID, DEFAULT_MOVE_MODE, normalize_move_mode);
		resize_mode = load_setting(SETTING_RESIZE_MODE_ID, DEFAULT_RESIZE_MODE, normalize_resize_mode);
		idle_mode = load_setting(SETTING_IDLE_MODE_ID, DEFAULT_IDLE_MODE, normalize_idle_mode);
	}
	line_color = load_setting(SETTING_COLOR_ID, DEFAULT_LINE_COLOR, normalize_line_color);
	line_width = load_setting(SETTING_THICKNESS_ID, DEFAULT_LINE_WIDTH, normalize_line_width);
	link_opacity_multiplier = load_setting(SETTING_LINK_OPACITY_ID, DEFAULT_LINK_OPACITY_MULTIPLIER, normalize_link_opacity_multiplier);
	node_opacity_multiplier = load_setting(SETTING_NODE_OPACITY_ID, DEFAULT_NODE_OPACITY_MULTIPLIER, normalize_node_opacity_multiplier);
	hide_active_outline = load_setting(SETTING_HIDE_ACTIVE_OUTLINE_ID, DEFAULT_HIDE_ACTIVE_OUTLINE, normalize_hide_active_outline);

	app.ui.settings.addSetting({
		id: SETTING_MOVE_MODE_ID,
		category: build_setting_category("Crosshairs on move"),
		name: "Crosshairs on move",
		type: "combo",
		options: [
			{ text: "Off", value: "off" },
			{ text: "All corners", value: "all" }
		],
		defaultValue: move_mode,
		onChange: (new_value) =>
		{
			move_mode = normalize_move_mode(new_value);
			save_setting(SETTING_MOVE_MODE_ID, move_mode);
			request_canvas_redraw();
		}
	});

	app.ui.settings.addSetting({
		id: SETTING_RESIZE_MODE_ID,
		category: build_setting_category("Crosshairs on resize"),
		name: "Crosshairs on resize",
		type: "combo",
		options: [
			{ text: "Off", value: "off" },
			{ text: "Selected corner", value: "selected" },
			{ text: "All corners", value: "all" }
		],
		defaultValue: resize_mode,
		onChange: (new_value) =>
		{
			resize_mode = normalize_resize_mode(new_value);
			save_setting(SETTING_RESIZE_MODE_ID, resize_mode);
			request_canvas_redraw();
		}
	});

	app.ui.settings.addSetting({
		id: SETTING_IDLE_MODE_ID,
		category: build_setting_category("Crosshairs when idle"),
		name: "Crosshairs when idle",
		type: "combo",
		options: [
			{ text: "Off", value: "off" },
			{ text: "All corners", value: "all" }
		],
		defaultValue: idle_mode,
		onChange: (new_value) =>
		{
			idle_mode = normalize_idle_mode(new_value);
			save_setting(SETTING_IDLE_MODE_ID, idle_mode);
			request_canvas_redraw();
		}
	});

	app.ui.settings.addSetting({
		id: SETTING_COLOR_ID,
		category: build_setting_category("Crosshair color"),
		name: "Crosshair color",
		type: "text",
		defaultValue: line_color,
		attrs: {
			placeholder: "#0B8CE9",
			title: "Accepts CSS color values like #RRGGBB, rgb(...), or named colors."
		},
		onChange: (new_value) =>
		{
			line_color = normalize_line_color(new_value);
			save_setting(SETTING_COLOR_ID, line_color);
			request_canvas_redraw();
		}
	});

	app.ui.settings.addSetting({
		id: SETTING_THICKNESS_ID,
		category: build_setting_category("Crosshair thickness"),
		name: "Crosshair thickness",
		type: "number",
		defaultValue: line_width,
		attrs: { min: 0.5, step: 0.1 },
		onChange: (new_value) =>
		{
			line_width = normalize_line_width(new_value);
			save_setting(SETTING_THICKNESS_ID, line_width);
			request_canvas_redraw();
		}
	});

	app.ui.settings.addSetting({
		id: SETTING_LINK_OPACITY_ID,
		category: build_setting_category("Opacity (links) while moving/resizing"),
		name: "Opacity (links) while moving/resizing",
		type: "text",
		defaultValue: String(link_opacity_multiplier),
		attrs: { inputmode: "decimal", placeholder: "0-1" },
		onChange: (new_value) =>
		{
			link_opacity_multiplier = normalize_link_opacity_multiplier(new_value);
			save_setting(SETTING_LINK_OPACITY_ID, link_opacity_multiplier);
			request_canvas_redraw();
		}
	});

	app.ui.settings.addSetting({
		id: SETTING_NODE_OPACITY_ID,
		category: build_setting_category("Opacity (nodes) while moving/resizing"),
		name: "Opacity (nodes) while moving/resizing",
		type: "text",
		defaultValue: String(node_opacity_multiplier),
		attrs: { inputmode: "decimal", placeholder: "0-1" },
		onChange: (new_value) =>
		{
			node_opacity_multiplier = normalize_node_opacity_multiplier(new_value);
			save_setting(SETTING_NODE_OPACITY_ID, node_opacity_multiplier);
			request_canvas_redraw();
		}
	});

	app.ui.settings.addSetting({
		id: SETTING_HIDE_ACTIVE_OUTLINE_ID,
		category: build_setting_category("Hide active outline while moving/resizing"),
		name: "Hide active outline while moving/resizing",
		type: "boolean",
		defaultValue: hide_active_outline,
		onChange: (new_value) =>
		{
			hide_active_outline = normalize_hide_active_outline(new_value);
			save_setting(SETTING_HIDE_ACTIVE_OUTLINE_ID, hide_active_outline);
			request_canvas_redraw();
		}
	});

	schedule_link_opacity_input_patch();
	install_link_opacity_input_observer();

	return true;
}

function install_guidelines(canvas_override)
{
	const canvas = canvas_override || app?.canvas;
	if (!canvas)
	{
		return false;
	}
	if (canvas.__crosshair_guidelines_installed)
	{
		return true;
	}
	canvas.__crosshair_guidelines_installed = true;
	canvas.__crosshair_force_hide_until = Date.now() + INITIAL_HIDE_MS;
	register_canvas(canvas);
	install_link_draw_override(canvas);
	install_node_draw_override(canvas);
	install_active_outline_hide_patch(canvas);
	install_pointer_listeners(canvas);
	install_global_pointer_listeners(canvas);

	const previous_mouse_down = canvas.onMouseDown;
	canvas.onMouseDown = function(event)
	{
		if (typeof previous_mouse_down === "function")
		{
			previous_mouse_down.call(this, event);
		}
		update_multi_select_modifier(this, event);
		this.__crosshair_mouse_down = true;
		this.__crosshair_dragging = false;
		this.__crosshair_pointer_on_input = is_interactive_input_target(event?.target);
		this.__crosshair_pointer_on_connection = is_connection_handle_target(event?.target);
		const screen_point = get_event_screen_point(event, this, true) || [0, 0];
		const graph_point = get_event_graph_point(this, event)
			|| get_graph_mouse(this)
			|| screen_point_to_graph(this, screen_point);
		const near_connection_node = graph_point ? get_node_near_connection_slot(this, graph_point) : null;
		this.__crosshair_pointer_node = screen_point
			? (get_node_at_screen_point(this, screen_point)
				|| (graph_point ? get_node_at_graph_point(this, graph_point) : null)
				|| near_connection_node)
			: ((graph_point ? get_node_at_graph_point(this, graph_point) : null) || near_connection_node);
		if (this.__crosshair_pointer_node
			&& !this.__crosshair_pointer_on_input
			&& !this.__crosshair_pointer_on_connection)
		{
			this.__crosshair_latched_pointer_node = this.__crosshair_pointer_node;
		}
		if (!this.__crosshair_pointer_on_connection && graph_point && (this.__crosshair_pointer_node || near_connection_node))
		{
			const slot_node = this.__crosshair_pointer_node || near_connection_node;
			this.__crosshair_pointer_on_connection = is_pointer_near_connection_slot(this, slot_node, graph_point);
		}
		if (!this.__crosshair_pointer_on_connection && has_connection_drag(this))
		{
			this.__crosshair_pointer_on_connection = true;
		}
		this.__crosshair_pointer_dragging = false;
		set_pointer_down(this, true, screen_point);
		this.__crosshair_drag_start = screen_point;
		this.__crosshair_last_mouse = screen_point;
		this.__crosshair_last_mouse_screen = screen_point;
		if (graph_point)
		{
			this.__crosshair_last_mouse_graph = graph_point;
		}
		const selected_nodes = get_selected_nodes(this).filter((node) => !!node);
		const selected_group = get_selected_group(this);
		this.__crosshair_group_resize_latched = !!(selected_group && is_point_near_bottom_right(this, get_group_bounds(selected_group)));
		this.__crosshair_group_resize_target = this.__crosshair_group_resize_latched ? selected_group : null;
		const resize_candidates = collect_resize_candidates(this);
		latch_node_resize_candidate(this, resize_candidates, graph_point, screen_point);
		this.__crosshair_drag_node_target = get_drag_node_target(this, screen_point, graph_point);
		this.__crosshair_drag_start_on_selected = !!screen_point
			&& selected_nodes.some((node) => is_screen_point_inside_node(this, node, screen_point));
		const drag_start_on_group = !!screen_point
			&& !!selected_group
			&& is_screen_point_inside_group(this, selected_group, screen_point);
		this.__crosshair_drag_group_target = drag_start_on_group ? selected_group : null;
		request_canvas_redraw();
	};

	const previous_mouse_move = canvas.onMouseMove;
	canvas.onMouseMove = function(event)
	{
		if (typeof previous_mouse_move === "function")
		{
			previous_mouse_move.call(this, event);
		}
		update_multi_select_modifier(this, event);
		record_pointer_activity(this);
		if (!this.__crosshair_mouse_down)
		{
			return;
		}
		const screen_point = get_event_screen_point(event, this, true)
			|| this.__crosshair_last_mouse_screen
			|| this.__crosshair_last_mouse
			|| [0, 0];
		const graph_point = get_event_graph_point(this, event)
			|| screen_point_to_graph(this, screen_point)
			|| get_graph_mouse(this);
		if (!this.__crosshair_pointer_down_pos)
		{
			this.__crosshair_pointer_down_pos = screen_point;
		}
		const start = this.__crosshair_drag_start || screen_point;
		const dx = screen_point[0] - start[0];
		const dy = screen_point[1] - start[1];
		const distance = Math.sqrt((dx * dx) + (dy * dy));
		this.__crosshair_last_mouse = screen_point;
		this.__crosshair_last_mouse_screen = screen_point;
		if (graph_point)
		{
			this.__crosshair_last_mouse_graph = graph_point;
		}
		update_pointer_dragging(this, DRAG_THRESHOLD_PX);
		if (!this.__crosshair_dragging && distance >= DRAG_THRESHOLD_PX)
		{
			this.__crosshair_dragging = true;
			request_canvas_redraw(this);
		}
	};

	const previous_mouse_up = canvas.onMouseUp;
	canvas.onMouseUp = function(event)
	{
		if (typeof previous_mouse_up === "function")
		{
			previous_mouse_up.call(this, event);
		}
		reset_interaction_state(this);
	};

	const previous_mouse_leave = canvas.onMouseLeave;
	canvas.onMouseLeave = function(event)
	{
		if (typeof previous_mouse_leave === "function")
		{
			previous_mouse_leave.call(this, event);
		}
		reset_interaction_state(this);
	};

	const previous_draw = canvas.onDrawForeground;
	canvas.onDrawForeground = function(ctx, visible_rect)
	{
		if (typeof previous_draw === "function")
		{
			previous_draw.call(this, ctx, visible_rect);
		}

		try
		{
			register_canvas(this);
			install_link_draw_override(this);
			install_node_draw_override(this);
			install_active_outline_hide_patch(this);
			const interaction_state = ensure_interaction_state(this, ctx);
			if (!interaction_state || !interaction_state.can_draw)
			{
				return;
			}
			const {
				has_resize_targets,
				has_move_targets,
				resize_node_active,
				has_resize_corner,
				resize_node_candidate,
				resize_corner_hint,
				drag_node_target,
				allow_selected_fallback,
				selected_nodes,
				selected_group,
				active_resize_group,
				resize_group_bounds,
				move_active,
				dragging_nodes_fallback,
				drag_group,
				drag_active,
				pointer_active,
				has_idle_selection
			} = interaction_state;

			const grid_size = is_snap_enabled() ? get_grid_size() : 0;

			if (resize_node_active || has_resize_corner)
			{
				if (resize_mode === "off")
				{
					return;
				}
				const target_node = resize_node_candidate
					|| drag_node_target
					|| (allow_selected_fallback && selected_nodes.length === 1 ? selected_nodes[0] : null);
				if (!target_node)
				{
					return;
				}
				const bounds = get_node_bounds(target_node);
				if (resize_mode === "all")
				{
					draw_guidelines_at(ctx, this, [bounds.left, bounds.top], visible_rect);
					draw_guidelines_at(ctx, this, [bounds.right, bounds.top], visible_rect);
					draw_guidelines_at(ctx, this, [bounds.left, bounds.bottom], visible_rect);
					draw_guidelines_at(ctx, this, [bounds.right, bounds.bottom], visible_rect);
				}
				else
				{
					let corner = get_active_resize_corner(this, bounds);
					if (resize_corner_hint)
					{
						corner = resize_corner_hint;
					}
					if (this.__crosshair_node_resize_latched && this.__crosshair_node_resize_corner)
					{
						corner = this.__crosshair_node_resize_corner;
					}
					corner = corner || "bottom_right";
					let point = get_corner_point(bounds, corner) || [bounds.right, bounds.bottom];
					if (grid_size)
					{
						point = [
							snap_value(point[0], grid_size),
							snap_value(point[1], grid_size)
						];
					}
					draw_guidelines_at(ctx, this, point, visible_rect);
				}
				return;
			}

			if (active_resize_group)
			{
				if (resize_mode === "off")
				{
					return;
				}
				const bounds = resize_group_bounds || get_group_bounds(active_resize_group);
				if (!bounds)
				{
					return;
				}
				if (resize_mode === "all")
				{
					draw_guidelines_at(ctx, this, [bounds.left, bounds.top], visible_rect);
					draw_guidelines_at(ctx, this, [bounds.right, bounds.top], visible_rect);
					draw_guidelines_at(ctx, this, [bounds.left, bounds.bottom], visible_rect);
					draw_guidelines_at(ctx, this, [bounds.right, bounds.bottom], visible_rect);
				}
				else
				{
					let point = [bounds.right, bounds.bottom];
					if (grid_size)
					{
						point = [
							snap_value(point[0], grid_size),
							snap_value(point[1], grid_size)
						];
					}
					draw_guidelines_at(ctx, this, point, visible_rect);
				}
				return;
			}

			if (move_active && (drag_node_target || dragging_nodes_fallback))
			{
				if (move_mode === "off")
				{
					return;
				}
				const node_list = drag_node_target
					? [drag_node_target]
					: (selected_nodes.length ? selected_nodes : []);
				for (const node of node_list)
				{
					if (!node)
					{
						continue;
					}
					const bounds = snap_node_bounds_by_position(node, grid_size);
					draw_guidelines_at(ctx, this, [bounds.left, bounds.top], visible_rect);
					draw_guidelines_at(ctx, this, [bounds.right, bounds.top], visible_rect);
					draw_guidelines_at(ctx, this, [bounds.left, bounds.bottom], visible_rect);
					draw_guidelines_at(ctx, this, [bounds.right, bounds.bottom], visible_rect);
				}
			}

			if (move_active && drag_group)
			{
				if (move_mode === "off")
				{
					return;
				}
				const bounds = snap_bounds_by_position(get_group_bounds(drag_group), grid_size);
				if (!bounds)
				{
					return;
				}
				draw_guidelines_at(ctx, this, [bounds.left, bounds.top], visible_rect);
				draw_guidelines_at(ctx, this, [bounds.right, bounds.top], visible_rect);
				draw_guidelines_at(ctx, this, [bounds.left, bounds.bottom], visible_rect);
				draw_guidelines_at(ctx, this, [bounds.right, bounds.bottom], visible_rect);
			}

			if (idle_mode === "all" && !drag_active && !pointer_active)
			{
				if (selected_nodes.length > 0)
				{
					for (const node of selected_nodes)
					{
						if (!node)
						{
							continue;
						}
						const bounds = snap_node_bounds_by_position(node, grid_size);
						draw_guidelines_at(ctx, this, [bounds.left, bounds.top], visible_rect);
						draw_guidelines_at(ctx, this, [bounds.right, bounds.top], visible_rect);
						draw_guidelines_at(ctx, this, [bounds.left, bounds.bottom], visible_rect);
						draw_guidelines_at(ctx, this, [bounds.right, bounds.bottom], visible_rect);
					}
					return;
				}

				if (selected_group)
				{
					const bounds = snap_bounds_by_position(get_group_bounds(selected_group), grid_size);
					if (!bounds)
					{
						return;
					}
					draw_guidelines_at(ctx, this, [bounds.left, bounds.top], visible_rect);
					draw_guidelines_at(ctx, this, [bounds.right, bounds.top], visible_rect);
					draw_guidelines_at(ctx, this, [bounds.left, bounds.bottom], visible_rect);
					draw_guidelines_at(ctx, this, [bounds.right, bounds.bottom], visible_rect);
				}
			}
		}
		catch (err)
		{
			if (!this.__crosshair_draw_error_reported)
			{
				this.__crosshair_draw_error_reported = true;
				if (typeof console !== "undefined" && typeof console.error === "function")
				{
					console.error("[crosshair_guidelines] draw failed", err);
				}
			}
		}
	};

	return true;
}

app.registerExtension({
	name: EXTENSION_NAME,
	async setup()
	{
		if (app?.ui?.settings?.setup)
		{
			await app.ui.settings.setup;
		}

		const attempt_install = () =>
		{
			const settings_ready = install_setting();
			const guidelines_ready = install_guidelines();
			if (!settings_ready || !guidelines_ready)
			{
				requestAnimationFrame(attempt_install);
			}
		};
		attempt_install();
		install_canvas_watch();
	}
});
