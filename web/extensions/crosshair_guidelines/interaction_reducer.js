import {
	get_graph_mouse,
	get_node_at_graph_point,
	get_node_at_screen_point
} from "./graph_coordinates.js";
import { get_group_bounds } from "./graph_geometry.js";
import {
	collect_nodes_in_group,
	detect_graph_activity
} from "./graph_activity.js";
import {
	get_active_group_from_canvas,
	get_active_node_from_canvas,
	get_canvas_drag_group,
	get_canvas_drag_node,
	get_canvas_resize_group,
	get_canvas_resize_node,
	get_group_identifier,
	get_node_identifier,
	has_group_resize_flags
} from "./graph_targets.js";
import {
	get_selected_group,
	get_selected_nodes,
	has_selected_interaction_latch,
	is_selected_node_match
} from "./graph_selection.js";
import {
	has_connection_drag,
	is_multi_select_modifier_active,
	is_selection_rectangle_active
} from "./input_tracker.js";
import {
	capture_selected_start_candidate,
	update_selected_interaction_latch
} from "./interaction_latch.js";
import { resolve_ctrl_visibility_policy } from "./interaction_policy.js";
import { clear_interaction_visuals } from "./interaction_state.js";
import {
	clear_resize_session,
	get_resize_session_corner,
	get_resize_session_target,
	start_or_update_resize_session
} from "./resize_session.js";
import {
	clear_opacity_state,
	OPACITY_KEYS,
	update_opacity
} from "./opacity_state.js";
import {
	apply_dom_node_opacity,
	apply_dom_outline_visibility,
	build_exempt_node_bounds,
	collect_id_set
} from "./opacity_adapter.js";
import { settings_state } from "./settings.js";
export function compute_interaction_state(canvas, ctx, deps = {})
{
	if (!canvas)
	{
		return null;
	}

	const {
		drag_threshold_px,
		pointer_idle_reset_ms,
		interaction_state_options,
		get_global_pointer_down,
		get_global_pointer_on_input,
		get_global_pointer_on_connection
	} = deps;

	canvas.__crosshair_interaction_active = false;
	canvas.__crosshair_hide_active_outline = false;

	const mouse_screen = canvas.__crosshair_last_mouse_screen || canvas.__crosshair_last_mouse;
	const now = Date.now();
	if (Number.isFinite(canvas.__crosshair_force_hide_until)
		&& now < canvas.__crosshair_force_hide_until
		&& settings_state.idle_mode !== "all")
	{
		return clear_interaction_visuals(canvas, ctx, interaction_state_options);
	}

	let dragging_by_distance = false;
	if (canvas.__crosshair_mouse_down && mouse_screen && canvas.__crosshair_drag_start)
	{
		const dx = mouse_screen[0] - canvas.__crosshair_drag_start[0];
		const dy = mouse_screen[1] - canvas.__crosshair_drag_start[1];
		dragging_by_distance = (dx * dx + dy * dy) >= (drag_threshold_px * drag_threshold_px);
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
		if (age > pointer_idle_reset_ms && !canvas.__crosshair_mouse_down && !get_global_pointer_down())
		{
			canvas.__crosshair_pointer_down = false;
			canvas.__crosshair_pointer_dragging = false;
			canvas.__crosshair_pointer_down_pos = null;
			canvas.__crosshair_pointer_on_input = false;
			canvas.__crosshair_pointer_on_connection = false;
			canvas.__crosshair_pointer_node = null;
			canvas.__crosshair_selected_interaction_latched = false;
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
	const modifier_active = is_multi_select_modifier_active(canvas);
	let selected_nodes = [];
	let selected_group = null;
	if (pointer_down_now || settings_state.idle_mode === "all")
	{
		selected_nodes = get_selected_nodes(canvas).filter((node) => !!node);
		selected_group = get_selected_group(canvas);
	}
	if (pointer_down_now)
	{
		if (!canvas.__crosshair_selected_start_candidate_captured)
		{
			capture_selected_start_candidate(canvas, selected_nodes, selected_group, mouse_screen, get_graph_mouse(canvas));
		}
		update_selected_interaction_latch(canvas, selected_nodes, selected_group, mouse_screen);
	}
	else
	{
		canvas.__crosshair_selected_interaction_latched = false;
		canvas.__crosshair_selected_start_candidate = false;
		canvas.__crosshair_selected_start_candidate_captured = false;
	}
	let selected_interaction_latched = pointer_down_now && has_selected_interaction_latch(canvas);
	const selection_rectangle_active = is_selection_rectangle_active(canvas);
	if (modifier_active && selection_rectangle_active)
	{
		canvas.__crosshair_pointer_node = null;
		canvas.__crosshair_drag_node_target = null;
		canvas.__crosshair_drag_group_target = null;
		canvas.__crosshair_node_resize_latched = false;
		canvas.__crosshair_node_resize_target = null;
		canvas.__crosshair_node_resize_corner = null;
		clear_resize_session(canvas);
		canvas.__crosshair_selected_interaction_latched = false;
		canvas.__crosshair_selected_start_candidate = false;
		canvas.__crosshair_selected_start_candidate_captured = false;
		canvas.__crosshair_active_target = null;
		return clear_interaction_visuals(canvas, ctx, interaction_state_options);
	}
	if (modifier_active && !(settings_state.ctrl_behavior !== "off" && selected_interaction_latched))
	{
		const explicit_move_or_resize = !!get_canvas_drag_node(canvas)
			|| !!get_canvas_resize_node(canvas)
			|| !!get_canvas_drag_group(canvas)
			|| !!get_canvas_resize_group(canvas)
			|| has_group_resize_flags(canvas)
			|| !!canvas.__crosshair_drag_start_on_selected
			|| !!canvas.__crosshair_drag_group_target
			|| !!canvas.__crosshair_node_resize_latched
			|| !!canvas.__crosshair_group_resize_latched;
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
			clear_resize_session(canvas);
			canvas.__crosshair_selected_interaction_latched = false;
			canvas.__crosshair_selected_start_candidate = false;
			canvas.__crosshair_selected_start_candidate_captured = false;
			canvas.__crosshair_active_target = null;
			return clear_interaction_visuals(canvas, ctx, interaction_state_options);
		}
	}
	if (pointer_down_now && !has_local_pointer && get_global_pointer_on_input())
	{
		canvas.__crosshair_pointer_node = null;
		canvas.__crosshair_pointer_on_input = false;
		return clear_interaction_visuals(canvas, ctx, interaction_state_options);
	}
	if (pointer_down_now && !has_local_pointer && get_global_pointer_on_connection())
	{
		canvas.__crosshair_pointer_node = null;
		canvas.__crosshair_pointer_on_connection = false;
		return clear_interaction_visuals(canvas, ctx, interaction_state_options);
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
		return clear_interaction_visuals(canvas, ctx, interaction_state_options);
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
			clear_resize_session(canvas);
			canvas.__crosshair_drag_start_on_selected = false;
			canvas.__crosshair_selected_interaction_latched = false;
			canvas.__crosshair_selected_start_candidate = false;
			canvas.__crosshair_selected_start_candidate_captured = false;
			canvas.__crosshair_drag_start = null;
			canvas.__crosshair_global_pointer_latched = true;
		}
	}
	else if (!pointer_down_now)
	{
		canvas.__crosshair_global_pointer_latched = false;
	}
	if (!pointer_down_now && settings_state.idle_mode !== "all")
	{
		return clear_interaction_visuals(canvas, ctx, interaction_state_options);
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
	let resize_session_target = get_resize_session_target(canvas);
	let resize_session_corner = get_resize_session_corner(canvas);
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
	if (drag_start_on_selected)
	{
		canvas.__crosshair_drag_start_on_selected = true;
		canvas.__crosshair_selected_interaction_latched = true;
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
		resize_session_target = resize_session_target
			|| resize_node_candidate
			|| activity?.resize_node
			|| drag_node_target;
		resize_session_corner = resize_session_corner
			|| resize_corner_hint
			|| canvas.__crosshair_node_resize_corner
			|| activity?.resize_corner;
		const resize_session = start_or_update_resize_session(canvas, resize_session_target, resize_session_corner);
		if (resize_session)
		{
			resize_session_target = resize_session.target;
			resize_session_corner = resize_session.corner;
		}
	}
	else if (!pointer_down_now)
	{
		clear_resize_session(canvas);
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
	const has_explicit_group_action = !!resize_group
		|| !!drag_group_target
		|| (pointer_active && !!canvas.__crosshair_group_resize_latched)
		|| !!get_canvas_drag_group(canvas)
		|| !!get_canvas_resize_group(canvas);
	const has_latched_resize = (!!canvas.__crosshair_node_resize_latched && !!canvas.__crosshair_node_resize_target)
		|| !!resize_session_target;
	if (has_explicit_group_action && !has_latched_resize)
	{
		resize_node_candidate = null;
		resize_corner_hint = null;
		drag_node_target = null;
	}
	else if (has_group_activity && !has_explicit_node_action && !has_latched_resize)
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
	const selected_nodes_set = selected_nodes.length > 0 ? new Set(selected_nodes) : null;
	const started_on_selected_node = !!canvas.__crosshair_drag_start_on_selected;
	const selected_drag_node_target = !!drag_node_target
		&& (started_on_selected_node
			|| is_selected_node_match(drag_node_target, selected_nodes_set));
	const selected_resize_node_target = !!resize_node_candidate
		&& (started_on_selected_node
			|| is_selected_node_match(resize_node_candidate, selected_nodes_set));
	const selected_node_move_or_resize = !!dragging_nodes_fallback
		|| selected_drag_node_target
		|| selected_resize_node_target;
	const selected_group_move_or_resize = !!selected_group
		&& ((active_resize_group && active_resize_group === selected_group)
			|| (drag_group && drag_group === selected_group));
	const selected_start_candidate = pointer_down_now
		&& !!canvas.__crosshair_selected_start_candidate;
	if (pointer_down_now && (selected_node_move_or_resize || selected_group_move_or_resize || selected_start_candidate))
	{
		canvas.__crosshair_selected_interaction_latched = true;
	}
	selected_interaction_latched = pointer_down_now && has_selected_interaction_latch(canvas);
	const selected_move_or_resize_active = pointer_down_now
		&& (has_resize_targets || has_move_targets)
		&& (selected_node_move_or_resize || selected_group_move_or_resize);
	const selected_interaction_active = selected_move_or_resize_active
		|| selected_interaction_latched
		|| selected_start_candidate;
	const ctrl_policy = resolve_ctrl_visibility_policy({
		ctrl_behavior: settings_state.ctrl_behavior,
		selected_interaction_active,
		modifier_active,
		pointer_down: pointer_down_now,
		selection_rectangle_active,
		connecting_node,
		pointer_on_input: canvas.__crosshair_pointer_on_input,
		pointer_on_connection: canvas.__crosshair_pointer_on_connection,
		drag_node_target,
		resize_node_candidate,
		drag_group_target,
		active_resize_group,
		latched_drag_node_target: canvas.__crosshair_drag_node_target,
		latched_drag_group_target: canvas.__crosshair_drag_group_target,
		node_resize_latched: canvas.__crosshair_node_resize_latched,
		group_resize_latched: canvas.__crosshair_group_resize_latched,
		pointer_node: canvas.__crosshair_pointer_node,
		latched_pointer_node: canvas.__crosshair_latched_pointer_node,
		has_resize_targets,
		has_move_targets,
		has_selected_nodes: selected_nodes.length > 0,
		has_selected_group: !!selected_group
	});
	const ctrl_hide_crosshairs = ctrl_policy.hide_crosshairs;
	const ctrl_force_show_crosshairs = ctrl_policy.force_show_crosshairs;
	const ctrl_show_hold_fallback_active = ctrl_policy.hold_fallback_active;

	const interaction_active = has_resize_targets || has_move_targets;
	canvas.__crosshair_interaction_active = interaction_active;
	canvas.__crosshair_hide_active_outline = settings_state.hide_active_outline && interaction_active;

	const should_dim_links = settings_state.link_opacity < 1
		&& (has_resize_targets || has_move_targets);
	if (should_dim_links)
	{
		update_opacity(canvas, settings_state.link_opacity, OPACITY_KEYS.links);
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
	const should_dim_nodes = settings_state.node_opacity < 1
		&& (has_resize_targets || has_move_targets);
	if (should_dim_nodes)
	{
		update_opacity(canvas, settings_state.node_opacity, OPACITY_KEYS.nodes);
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

	const can_draw_interaction = has_resize_targets || has_move_targets || ctrl_show_hold_fallback_active;
	const can_draw = !ctrl_hide_crosshairs
		&& (can_draw_interaction || (settings_state.idle_mode === "all" && has_idle_selection));

	return {
		can_draw,
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
	};
}
