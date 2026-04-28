const RESIZE_SESSION_KEY = "__crosshair_resize_session";
const LEGACY_RESIZE_SESSION_TARGET_KEY = "__crosshair_node_resize_session_target";
const LEGACY_RESIZE_SESSION_CORNER_KEY = "__crosshair_node_resize_session_corner";

function get_now()
{
	if (typeof performance !== "undefined" && typeof performance.now === "function")
	{
		return performance.now();
	}
	return Date.now();
}

function normalize_resize_corner(value)
{
	if (value === "top_left"
		|| value === "top_right"
		|| value === "bottom_left"
		|| value === "bottom_right")
	{
		return value;
	}
	return null;
}

function sync_legacy_resize_session(canvas, session)
{
	if (!canvas)
	{
		return;
	}
	canvas[LEGACY_RESIZE_SESSION_TARGET_KEY] = session?.target || null;
	canvas[LEGACY_RESIZE_SESSION_CORNER_KEY] = session?.corner || null;
}

export function clear_resize_session(canvas)
{
	if (!canvas)
	{
		return;
	}
	canvas[RESIZE_SESSION_KEY] = null;
	sync_legacy_resize_session(canvas, null);
}

export function get_resize_session(canvas)
{
	if (!canvas)
	{
		return null;
	}
	const session = canvas[RESIZE_SESSION_KEY];
	if (session?.target)
	{
		return session;
	}
	const legacy_target = canvas[LEGACY_RESIZE_SESSION_TARGET_KEY];
	if (!legacy_target)
	{
		return null;
	}
	return {
		target: legacy_target,
		corner: normalize_resize_corner(canvas[LEGACY_RESIZE_SESSION_CORNER_KEY]),
		started_at: null
	};
}

export function get_resize_session_target(canvas)
{
	return get_resize_session(canvas)?.target || null;
}

export function get_resize_session_corner(canvas)
{
	return get_resize_session(canvas)?.corner || null;
}

export function has_resize_session(canvas)
{
	return !!get_resize_session_target(canvas);
}

export function start_or_update_resize_session(canvas, target, corner)
{
	if (!canvas || !target)
	{
		return null;
	}
	const normalized_corner = normalize_resize_corner(corner);
	const current = get_resize_session(canvas);
	const target_changed = current?.target && current.target !== target;
	const next_session = {
		target,
		corner: target_changed
			? normalized_corner
			: (current?.corner || normalized_corner || null),
		started_at: target_changed || !current?.started_at
			? get_now()
			: current.started_at
	};
	canvas[RESIZE_SESSION_KEY] = next_session;
	sync_legacy_resize_session(canvas, next_session);
	return next_session;
}
