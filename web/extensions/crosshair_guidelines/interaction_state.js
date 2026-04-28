function get_option(options, key, fallback = null)
{
	if (!options || typeof options !== "object")
	{
		return fallback;
	}
	return options[key] ?? fallback;
}

export function record_pointer_activity(canvas)
{
	if (!canvas)
	{
		return;
	}
	canvas.__crosshair_pointer_last_time = Date.now();
}

export function set_pointer_down(canvas, is_down, point, options = {})
{
	if (!canvas)
	{
		return;
	}
	const clear_resize_session = get_option(options, "clear_resize_session");
	const request_canvas_redraw = get_option(options, "request_canvas_redraw");
	const force_hide_after_release_ms = get_option(options, "force_hide_after_release_ms", 0);

	canvas.__crosshair_pointer_down = is_down;
	if (is_down)
	{
		canvas.__crosshair_active_target = null;
		canvas.__crosshair_force_hide_until = 0;
		canvas.__crosshair_pointer_dragging = false;
		canvas.__crosshair_dragging = false;
		canvas.__crosshair_selected_interaction_latched = false;
		canvas.__crosshair_selected_start_candidate = false;
		canvas.__crosshair_selected_start_candidate_captured = false;
		canvas.__crosshair_last_node_states = new Map();
		canvas.__crosshair_last_group_states = new Map();
		canvas.__crosshair_activity_last_time = 0;
		canvas.__crosshair_activity_last_result = null;
		canvas.__crosshair_hide_active_outline = false;
		canvas.__crosshair_interaction_active = false;
		canvas.__crosshair_node_opacity_exempt_node_ids = null;
		canvas.__crosshair_node_opacity_exempt_group_ids = null;
		canvas.__crosshair_node_opacity_exempt_bounds = null;
		if (typeof clear_resize_session === "function")
		{
			clear_resize_session(canvas);
		}
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
		if (typeof clear_resize_session === "function")
		{
			clear_resize_session(canvas);
		}
		canvas.__crosshair_drag_node_target = null;
		canvas.__crosshair_drag_group_target = null;
		canvas.__crosshair_drag_start_on_selected = false;
		canvas.__crosshair_selected_interaction_latched = false;
		canvas.__crosshair_selected_start_candidate = false;
		canvas.__crosshair_selected_start_candidate_captured = false;
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
		canvas.__crosshair_force_hide_until = Date.now() + force_hide_after_release_ms;
		if (typeof request_canvas_redraw === "function")
		{
			request_canvas_redraw(canvas);
		}
	}
	record_pointer_activity(canvas);
}

export function clear_interaction_visuals(canvas, ctx, options = {})
{
	if (!canvas)
	{
		return { can_draw: false };
	}
	const clear_opacity_state = get_option(options, "clear_opacity_state");
	const opacity_keys = get_option(options, "opacity_keys", {});
	const apply_dom_node_opacity = get_option(options, "apply_dom_node_opacity");
	const apply_dom_outline_visibility = get_option(options, "apply_dom_outline_visibility");

	if (typeof clear_opacity_state === "function")
	{
		clear_opacity_state(canvas, ctx, opacity_keys.links);
		clear_opacity_state(canvas, ctx, opacity_keys.nodes);
	}
	canvas.__crosshair_node_opacity_active = false;
	canvas.__crosshair_node_opacity_multiplier = 1;
	canvas.__crosshair_node_opacity_exempt_nodes = null;
	canvas.__crosshair_node_opacity_exempt_groups = null;
	canvas.__crosshair_node_opacity_exempt_node_ids = null;
	canvas.__crosshair_node_opacity_exempt_group_ids = null;
	canvas.__crosshair_node_opacity_exempt_bounds = null;
	canvas.__crosshair_interaction_active = false;
	canvas.__crosshair_hide_active_outline = false;
	if (typeof apply_dom_node_opacity === "function")
	{
		apply_dom_node_opacity(canvas);
	}
	if (typeof apply_dom_outline_visibility === "function")
	{
		apply_dom_outline_visibility(canvas);
	}
	return { can_draw: false };
}

export function reset_interaction_state(canvas, options = {})
{
	if (!canvas)
	{
		return;
	}
	const request_canvas_redraw = get_option(options, "request_canvas_redraw");

	canvas.__crosshair_mouse_down = false;
	canvas.__crosshair_dragging = false;
	canvas.__crosshair_last_mouse = null;
	canvas.__crosshair_last_mouse_screen = null;
	canvas.__crosshair_last_mouse_graph = null;
	canvas.__crosshair_drag_start = null;
	canvas.__crosshair_group_resize_latched = false;
	canvas.__crosshair_group_resize_target = null;
	set_pointer_down(canvas, false, null, options);
	clear_interaction_visuals(canvas, null, options);
	if (typeof request_canvas_redraw === "function")
	{
		request_canvas_redraw(canvas);
	}
}

export function update_pointer_dragging(canvas, threshold)
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
