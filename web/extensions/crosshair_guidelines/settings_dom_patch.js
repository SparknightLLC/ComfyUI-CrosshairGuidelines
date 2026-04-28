import { SETTINGS_IDS } from "./settings.js";

const LINK_OPACITY_INPUT_PATCH_MAX_TRIES = 120;

let link_opacity_input_patch_attempts = 0;

function escape_attribute_value(value)
{
	if (typeof value !== "string")
	{
		return "";
	}
	return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

function find_setting_input_element(setting_id)
{
	if (typeof document === "undefined")
	{
		return null;
	}
	const by_id = document.getElementById(setting_id);
	if (by_id && by_id.tagName === "INPUT")
	{
		return by_id;
	}
	const escaped_id = escape_attribute_value(setting_id);
	const selectors = [
		`[data-setting-id="${escaped_id}"] input`,
		`[data-settingid="${escaped_id}"] input`,
		`[data-setting-id="${escaped_id}"]`,
		`[data-settingid="${escaped_id}"]`
	];
	for (const selector of selectors)
	{
		const node = document.querySelector(selector);
		if (!node)
		{
			continue;
		}
		if (node.tagName === "INPUT")
		{
			return node;
		}
		const nested = node.querySelector("input");
		if (nested)
		{
			return nested;
		}
	}
	return null;
}

function install_link_opacity_input_patch()
{
	const input = find_setting_input_element(SETTINGS_IDS.link_opacity);
	if (!input)
	{
		return false;
	}
	if (input.__crosshair_link_opacity_input_patched)
	{
		return true;
	}
	try
	{
		input.type = "text";
		input.inputMode = "decimal";
		input.autocomplete = "off";
		input.spellcheck = false;
		input.setAttribute("inputmode", "decimal");
		input.setAttribute("pattern", "[0-9]*[\\.,]?[0-9]*");
	}
	catch (err)
	{
	}
	input.__crosshair_link_opacity_input_patched = true;
	return true;
}

export function schedule_link_opacity_input_patch()
{
	if (link_opacity_input_patch_attempts >= LINK_OPACITY_INPUT_PATCH_MAX_TRIES)
	{
		return;
	}
	link_opacity_input_patch_attempts += 1;
	if (install_link_opacity_input_patch())
	{
		return;
	}
	if (typeof requestAnimationFrame === "function")
	{
		requestAnimationFrame(schedule_link_opacity_input_patch);
	}
}

export function install_link_opacity_input_observer()
{
	if (typeof MutationObserver === "undefined" || typeof document === "undefined")
	{
		return;
	}
	if (!document.body)
	{
		return;
	}
	if (document.__crosshair_link_opacity_observer_installed)
	{
		return;
	}
	const observer = new MutationObserver(() =>
	{
		if (install_link_opacity_input_patch())
		{
			observer.disconnect();
		}
	});
	observer.observe(document.body, { childList: true, subtree: true });
	document.__crosshair_link_opacity_observer_installed = true;
}
