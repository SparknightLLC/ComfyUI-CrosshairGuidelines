export function has_ctrl_show_interaction_candidate(input)
{
	return !!input?.pointer_down
		&& !input.selection_rectangle_active
		&& !input.connecting_node
		&& !input.pointer_on_input
		&& !input.pointer_on_connection
		&& (
			!!input.drag_node_target
			|| !!input.resize_node_candidate
			|| !!input.drag_group_target
			|| !!input.active_resize_group
			|| !!input.latched_drag_node_target
			|| !!input.latched_drag_group_target
			|| !!input.node_resize_latched
			|| !!input.group_resize_latched
			|| !!input.pointer_node
			|| !!input.latched_pointer_node
		);
}

export function resolve_ctrl_visibility_policy(input)
{
	const ctrl_behavior = input?.ctrl_behavior || "off";
	const selected_interaction_active = !!input?.selected_interaction_active;
	const modifier_active = !!input?.modifier_active;
	const ctrl_show_interaction_candidate = has_ctrl_show_interaction_candidate(input);
	const ctrl_show_mode = ctrl_behavior === "show" && selected_interaction_active;
	const ctrl_hide_mode = ctrl_behavior === "hide" && selected_interaction_active;
	const hide_crosshairs = (ctrl_hide_mode && modifier_active)
		|| (ctrl_show_mode && !modifier_active)
		|| (ctrl_behavior === "show" && ctrl_show_interaction_candidate && !modifier_active);
	const force_show_crosshairs = ctrl_show_mode && modifier_active;
	const hold_fallback_active = force_show_crosshairs
		&& !!input?.pointer_down
		&& !input?.has_resize_targets
		&& !input?.has_move_targets
		&& (!!input?.has_selected_nodes || !!input?.has_selected_group);

	return {
		hide_crosshairs,
		force_show_crosshairs,
		hold_fallback_active,
		show_interaction_candidate: ctrl_show_interaction_candidate
	};
}
