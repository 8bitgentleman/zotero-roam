import { QueryClient } from "@tanstack/query-core";
import { mock } from "vitest-mock-extended";

import { Roam } from "@services/roam";

import { analyzeUserRequests, setupInitialSettings } from "../../setup";
import ZoteroRoam from "../../api";

import { aiTools, registerAiTools, unregisterAiTools } from ".";

import { apiKeys, items, libraries, sampleAnnot, sampleNote, samplePDF } from "Mocks";
import { existing_page_uid, existing_page_with_content_uid, findRoamPage, getCitekeyPages, importItemMetadata, importItemNotes } from "Mocks/roam";


const { userLibrary, groupLibrary } = libraries;
const { keyWithFullAccess: { key: masterKey } } = apiKeys;

const defaultReqs = [
	{ dataURI: userLibrary.path + "/items", apikey: masterKey, name: "My user library" },
	{ dataURI: groupLibrary.path + "/items", apikey: masterKey, name: "My group library" }
];
const initRequests = analyzeUserRequests(defaultReqs);
const initSettings = setupInitialSettings({});

const blochItem = items.find(it => it.key == "blochImplementingSocialInterventions2021")!;
const pintoItem = items.find(it => it.key == "pintoExploringDifferentMethods2021")!;

/** Creates a fake `extensionAPI` exposing what the AI tools use: the settings store, and the AI tools API */
const makeExtensionAPI = ({ settings = {}, withAI = true }: { settings?: Record<string, unknown>, withAI?: boolean } = {}) => mock<Roam.ExtensionAPI>({
	settings: { getAll: () => settings },
	ai: withAI
		? { addTool: vi.fn(() => null), removeTool: vi.fn(() => null) }
		: undefined
});

const getTool = (extensionAPI: Roam.ExtensionAPI, name: string) => {
	return aiTools({ extensionAPI }).find(tool => tool.name == name)!;
};

const toolContext = () => mock<Roam.AIToolContext>();

describe("registerAiTools", () => {
	it("registers every tool when the AI tools API is available", () => {
		const extensionAPI = makeExtensionAPI();

		expect(registerAiTools({ extensionAPI })).toBe(true);
		expect(extensionAPI.ai!.addTool).toHaveBeenCalledTimes(3);

		const registered = vi.mocked(extensionAPI.ai!.addTool).mock.calls.map(([tool]) => tool);
		expect(registered.map(tool => tool.name)).toEqual([
			"zotero-search-items",
			"zotero-import-metadata",
			"zotero-import-notes"
		]);
	});

	it("declares tools within Roam's constraints", () => {
		const extensionAPI = makeExtensionAPI();

		aiTools({ extensionAPI }).forEach(tool => {
			expect(tool.name).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
			expect(tool.description.length).toBeLessThanOrEqual(2000);
			expect(["read", "append", "edit"]).toContain(tool.scope);
			expect(tool.inputSchema).toMatchObject({ type: "object" });
		});
	});

	it("no-ops on Roam builds without extension AI tools", () => {
		const extensionAPI = makeExtensionAPI({ withAI: false });

		expect(registerAiTools({ extensionAPI })).toBe(false);
	});
});

describe("unregisterAiTools", () => {
	it("removes every registered tool", () => {
		const extensionAPI = makeExtensionAPI();
		registerAiTools({ extensionAPI });

		unregisterAiTools();

		expect(vi.mocked(extensionAPI.ai!.removeTool).mock.calls.map(([{ name }]) => name)).toEqual([
			"zotero-search-items",
			"zotero-import-metadata",
			"zotero-import-notes"
		]);
	});

	it("removes each tool only once, however often it is called", () => {
		const extensionAPI = makeExtensionAPI();
		registerAiTools({ extensionAPI });

		unregisterAiTools();
		unregisterAiTools();

		expect(extensionAPI.ai!.removeTool).toHaveBeenCalledTimes(3);
	});

	it("does not reach a stale API after a failed registration", () => {
		const registered = makeExtensionAPI();
		registerAiTools({ extensionAPI: registered });
		registerAiTools({ extensionAPI: makeExtensionAPI({ withAI: false }) });

		unregisterAiTools();

		// The failed registration cleared the stored handle, so the earlier API is not touched
		expect(registered.ai!.removeTool).not.toHaveBeenCalled();
	});

	it("replaces the tools of a previous registration", () => {
		const first = makeExtensionAPI();
		registerAiTools({ extensionAPI: first });
		registerAiTools({ extensionAPI: makeExtensionAPI() });

		expect(first.ai!.removeTool).toHaveBeenCalledTimes(3);
	});
});

describe("AI tool handlers", () => {
	let client: QueryClient;
	let extensionAPI: Roam.ExtensionAPI;

	beforeEach(() => {
		// The Mocks/roam spies come from @storybook/test's `fn`, which vitest's `clearMocks` doesn't cover
		findRoamPage.mockClear();
		getCitekeyPages.mockClear();
		importItemMetadata.mockClear();
		importItemNotes.mockClear();

		client = new QueryClient();
		window.zoteroRoam = new ZoteroRoam({
			queryClient: client,
			requests: initRequests,
			settings: initSettings
		});

		client.setQueryData(
			["items"],
			(_prev) => ({
				data: [...items, samplePDF, sampleNote, sampleAnnot],
				lastUpdated: 9999
			})
		);

		extensionAPI = makeExtensionAPI();
	});

	describe("zotero-search-items", () => {
		it("returns compact matches, with the total count", () => {
			const tool = getTool(extensionAPI, "zotero-search-items");

			const output = tool.handler({ query: "@blochImplementingSocialInterventions2021" }, toolContext());

			expect(output).toEqual({
				total: 1,
				items: [
					expect.objectContaining({
						citekey: "@blochImplementingSocialInterventions2021",
						inGraph: false,
						key: "PPD648N6",
						library: userLibrary.path
					})
				]
			});
		});

		it("reports the uid of an item's Roam page, with a single lookup for all matches", () => {
			getCitekeyPages.mockReturnValueOnce(new Map([["@blochImplementingSocialInterventions2021", existing_page_uid]]));
			const tool = getTool(extensionAPI, "zotero-search-items");

			const output = tool.handler({ query: "" }, toolContext()) as { items: { citekey: string, inGraph: string | false }[] };

			expect(getCitekeyPages).toHaveBeenCalledTimes(1);
			expect(output.items.find(it => it.citekey == "@blochImplementingSocialInterventions2021")?.inGraph).toBe(existing_page_uid);
			expect(output.items.find(it => it.citekey == "@pintoExploringDifferentMethods2021")?.inGraph).toBe(false);
		});

		it("caps the number of returned items to the limit", () => {
			const tool = getTool(extensionAPI, "zotero-search-items");

			const output = tool.handler({ query: "", limit: 1 }, toolContext()) as { total: number, items: unknown[] };

			expect(output.total).toBe(items.length);
			expect(output.items.length).toBe(1);
		});

		it("pages through matches with the offset", () => {
			const tool = getTool(extensionAPI, "zotero-search-items");

			const firstPage = tool.handler({ query: "", limit: 1 }, toolContext()) as { items: { key: string }[] };
			const secondPage = tool.handler({ query: "", limit: 1, offset: 1 }, toolContext()) as { total: number, items: { key: string }[] };

			expect(secondPage.total).toBe(items.length);
			expect(secondPage.items.length).toBe(1);
			expect(secondPage.items[0].key).not.toBe(firstPage.items[0].key);
		});

		// Handlers are callable directly from JS, where Roam's schema validation doesn't apply
		it.each([
			["no query", {}],
			["a null query", { query: null }],
			["a non-string query", { query: 2021 }],
			["a null limit", { query: "", limit: null }],
			["a negative limit", { query: "", limit: -1 }]
		])("survives %s", (_label, args) => {
			const tool = getTool(extensionAPI, "zotero-search-items");

			const output = tool.handler(args, toolContext()) as { total: number, items: unknown[] };

			expect(output.total).toBeGreaterThanOrEqual(0);
			expect(Array.isArray(output.items)).toBe(true);
		});

		it("lists every loaded item for an empty query", () => {
			const tool = getTool(extensionAPI, "zotero-search-items");

			const output = tool.handler({ query: "" }, toolContext()) as { total: number, items: unknown[] };

			expect(output.total).toBe(items.length);
			expect(output.items.length).toBe(items.length);
		});
	});

	describe("zotero-import-metadata", () => {
		it("imports metadata for a loaded item, with its children and current settings", async () => {
			const tool = getTool(extensionAPI, "zotero-import-metadata");

			const output = await tool.handler({ citekey: "@blochImplementingSocialInterventions2021" }, toolContext());

			expect(importItemMetadata).toHaveBeenCalledTimes(1);
			expect(importItemMetadata).toHaveBeenCalledWith(
				{ item: blochItem, pdfs: [samplePDF], notes: [sampleNote, sampleAnnot] },
				false,
				initSettings.metadata,
				initSettings.typemap,
				initSettings.notes,
				initSettings.annotations
			);
			expect(output).toEqual({
				citekey: "@blochImplementingSocialInterventions2021",
				page: { new: true, title: "@blochImplementingSocialInterventions2021", uid: existing_page_uid },
				success: true,
				blocksAdded: 0
			});
		});

		it("refuses to import when the citekey page already has content", async () => {
			findRoamPage.mockReturnValueOnce(existing_page_with_content_uid);
			const tool = getTool(extensionAPI, "zotero-import-metadata");

			await expect(tool.handler({ citekey: "blochImplementingSocialInterventions2021" }, toolContext()))
				.rejects.toThrow(/already has content/);
			expect(importItemMetadata).not.toHaveBeenCalled();
		});

		it("imports into an existing page when allowDuplicate is set", async () => {
			findRoamPage.mockReturnValueOnce(existing_page_with_content_uid);
			const tool = getTool(extensionAPI, "zotero-import-metadata");

			await tool.handler({ citekey: "blochImplementingSocialInterventions2021", allowDuplicate: true }, toolContext());

			expect(importItemMetadata).toHaveBeenCalledWith(
				expect.anything(),
				existing_page_with_content_uid,
				initSettings.metadata,
				initSettings.typemap,
				initSettings.notes,
				initSettings.annotations
			);
		});

		it("fails with guidance when the citekey doesn't match a loaded item", async () => {
			const tool = getTool(extensionAPI, "zotero-import-metadata");

			await expect(tool.handler({ citekey: "@noSuchCitekey2099" }, toolContext()))
				.rejects.toThrow(/No Zotero item found for citekey "@noSuchCitekey2099"/);
			expect(importItemMetadata).not.toHaveBeenCalled();
		});

		it("resolves the citekey regardless of casing", async () => {
			const tool = getTool(extensionAPI, "zotero-import-metadata");

			await tool.handler({ citekey: "@BLOCHImplementingSocialInterventions2021" }, toolContext());

			expect(importItemMetadata).toHaveBeenCalledWith(
				expect.objectContaining({ item: blochItem }),
				expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything()
			);
		});

		it("surfaces the error when the import fails", async () => {
			importItemMetadata.mockResolvedValueOnce({
				args: { blocks: [], uid: existing_page_uid },
				error: new Error("Roam rejected the write"),
				page: { new: true, title: "@blochImplementingSocialInterventions2021", uid: existing_page_uid },
				success: false
			});
			const tool = getTool(extensionAPI, "zotero-import-metadata");

			await expect(tool.handler({ citekey: "@blochImplementingSocialInterventions2021" }, toolContext()))
				.rejects.toThrow("Roam rejected the write");
		});

		it("surfaces a non-Error failure reason", async () => {
			importItemMetadata.mockResolvedValueOnce({
				args: { blocks: [], uid: existing_page_uid },
				error: "a custom function threw a string",
				page: { new: true, title: "@blochImplementingSocialInterventions2021", uid: existing_page_uid },
				success: false
			});
			const tool = getTool(extensionAPI, "zotero-import-metadata");

			await expect(tool.handler({ citekey: "@blochImplementingSocialInterventions2021" }, toolContext()))
				.rejects.toThrow(/Metadata import failed: a custom function threw a string/);
		});

		// `addBlocksArray` resolves with `success: null` when the formatted output is empty,
		// which leaves an empty page behind - an agent can't see that, so it must be an error
		it("fails when the import wrote nothing", async () => {
			importItemMetadata.mockResolvedValueOnce({
				args: { blocks: [], uid: existing_page_uid },
				error: null,
				page: { new: true, title: "@blochImplementingSocialInterventions2021", uid: existing_page_uid },
				success: null
			});
			const tool = getTool(extensionAPI, "zotero-import-metadata");

			await expect(tool.handler({ citekey: "@blochImplementingSocialInterventions2021" }, toolContext()))
				.rejects.toThrow(/nothing was written/);
		});
	});

	describe("zotero-import-notes", () => {
		it("imports notes and annotations for a loaded item", async () => {
			const tool = getTool(extensionAPI, "zotero-import-notes");

			const output = await tool.handler({ citekey: "@blochImplementingSocialInterventions2021" }, toolContext());

			expect(importItemNotes).toHaveBeenCalledTimes(1);
			expect(importItemNotes).toHaveBeenCalledWith(
				{ item: blochItem, notes: [sampleNote, sampleAnnot] },
				false,
				initSettings.notes,
				initSettings.annotations
			);
			expect(output).toEqual({
				citekey: "@blochImplementingSocialInterventions2021",
				page: { new: true, title: "@blochImplementingSocialInterventions2021", uid: existing_page_uid },
				success: true,
				notesImported: 2
			});
		});

		it("fails when the item has no notes or annotations", async () => {
			const tool = getTool(extensionAPI, "zotero-import-notes");

			await expect(tool.handler({ citekey: pintoItem.key }, toolContext()))
				.rejects.toThrow(/has no notes or annotations/);
			expect(importItemNotes).not.toHaveBeenCalled();
		});
	});
});
