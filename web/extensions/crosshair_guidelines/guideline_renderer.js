export function get_bounds_guideline_points(bounds)
{
	if (!bounds)
	{
		return [];
	}
	return [
		[bounds.left, bounds.top],
		[bounds.right, bounds.top],
		[bounds.left, bounds.bottom],
		[bounds.right, bounds.bottom]
	];
}

export function snap_guideline_point(point, grid_size, snap_value)
{
	if (!point || !grid_size || typeof snap_value !== "function")
	{
		return point;
	}
	return [
		snap_value(point[0], grid_size),
		snap_value(point[1], grid_size)
	];
}

export function draw_guideline_points(draw_guideline, ctx, canvas, points, visible_rect)
{
	if (typeof draw_guideline !== "function" || !Array.isArray(points))
	{
		return;
	}
	for (const point of points)
	{
		if (point)
		{
			draw_guideline(ctx, canvas, point, visible_rect);
		}
	}
}
