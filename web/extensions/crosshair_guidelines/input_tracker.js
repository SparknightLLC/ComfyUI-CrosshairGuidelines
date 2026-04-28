import { get_graph_nodes } from "./graph_targets.js";

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

const SLOT_LABEL_HITBOX_PX = 88;
const SLOT_ROW_HITBOX_PX = 20;
const SLOT_HANDLE_HITBOX_PX = 10;
const SLOT_HANDLE_HITBOX_COMPACT_PX = 6;
const SLOT_LABEL_EDGE_HITBOX_PX = 26;

export function is_interactive_input_target(target)
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

export function has_connection_drag(canvas)
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

export function is_connection_handle_target(target)
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

export function is_node_collapsed_for_slots(node)
{
	if (!node || typeof node !== "object")
	{
		return false;
	}
	return !!(node.flags?.collapsed || node.collapsed || node._collapsed);
}

export function get_slot_label_text(node, slot)
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

export function estimate_slot_label_span_px(text)
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

export function is_pointer_near_output_slot(canvas, node, graph_point)
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

export function is_pointer_near_input_slot(canvas, node, graph_point)
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

export function is_pointer_near_connection_slot(canvas, node, graph_point)
{
	return is_pointer_near_output_slot(canvas, node, graph_point)
		|| is_pointer_near_input_slot(canvas, node, graph_point);
}

export function get_node_near_connection_slot(canvas, graph_point)
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

export function is_graph_event_target(event, graph_event_selectors)
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
	const selectors = Array.isArray(graph_event_selectors) ? graph_event_selectors : [];
	for (const selector of selectors)
	{
		if (selector && target.closest(selector))
		{
			return true;
		}
	}
	return false;
}

export function is_multi_select_modifier_event(event)
{
	return !!(event?.ctrlKey || event?.metaKey);
}

export function update_multi_select_modifier(canvas, event)
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

export function is_multi_select_modifier_active(canvas)
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

export function is_selection_rectangle_active(canvas)
{
	if (!canvas)
	{
		return false;
	}
	return !!canvas.dragging_rectangle
		|| !!canvas.draggingRectangle
		|| !!canvas.dragging_selection_rectangle
		|| !!canvas.draggingSelectionRectangle
		|| !!canvas.dragging_selection
		|| !!canvas.draggingSelection;
}
