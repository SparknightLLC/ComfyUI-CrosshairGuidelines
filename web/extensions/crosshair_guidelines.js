import { app } from "../../../scripts/app.js";
import
	{
		draw_guideline_points,
		get_bounds_guideline_points,
		snap_guideline_point
	} from "./crosshair_guidelines/guideline_renderer.js";
import
	{
		get_group_bounds,
		get_node_bounds,
		get_node_dimensions,
		is_group_like,
		is_group_selected,
		is_node_like,
		is_node_selected,
		is_point_inside_bounds
	} from "./crosshair_guidelines/graph_geometry.js";
import
	{
		get_canvas_element,
		get_event_graph_point,
		get_event_screen_point,
		get_graph_mouse,
		get_node_at_graph_point,
		get_node_at_screen_point,
		is_screen_point_inside_group,
		is_screen_point_inside_node,
		screen_point_to_graph
	} from "./crosshair_guidelines/graph_coordinates.js";
import
	{
		get_active_group_from_canvas,
		get_active_node_from_canvas,
		get_canvas_drag_node,
		get_canvas_resize_node,
		get_group_identifier,
		get_node_identifier,
		has_group_resize_flags
	} from "./crosshair_guidelines/graph_targets.js";
import
	{
		collect_resize_candidates,
		get_active_resize_corner,
		get_corner_point,
		get_drag_node_target,
		is_point_near_bottom_right,
		latch_node_resize_candidate
	} from "./crosshair_guidelines/graph_activity.js";
import
	{
		get_selected_group,
		get_selected_nodes
	} from "./crosshair_guidelines/graph_selection.js";
import
	{
		get_node_near_connection_slot,
		has_connection_drag,
		is_connection_handle_target,
		is_graph_event_target,
		is_interactive_input_target,
		is_multi_select_modifier_event,
		is_pointer_near_connection_slot,
		update_multi_select_modifier
	} from "./crosshair_guidelines/input_tracker.js";
import
	{
		clear_interaction_visuals,
		record_pointer_activity,
		reset_interaction_state,
		set_pointer_down,
		update_pointer_dragging
	} from "./crosshair_guidelines/interaction_state.js";
import
	{
		capture_selected_start_candidate,
		update_selected_interaction_latch
	} from "./crosshair_guidelines/interaction_latch.js";
import { compute_interaction_state } from "./crosshair_guidelines/interaction_reducer.js";
import { clear_resize_session } from "./crosshair_guidelines/resize_session.js";
import
	{
		clear_opacity_state,
		configure_opacity_state,
		OPACITY_KEYS
	} from "./crosshair_guidelines/opacity_state.js";
import
	{
		apply_dom_node_opacity,
		apply_dom_outline_visibility,
		build_exempt_node_bounds,
		collect_id_set,
		DOM_GROUP_SELECTORS,
		DOM_NODE_SELECTORS,
		get_graph_container,
		is_bounds_intersecting_list,
		is_draw_operation_inside_bounds,
		reset_path_bounds,
		update_path_bounds,
	} from "./crosshair_guidelines/opacity_adapter.js";
import
	{
		install_settings,
		settings_state
	} from "./crosshair_guidelines/settings.js";
import
	{
		install_link_opacity_input_observer,
		schedule_link_opacity_input_patch
	} from "./crosshair_guidelines/settings_dom_patch.js";

const EXTENSION_NAME = "comfy.crosshair_guidelines";
const DRAG_THRESHOLD_PX = 4;
const POINTER_IDLE_RESET_MS = 250;
const FORCE_HIDE_AFTER_RELEASE_MS = 120;
const INITIAL_HIDE_MS = 250;
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

if (typeof window !== "undefined")
{
	window.__crosshair_guidelines_loaded = true;
}

const INTERACTION_STATE_OPTIONS = {
	clear_resize_session,
	clear_opacity_state,
	opacity_keys: OPACITY_KEYS,
	request_canvas_redraw: (target_canvas) => request_canvas_redraw(target_canvas),
	apply_dom_node_opacity: (canvas) => apply_dom_node_opacity(canvas),
	apply_dom_outline_visibility: (canvas) => apply_dom_outline_visibility(canvas),
	force_hide_after_release_ms: FORCE_HIDE_AFTER_RELEASE_MS
};
const INTERACTION_REDUCER_DEPS = {
	drag_threshold_px: DRAG_THRESHOLD_PX,
	pointer_idle_reset_ms: POINTER_IDLE_RESET_MS,
	interaction_state_options: INTERACTION_STATE_OPTIONS,
	get_global_pointer_down,
	get_global_pointer_on_input,
	get_global_pointer_on_connection
};

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
	const state = compute_interaction_state(canvas, ctx, INTERACTION_REDUCER_DEPS);
	canvas.__crosshair_state_snapshot = state;
	canvas.__crosshair_state_frame_id = Number.isFinite(frame_id) ? frame_id : null;
	canvas.__crosshair_state_time = now;
	return state;
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
	const width = settings_state.thickness / (scale || 1);

	ctx.save();
	ctx.strokeStyle = settings_state.color;
	ctx.lineWidth = width;
	ctx.beginPath();
	ctx.moveTo(left, point[1]);
	ctx.lineTo(right, point[1]);
	ctx.moveTo(point[0], top);
	ctx.lineTo(point[0], bottom);
	ctx.stroke();
	ctx.restore();
}

function draw_guidelines_for_bounds(ctx, canvas, bounds, visible_rect)
{
	draw_guideline_points(
		draw_guidelines_at,
		ctx,
		canvas,
		get_bounds_guideline_points(bounds),
		visible_rect
	);
}

function draw_guideline_at_point(ctx, canvas, point, visible_rect, grid_size)
{
	draw_guideline_points(
		draw_guidelines_at,
		ctx,
		canvas,
		[snap_guideline_point(point, grid_size, snap_value)],
		visible_rect
	);
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
			const entries = [];
			for (const entry of canvases)
			{
				if (!entry)
				{
					canvases.delete(entry);
					continue;
				}
				const element = get_canvas_element(entry);
				if (element && typeof element.isConnected === "boolean" && !element.isConnected)
				{
					canvases.delete(entry);
					continue;
				}
				entries.push(entry);
			}
			return entries;
		}
		return canvas ? [canvas] : [];
	};
	const redraw_entries = () =>
	{
		const entries = get_entries();
		for (const entry of entries)
		{
			if (!entry)
			{
				continue;
			}
			request_canvas_redraw(entry);
		}
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
		if (!is_graph_event_target(event, GRAPH_EVENT_SELECTORS))
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
			entry.__crosshair_drag_start_on_selected = false;
			entry.__crosshair_node_resize_latched = false;
			entry.__crosshair_node_resize_target = null;
			entry.__crosshair_node_resize_corner = null;
			clear_resize_session(entry);
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
			const selected_nodes = get_selected_nodes(entry).filter((node) => !!node);
			const selected_group = get_selected_group(entry);
			const resize_candidates = collect_resize_candidates(entry);
			latch_node_resize_candidate(entry, resize_candidates, graph_point, screen_point);
			entry.__crosshair_drag_node_target = get_drag_node_target(entry, screen_point, graph_point);
			entry.__crosshair_drag_start_on_selected = !!screen_point
				&& selected_nodes.some((node) => is_screen_point_inside_node(entry, node, screen_point));
			const drag_start_on_group = !!screen_point
				&& !!selected_group
				&& is_screen_point_inside_group(entry, selected_group, screen_point);
			entry.__crosshair_drag_group_target = drag_start_on_group ? selected_group : null;
			entry.__crosshair_group_resize_latched = !!(selected_group && is_point_near_bottom_right(entry, get_group_bounds(selected_group)));
			entry.__crosshair_group_resize_target = entry.__crosshair_group_resize_latched ? selected_group : null;
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
			set_pointer_down(entry, true, screen_point, INTERACTION_STATE_OPTIONS);
			capture_selected_start_candidate(entry, selected_nodes, selected_group, screen_point, graph_point);
			update_selected_interaction_latch(entry, selected_nodes, selected_group, screen_point);
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
				reset_interaction_state(entry, INTERACTION_STATE_OPTIONS);
			}
			window.__crosshair_global_pointer_down = false;
			window.__crosshair_global_pointer_on_input = false;
			window.__crosshair_global_pointer_on_connection = false;
			return;
		}
		reset_interaction_state(canvas, INTERACTION_STATE_OPTIONS);
		window.__crosshair_global_pointer_down = false;
		window.__crosshair_global_pointer_on_input = false;
		window.__crosshair_global_pointer_on_connection = false;
	};
	const on_key_down = (event) =>
	{
		if (event?.key === "Control" || event?.key === "Meta")
		{
			window.__crosshair_multi_select_modifier_down = true;
			const canvases = window.__crosshair_guidelines_canvases;
			if (canvases instanceof Set)
			{
				for (const entry of canvases)
				{
					if (entry)
					{
						entry.__crosshair_multi_select_modifier_down = true;
					}
				}
			}
			redraw_entries();
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
			redraw_entries();
		}
	};
	const on_window_blur = () =>
	{
		reset();
		window.__crosshair_multi_select_modifier_down = false;
	};
	const on_visibility_change = () =>
	{
		if (typeof document !== "undefined" && document.visibilityState === "hidden")
		{
			reset();
			window.__crosshair_multi_select_modifier_down = false;
		}
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
	if (typeof document !== "undefined")
	{
		document.addEventListener("visibilitychange", on_visibility_change, { passive: true });
	}
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
		set_pointer_down(canvas, true, screen_point, INTERACTION_STATE_OPTIONS);
		capture_selected_start_candidate(canvas, selected_nodes, selected_group, screen_point, graph_point);
		update_selected_interaction_latch(canvas, selected_nodes, selected_group, screen_point);
	};

	const on_pointer_up = () =>
	{
		canvas.__crosshair_multi_select_modifier_down = false;
		reset_interaction_state(canvas, INTERACTION_STATE_OPTIONS);
	};

	const on_pointer_cancel = () =>
	{
		canvas.__crosshair_multi_select_modifier_down = false;
		reset_interaction_state(canvas, INTERACTION_STATE_OPTIONS);
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
			reset_interaction_state(canvas, INTERACTION_STATE_OPTIONS);
			return;
		}
		update_pointer_dragging(canvas, DRAG_THRESHOLD_PX);
		record_pointer_activity(canvas);
	};

	const on_pointer_leave = () =>
	{
		reset_interaction_state(canvas, INTERACTION_STATE_OPTIONS);
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

configure_opacity_state({ request_canvas_redraw });

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
					&& settings_state.hide_active_outline
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
				const should_hide_outline = settings_state.hide_active_outline
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
			const should_hide_outline = settings_state.hide_active_outline
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
			const should_hide = settings_state.hide_active_outline
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

function install_setting()
{
	return install_settings(app, request_canvas_redraw, () =>
	{
		schedule_link_opacity_input_patch();
		install_link_opacity_input_observer();
	});
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
		set_pointer_down(this, true, screen_point, INTERACTION_STATE_OPTIONS);
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
		capture_selected_start_candidate(this, selected_nodes, selected_group, screen_point, graph_point);
		update_selected_interaction_latch(this, selected_nodes, selected_group, screen_point);
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
		reset_interaction_state(this, INTERACTION_STATE_OPTIONS);
	};

	const previous_mouse_leave = canvas.onMouseLeave;
	canvas.onMouseLeave = function(event)
	{
		if (typeof previous_mouse_leave === "function")
		{
			previous_mouse_leave.call(this, event);
		}
		reset_interaction_state(this, INTERACTION_STATE_OPTIONS);
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
				has_idle_selection,
				ctrl_force_show_crosshairs,
				ctrl_show_hold_fallback_active
			} = interaction_state;

			const grid_size = is_snap_enabled() ? get_grid_size() : 0;
			const effective_move_mode = ctrl_force_show_crosshairs ? "all" : settings_state.move_mode;
			const effective_resize_mode = ctrl_force_show_crosshairs
				? (settings_state.resize_mode === "off" ? "selected" : settings_state.resize_mode)
				: settings_state.resize_mode;

			if (resize_node_active || has_resize_corner)
			{
				if (effective_resize_mode === "off")
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
				if (effective_resize_mode === "all")
				{
					draw_guidelines_for_bounds(ctx, this, bounds, visible_rect);
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
					const point = get_corner_point(bounds, corner) || [bounds.right, bounds.bottom];
					draw_guideline_at_point(ctx, this, point, visible_rect, grid_size);
				}
				return;
			}

			if (active_resize_group)
			{
				if (effective_resize_mode === "off")
				{
					return;
				}
				const bounds = resize_group_bounds || get_group_bounds(active_resize_group);
				if (!bounds)
				{
					return;
				}
				if (effective_resize_mode === "all")
				{
					draw_guidelines_for_bounds(ctx, this, bounds, visible_rect);
				}
				else
				{
					draw_guideline_at_point(ctx, this, [bounds.right, bounds.bottom], visible_rect, grid_size);
				}
				return;
			}

			if (ctrl_show_hold_fallback_active)
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
						draw_guidelines_for_bounds(ctx, this, bounds, visible_rect);
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
					draw_guidelines_for_bounds(ctx, this, bounds, visible_rect);
					return;
				}
			}

			if (move_active && (drag_node_target || dragging_nodes_fallback))
			{
				if (effective_move_mode === "off")
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
					draw_guidelines_for_bounds(ctx, this, bounds, visible_rect);
				}
			}

			if (move_active && drag_group)
			{
				if (effective_move_mode === "off")
				{
					return;
				}
				const bounds = snap_bounds_by_position(get_group_bounds(drag_group), grid_size);
				if (!bounds)
				{
					return;
				}
				draw_guidelines_for_bounds(ctx, this, bounds, visible_rect);
			}

			if (settings_state.idle_mode === "all" && !drag_active && !pointer_active)
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
						draw_guidelines_for_bounds(ctx, this, bounds, visible_rect);
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
					draw_guidelines_for_bounds(ctx, this, bounds, visible_rect);
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
