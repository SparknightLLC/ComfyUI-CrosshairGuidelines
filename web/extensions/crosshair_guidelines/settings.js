import { diagnostic_warn } from "./diagnostics.js";

export const SETTINGS_IDS = {
	move_mode: "crosshair_guidelines.move_mode",
	resize_mode: "crosshair_guidelines.resize_mode",
	idle_mode: "crosshair_guidelines.idle_mode",
	ctrl_behavior: "crosshair_guidelines.ctrl_behavior",
	color: "crosshair_guidelines.color",
	thickness: "crosshair_guidelines.thickness",
	link_opacity: "crosshair_guidelines.link_opacity",
	node_opacity: "crosshair_guidelines.node_opacity",
	hide_active_outline: "crosshair_guidelines.hide_active_outline",
	diagnostics: "crosshair_guidelines.diagnostics"
};

const SETTINGS_PANEL_LABEL = "Crosshair Guidelines";
const SETTINGS_SECTION_LABEL = "General";
const LEGACY_SETTING_STORAGE_KEY = "crosshair_guidelines.enabled";

export const DEFAULT_SETTINGS = {
	move_mode: "all",
	resize_mode: "selected",
	idle_mode: "off",
	ctrl_behavior: "off",
	color: "#0B8CE9",
	thickness: 2,
	link_opacity: 0.05,
	node_opacity: 0.6,
	hide_active_outline: false,
	diagnostics: false
};

export const settings_state = { ...DEFAULT_SETTINGS };

function normalize_move_mode(value)
{
	if (value === "off" || value === "all")
	{
		return value;
	}
	return DEFAULT_SETTINGS.move_mode;
}

function normalize_resize_mode(value)
{
	if (value === "off" || value === "selected" || value === "all")
	{
		return value;
	}
	return DEFAULT_SETTINGS.resize_mode;
}

function normalize_idle_mode(value)
{
	if (value === "off" || value === "all")
	{
		return value;
	}
	return DEFAULT_SETTINGS.idle_mode;
}

function normalize_ctrl_behavior(value)
{
	if (value === "off" || value === "show" || value === "hide")
	{
		return value;
	}
	return DEFAULT_SETTINGS.ctrl_behavior;
}

function normalize_line_color(value)
{
	if (typeof value === "string" && value.trim())
	{
		return value;
	}
	return DEFAULT_SETTINGS.color;
}

function normalize_line_width(value)
{
	const number_value = Number.parseFloat(value);
	if (!Number.isFinite(number_value))
	{
		return DEFAULT_SETTINGS.thickness;
	}
	return Math.max(0.5, number_value);
}

function normalize_link_opacity_multiplier(value)
{
	if (typeof value === "boolean")
	{
		return value ? DEFAULT_SETTINGS.link_opacity : 1;
	}
	const normalized_value = typeof value === "string" ? value.replace(",", ".") : value;
	const number_value = Number.parseFloat(normalized_value);
	if (!Number.isFinite(number_value))
	{
		return DEFAULT_SETTINGS.link_opacity;
	}
	return Math.min(1, Math.max(0, number_value));
}

function normalize_node_opacity_multiplier(value)
{
	const normalized_value = typeof value === "string" ? value.replace(",", ".") : value;
	const number_value = Number.parseFloat(normalized_value);
	if (!Number.isFinite(number_value))
	{
		return DEFAULT_SETTINGS.node_opacity;
	}
	return Math.min(1, Math.max(0, number_value));
}

function normalize_boolean(value, fallback)
{
	if (typeof value === "boolean")
	{
		return value;
	}
	if (typeof value === "string")
	{
		const normalized = value.trim().toLowerCase();
		if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on")
		{
			return true;
		}
		if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off")
		{
			return false;
		}
	}
	return fallback;
}

function load_setting(key, fallback, normalizer)
{
	const stored = localStorage.getItem(key);
	if (stored === null)
	{
		localStorage.setItem(key, JSON.stringify(fallback));
		return fallback;
	}
	try
	{
		const parsed = JSON.parse(stored);
		return typeof normalizer === "function" ? normalizer(parsed) : parsed;
	}
	catch (err)
	{
		diagnostic_warn("failed to load setting", key, err);
		localStorage.setItem(key, JSON.stringify(fallback));
		return fallback;
	}
}

function save_setting(key, value)
{
	localStorage.setItem(key, JSON.stringify(value));
}

function build_setting_category(label)
{
	return [SETTINGS_PANEL_LABEL, SETTINGS_SECTION_LABEL, label];
}

function load_settings_state(state)
{
	const legacy_value = load_setting(LEGACY_SETTING_STORAGE_KEY, true, (value) => !!value);
	if (!legacy_value)
	{
		state.move_mode = "off";
		state.resize_mode = "off";
		state.idle_mode = "off";
		save_setting(SETTINGS_IDS.move_mode, state.move_mode);
		save_setting(SETTINGS_IDS.resize_mode, state.resize_mode);
		save_setting(SETTINGS_IDS.idle_mode, state.idle_mode);
	}
	else
	{
		state.move_mode = load_setting(SETTINGS_IDS.move_mode, DEFAULT_SETTINGS.move_mode, normalize_move_mode);
		state.resize_mode = load_setting(SETTINGS_IDS.resize_mode, DEFAULT_SETTINGS.resize_mode, normalize_resize_mode);
		state.idle_mode = load_setting(SETTINGS_IDS.idle_mode, DEFAULT_SETTINGS.idle_mode, normalize_idle_mode);
	}
	state.ctrl_behavior = load_setting(SETTINGS_IDS.ctrl_behavior, DEFAULT_SETTINGS.ctrl_behavior, normalize_ctrl_behavior);
	state.color = load_setting(SETTINGS_IDS.color, DEFAULT_SETTINGS.color, normalize_line_color);
	state.thickness = load_setting(SETTINGS_IDS.thickness, DEFAULT_SETTINGS.thickness, normalize_line_width);
	state.link_opacity = load_setting(SETTINGS_IDS.link_opacity, DEFAULT_SETTINGS.link_opacity, normalize_link_opacity_multiplier);
	state.node_opacity = load_setting(SETTINGS_IDS.node_opacity, DEFAULT_SETTINGS.node_opacity, normalize_node_opacity_multiplier);
	state.hide_active_outline = load_setting(
		SETTINGS_IDS.hide_active_outline,
		DEFAULT_SETTINGS.hide_active_outline,
		(value) => normalize_boolean(value, DEFAULT_SETTINGS.hide_active_outline)
	);
	state.diagnostics = load_setting(
		SETTINGS_IDS.diagnostics,
		DEFAULT_SETTINGS.diagnostics,
		(value) => normalize_boolean(value, DEFAULT_SETTINGS.diagnostics)
	);
}

export function install_settings(app, request_canvas_redraw, on_installed)
{
	if (!app?.ui?.settings)
	{
		return false;
	}
	if (app.ui.settings.__crosshair_guidelines_setting_installed)
	{
		return true;
	}
	app.ui.settings.__crosshair_guidelines_setting_installed = true;
	load_settings_state(settings_state);

	app.ui.settings.addSetting({
		id: SETTINGS_IDS.move_mode,
		category: build_setting_category("Crosshairs on move"),
		name: "Crosshairs on move",
		type: "combo",
		options: [
			{ text: "Off", value: "off" },
			{ text: "All corners", value: "all" }
		],
		defaultValue: settings_state.move_mode,
		onChange: (new_value) =>
		{
			settings_state.move_mode = normalize_move_mode(new_value);
			save_setting(SETTINGS_IDS.move_mode, settings_state.move_mode);
			request_canvas_redraw();
		}
	});

	app.ui.settings.addSetting({
		id: SETTINGS_IDS.resize_mode,
		category: build_setting_category("Crosshairs on resize"),
		name: "Crosshairs on resize",
		type: "combo",
		options: [
			{ text: "Off", value: "off" },
			{ text: "Selected corner", value: "selected" },
			{ text: "All corners", value: "all" }
		],
		defaultValue: settings_state.resize_mode,
		onChange: (new_value) =>
		{
			settings_state.resize_mode = normalize_resize_mode(new_value);
			save_setting(SETTINGS_IDS.resize_mode, settings_state.resize_mode);
			request_canvas_redraw();
		}
	});

	app.ui.settings.addSetting({
		id: SETTINGS_IDS.idle_mode,
		category: build_setting_category("Crosshairs when idle"),
		name: "Crosshairs when idle",
		type: "combo",
		options: [
			{ text: "Off", value: "off" },
			{ text: "All corners", value: "all" }
		],
		defaultValue: settings_state.idle_mode,
		onChange: (new_value) =>
		{
			settings_state.idle_mode = normalize_idle_mode(new_value);
			save_setting(SETTINGS_IDS.idle_mode, settings_state.idle_mode);
			request_canvas_redraw();
		}
	});

	app.ui.settings.addSetting({
		id: SETTINGS_IDS.ctrl_behavior,
		category: build_setting_category("CTRL behavior"),
		name: "CTRL behavior",
		type: "combo",
		options: [
			{ text: "Show crosshairs", value: "show" },
			{ text: "Hide crosshairs", value: "hide" },
			{ text: "Off", value: "off" }
		],
		defaultValue: settings_state.ctrl_behavior,
		attrs: {
			title: "Applies only while holding Ctrl/Meta during move/resize of an already-selected node or group. Marquee multi-select always hides crosshairs."
		},
		onChange: (new_value) =>
		{
			settings_state.ctrl_behavior = normalize_ctrl_behavior(new_value);
			save_setting(SETTINGS_IDS.ctrl_behavior, settings_state.ctrl_behavior);
			request_canvas_redraw();
		}
	});

	app.ui.settings.addSetting({
		id: SETTINGS_IDS.color,
		category: build_setting_category("Crosshair color"),
		name: "Crosshair color",
		type: "text",
		defaultValue: settings_state.color,
		attrs: {
			placeholder: DEFAULT_SETTINGS.color,
			title: "Accepts CSS color values like #RRGGBB, #RRGGBBAA, rgb(...), rgba(...), or named colors."
		},
		onChange: (new_value) =>
		{
			settings_state.color = normalize_line_color(new_value);
			save_setting(SETTINGS_IDS.color, settings_state.color);
			request_canvas_redraw();
		}
	});

	app.ui.settings.addSetting({
		id: SETTINGS_IDS.thickness,
		category: build_setting_category("Crosshair thickness"),
		name: "Crosshair thickness",
		type: "number",
		defaultValue: settings_state.thickness,
		attrs: { min: 0.5, step: 0.1 },
		onChange: (new_value) =>
		{
			settings_state.thickness = normalize_line_width(new_value);
			save_setting(SETTINGS_IDS.thickness, settings_state.thickness);
			request_canvas_redraw();
		}
	});

	app.ui.settings.addSetting({
		id: SETTINGS_IDS.link_opacity,
		category: build_setting_category("Opacity (links) while moving/resizing"),
		name: "Opacity (links) while moving/resizing",
		type: "text",
		defaultValue: String(settings_state.link_opacity),
		attrs: { inputmode: "decimal", placeholder: "0-1" },
		onChange: (new_value) =>
		{
			settings_state.link_opacity = normalize_link_opacity_multiplier(new_value);
			save_setting(SETTINGS_IDS.link_opacity, settings_state.link_opacity);
			request_canvas_redraw();
		}
	});

	app.ui.settings.addSetting({
		id: SETTINGS_IDS.node_opacity,
		category: build_setting_category("Opacity (nodes) while moving/resizing"),
		name: "Opacity (nodes) while moving/resizing",
		type: "text",
		defaultValue: String(settings_state.node_opacity),
		attrs: { inputmode: "decimal", placeholder: "0-1" },
		onChange: (new_value) =>
		{
			settings_state.node_opacity = normalize_node_opacity_multiplier(new_value);
			save_setting(SETTINGS_IDS.node_opacity, settings_state.node_opacity);
			request_canvas_redraw();
		}
	});

	app.ui.settings.addSetting({
		id: SETTINGS_IDS.hide_active_outline,
		category: build_setting_category("Hide active outline while moving/resizing"),
		name: "Hide active outline while moving/resizing",
		type: "boolean",
		defaultValue: settings_state.hide_active_outline,
		onChange: (new_value) =>
		{
			settings_state.hide_active_outline = normalize_boolean(new_value, DEFAULT_SETTINGS.hide_active_outline);
			save_setting(SETTINGS_IDS.hide_active_outline, settings_state.hide_active_outline);
			request_canvas_redraw();
		}
	});

	app.ui.settings.addSetting({
		id: SETTINGS_IDS.diagnostics,
		category: build_setting_category("Diagnostics"),
		name: "Diagnostics",
		type: "boolean",
		defaultValue: settings_state.diagnostics,
		attrs: {
			title: "Writes Crosshair Guidelines debug output to the browser console. Keep disabled unless troubleshooting."
		},
		onChange: (new_value) =>
		{
			settings_state.diagnostics = normalize_boolean(new_value, DEFAULT_SETTINGS.diagnostics);
			save_setting(SETTINGS_IDS.diagnostics, settings_state.diagnostics);
		}
	});

	if (typeof on_installed === "function")
	{
		on_installed();
	}
	return true;
}
