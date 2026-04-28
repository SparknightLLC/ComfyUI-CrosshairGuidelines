const DIAGNOSTICS_STORAGE_KEY = "crosshair_guidelines.diagnostics";
const DIAGNOSTICS_WINDOW_KEY = "__crosshair_guidelines_diagnostics";

function is_truthy_diagnostic_value(value)
{
	if (value === true || value === 1)
	{
		return true;
	}
	if (typeof value !== "string")
	{
		return false;
	}
	const normalized = value.trim().toLowerCase();
	return normalized === "true"
		|| normalized === "1"
		|| normalized === "yes"
		|| normalized === "on";
}

export function are_diagnostics_enabled()
{
	if (typeof window !== "undefined" && is_truthy_diagnostic_value(window[DIAGNOSTICS_WINDOW_KEY]))
	{
		return true;
	}
	if (typeof localStorage === "undefined")
	{
		return false;
	}
	try
	{
		return is_truthy_diagnostic_value(localStorage.getItem(DIAGNOSTICS_STORAGE_KEY));
	}
	catch (err)
	{
		return false;
	}
}

export function diagnostic_log(...args)
{
	if (!are_diagnostics_enabled()
		|| typeof console === "undefined"
		|| typeof console.debug !== "function")
	{
		return;
	}
	console.debug("[crosshair_guidelines]", ...args);
}

export function diagnostic_warn(...args)
{
	if (!are_diagnostics_enabled()
		|| typeof console === "undefined"
		|| typeof console.warn !== "function")
	{
		return;
	}
	console.warn("[crosshair_guidelines]", ...args);
}
