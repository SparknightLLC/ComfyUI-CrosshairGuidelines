export const OPACITY_KEYS = {
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

let request_opacity_redraw = null;

export function configure_opacity_state(callbacks)
{
	request_opacity_redraw = typeof callbacks?.request_canvas_redraw === "function"
		? callbacks.request_canvas_redraw
		: null;
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
		if (request_opacity_redraw)
		{
			request_opacity_redraw(canvas);
		}
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

export function update_opacity(canvas, target_opacity, keys)
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

export function clear_opacity_state(canvas, ctx, keys)
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
