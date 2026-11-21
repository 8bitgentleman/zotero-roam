import { describe, it, expect, vi, beforeEach } from "vitest";
import { mock } from "vitest-mock-extended";

import { initialize, setupInitialSettings } from "./setup";

import { Roam } from "@services/roam";
import { UserRequests, UserSettings } from "Types/extension";


describe("setupInitialSettings", () => {
	it("returns complete settings with all defaults when given empty object", () => {
		const settings = setupInitialSettings({});

		expect(settings).toHaveProperty("annotations");
		expect(settings).toHaveProperty("autocomplete");
		expect(settings).toHaveProperty("copy");
		expect(settings).toHaveProperty("metadata");
		expect(settings).toHaveProperty("notes");
		expect(settings).toHaveProperty("other");
		expect(settings).toHaveProperty("pageMenu");
		expect(settings).toHaveProperty("sciteBadge");
		expect(settings).toHaveProperty("shortcuts");
		expect(settings).toHaveProperty("typemap");
		expect(settings).toHaveProperty("webimport");
	});

	it("merges user settings with defaults", () => {
		const userSettings = {
			other: {
				autoload: true,
				cacheEnabled: true,
				darkTheme: true,
				render_inline: true
			}
		};

		const settings = setupInitialSettings(userSettings);

		expect(settings.other.autoload).toBe(true);
		expect(settings.other.cacheEnabled).toBe(true);
		expect(settings.other.darkTheme).toBe(true);
		expect(settings.other.render_inline).toBe(true);

		// Should still have other default settings
		expect(settings).toHaveProperty("annotations");
		expect(settings).toHaveProperty("autocomplete");
	});

	it("preserves partial user settings and fills in defaults", () => {
		const userSettings: Partial<UserSettings> = {
			annotations: {
				func: "",
				group_by: false,
				template_comment: "{{comment}}",
				template_highlight: "[[>]] {{highlight}} ([p. {{page_label}}]({{link_page}})) {{tags_string}}",
				template_image: "[[>]] [{{type}} annotation] ([p. {{page_label}}]({{link_page}})) {{tags_string}}",
				use: "function" as const,
				__with: "formatted" as const
			},
			shortcuts: {
				"toggleDashboard": "ctrl+shift+z"
			}
		};

		const settings = setupInitialSettings(userSettings);

		// User value preserved
		expect(settings.annotations.use).toBe("function");
		expect(settings.shortcuts.toggleDashboard).toBe("ctrl+shift+z");

		// Defaults filled in
		expect(settings.annotations.func).toBe("");
		expect(settings.annotations.group_by).toBe(false);
		expect(settings.shortcuts.toggleNotes).toBe("alt+N");
	});
});

describe("initialize - Roam Depot context", () => {
	let mockExtensionAPI: Roam.ExtensionAPI;
	let settingsStore: Record<string, any>;
	let mockGetAll: ReturnType<typeof vi.fn>;
	let mockGet: ReturnType<typeof vi.fn>;
	let mockSet: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		// Reset settings store before each test
		settingsStore = {};

		// Create mock functions
		mockGetAll = vi.fn(() => settingsStore);
		mockGet = vi.fn((key: string) => settingsStore[key]);
		mockSet = vi.fn((key: string, value: any) => {
			settingsStore[key] = value;
		});

		// Create a mock extension API that simulates Roam's settings behavior
		mockExtensionAPI = {
			settings: {
				getAll: mockGetAll,
				get: mockGet,
				set: mockSet,
				panel: {} as any
			},
			ui: {} as any
		} as Roam.ExtensionAPI;
	});

	it("writes all settings on first-time setup (empty settings)", () => {
		// First-time setup: no existing settings
		const result = initialize({
			context: "roam/depot",
			extensionAPI: mockExtensionAPI
		});

		// Should have written settings
		expect(mockSet).toHaveBeenCalled();

		// Verify settings are complete
		expect(result.settings).toHaveProperty("annotations");
		expect(result.settings).toHaveProperty("autocomplete");
		expect(result.settings).toHaveProperty("other");

		// Verify requests were created
		expect(result.requests).toEqual({
			dataRequests: [],
			apiKeys: [],
			libraries: []
		});

		// Verify settings are persisted in store
		expect(settingsStore).toHaveProperty("annotations");
		expect(settingsStore).toHaveProperty("requests");
	});

	it("does NOT overwrite settings on subsequent loads", () => {
		// Simulate existing user settings (already configured)
		settingsStore = {
			other: {
				autoload: true,
				cacheEnabled: true,
				darkTheme: true,
				render_inline: true
			},
			annotations: {
				func: "myCustomFunction",
				group_by: true,
				template_comment: "Custom comment template",
				template_highlight: "Custom highlight template",
				use: "function" as const,
				__with: "formatted" as const
			},
			requests: {
				dataRequests: [
					{
						apikey: "test-key",
						dataURI: "users/123/items",
						library: {
							id: "123",
							path: "users/123",
							type: "users" as const,
							uri: "items"
						},
						name: "My Library"
					}
				],
				apiKeys: ["test-key"],
				libraries: [{ path: "users/123", apikey: "test-key" }]
			}
		};

		// Reset the mock to track calls from this point
		mockSet.mockClear();

		const result = initialize({
			context: "roam/depot",
			extensionAPI: mockExtensionAPI
		});

		// Should NOT have written any settings back
		expect(mockSet).not.toHaveBeenCalled();

		// User settings should be preserved
		expect(result.settings.other.autoload).toBe(true);
		expect(result.settings.other.cacheEnabled).toBe(true);
		expect(result.settings.other.darkTheme).toBe(true);
		expect(result.settings.annotations.func).toBe("myCustomFunction");
		expect(result.settings.annotations.group_by).toBe(true);

		// Requests should be preserved
		expect(result.requests.dataRequests).toHaveLength(1);
		expect(result.requests.apiKeys).toEqual(["test-key"]);
	});

	it("merges defaults in-memory without writing on reload", () => {
		// Simulate partial user settings (some nested properties missing)
		settingsStore = {
			other: {
				autoload: true
				// Missing: cacheEnabled, darkTheme, render_inline
			},
			annotations: {
				use: "function" as const
				// Missing: func, group_by, templates, etc.
			}
		};

		mockSet.mockClear();

		const result = initialize({
			context: "roam/depot",
			extensionAPI: mockExtensionAPI
		});

		// Should NOT write settings back
		expect(mockSet).not.toHaveBeenCalled();

		// User values preserved
		expect(result.settings.other.autoload).toBe(true);
		expect(result.settings.annotations.use).toBe("function");

		// Defaults merged in-memory
		expect(result.settings.other.cacheEnabled).toBe(false); // default
		expect(result.settings.other.darkTheme).toBe(false); // default
		expect(result.settings.annotations.func).toBe(""); // default
		expect(result.settings.annotations.group_by).toBe(false); // default

		// Original store unchanged (defaults not written back)
		expect(settingsStore.other).not.toHaveProperty("cacheEnabled");
		expect(settingsStore.annotations).not.toHaveProperty("func");
	});

	it("handles missing requests gracefully on reload", () => {
		// User has some settings but no requests
		settingsStore = {
			other: {
				autoload: true,
				cacheEnabled: false,
				darkTheme: false,
				render_inline: false
			}
			// No "requests" key
		};

		mockSet.mockClear();

		const result = initialize({
			context: "roam/depot",
			extensionAPI: mockExtensionAPI
		});

		// Should NOT write settings back
		expect(mockSet).not.toHaveBeenCalled();

		// Should return empty requests
		expect(result.requests).toEqual({
			dataRequests: [],
			apiKeys: [],
			libraries: []
		});
	});
});

describe("initialize - roam/js context", () => {
	it("initializes from manual settings (legacy)", () => {
		const manualSettings = {
			dataRequests: [
				{
					apikey: "test-key",
					dataURI: "users/123/items",
					name: "Test Library"
				}
			],
			other: {
				autoload: true,
				cacheEnabled: false,
				darkTheme: false,
				render_inline: false
			}
		};

		const result = initialize({
			context: "roam/js",
			manualSettings
		});

		expect(result.settings.other.autoload).toBe(true);
		expect(result.requests.dataRequests).toHaveLength(1);
		expect(result.requests.apiKeys).toContain("test-key");
	});
});
