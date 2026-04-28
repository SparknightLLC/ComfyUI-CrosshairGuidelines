export function get_title_height(node)
{
	if (typeof window === "undefined" || !window.LiteGraph || !node || !node.constructor)
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

export function get_node_bounds(node)
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

export function get_node_box_bounds(node)
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

export function is_point_inside_bounds(point, bounds)
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

export function is_node_like(node)
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

export function is_group_like(group)
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

export function is_node_selected(node)
{
	if (!node || typeof node !== "object")
	{
		return false;
	}
	return !!(node.is_selected || node.isSelected || node.selected);
}

export function is_group_selected(group)
{
	if (!group || typeof group !== "object")
	{
		return false;
	}
	return !!(group.is_selected || group.isSelected || group.selected);
}

export function get_node_dimensions(node)
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

export function get_group_bounds(group)
{
	if (!group)
	{
		return null;
	}
	const pos = group._pos || group.pos || [0, 0];
	const size = group._size || group.size || [0, 0];
	return { left: pos[0], top: pos[1], right: pos[0] + size[0], bottom: pos[1] + size[1] };
}

export function get_bounds_state(bounds)
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

export function get_node_activity_state(node)
{
	return get_bounds_state(get_node_box_bounds(node));
}

export function get_group_activity_state(group)
{
	return get_bounds_state(get_group_bounds(group));
}
