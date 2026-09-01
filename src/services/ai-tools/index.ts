import { Roam, findRoamPage, getCitekeyPages, hasBlockChildren, importItemMetadata, importItemNotes } from "@services/roam";

import { matchItems, normalizeCitekey, simplifyItemForAgent } from "./helpers";

import { getCurrentSettings } from "../../setup";
import { categorizeLibraryItems, identifyChildren } from "../../utils";

import { OutcomeMetadataStatus, OutcomePage } from "Types/extension";
import { ZItemAnnotation, ZItemAttachment, ZItemNote, ZItemTop, isZItemTop } from "Types/transforms";


/** The maximum number of items `zotero-search-items` will return in one call */
const SEARCH_LIMIT_MAX = 50;
const SEARCH_LIMIT_DEFAULT = 20;

/** Finds a loaded Zotero item from its citekey, with its children (PDFs, notes/annotations).
 * The citekey is matched case-insensitively, so that an agent transcribing a citekey from prose or a page title still resolves the item.
 * @returns The item and its children, as `importItemMetadata` and `importItemNotes` expect them
 */
function findItemWithChildren(citekey: unknown): { item: ZItemTop, pdfs: ZItemAttachment[], notes: (ZItemNote | ZItemAnnotation)[] } {
	const key = normalizeCitekey(citekey);
	const libraryContents = categorizeLibraryItems(window.zoteroRoam.getItems("all"));
	const item = libraryContents.items.find(it => it.key.toLowerCase() == key.toLowerCase());

	if (!item) {
		throw new Error(`No Zotero item found for citekey "@${key}". The item may not be loaded yet, or may not have a pinned citation key - use the zotero-search-items tool to find items by title or DOI.`);
	}

	const location = item.library.type + "s/" + item.library.id;
	const { pdfs, notes } = identifyChildren(item.data.key, location, { pdfs: libraryContents.pdfs, notes: libraryContents.notes });

	return { item, pdfs, notes };
}

/** Shapes an import's outcome into an agent-facing result.
 * @throws If the import failed, or completed with an uncertain outcome (which leaves an empty page behind) - an agent can't see the page, so anything short of a confirmed import is reported as an error.
 */
function reportImportOutcome(item: ZItemTop, outcome: { page: OutcomePage } & OutcomeMetadataStatus, fallbackMessage: string) {
	if (outcome.success !== true) {
		if (outcome.error) {
			throw (outcome.error instanceof Error ? outcome.error : new Error(`${fallbackMessage}: ${String(outcome.error)}`));
		}
		throw new Error(`${fallbackMessage}: nothing was written to [[@${item.key}]]. The item's formatted output was empty - check the extension's metadata settings (a custom function or SmartBlock may have returned nothing).`);
	}

	return {
		citekey: "@" + item.key,
		page: outcome.page,
		success: outcome.success
	};
}

/** Generates the list of AI tools to register.
 * Tool handlers read from `window.zoteroRoam` and from the extension's settings at call time, so they must only be invoked once the extension is fully loaded.
 * Handler arguments are validated by Roam against each tool's `inputSchema` before the handler runs, but only for calls made through an agent - handlers are also callable directly from JS, so arguments are coerced rather than trusted.
 */
const aiTools = ({ extensionAPI }: { extensionAPI: Roam.ExtensionAPI }): Roam.AITool[] => [
	{
		name: "zotero-search-items",
		description: "Searches the Zotero items currently loaded by the zoteroRoam extension, by citekey, DOI, Zotero item key, or title substring. Read-only. Returns compact summaries, including each item's citekey and inGraph (the UID of its Roam page if one exists, otherwise false). Use this to find an item's exact citekey before calling zotero-import-metadata or zotero-import-notes. An empty query lists loaded items. `total` is the number of matches; when it exceeds the items returned, either narrow the query or page through the rest with `offset`. Items are matched against the extension's local data, which syncs periodically from the Zotero API - an item added to Zotero moments ago may not be loaded yet.",
		scope: "read",
		inputSchema: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "Search string - a citekey (with or without the leading @), a DOI, a Zotero item key, or a title substring"
				},
				limit: {
					type: "integer",
					minimum: 1,
					maximum: SEARCH_LIMIT_MAX,
					default: SEARCH_LIMIT_DEFAULT,
					description: "Maximum number of matches to return"
				},
				offset: {
					type: "integer",
					minimum: 0,
					default: 0,
					description: "Number of matches to skip, for paging through a result set larger than the limit"
				}
			},
			required: ["query"],
			additionalProperties: false
		},
		handler: ({ query, limit, offset }) => {
			const size = Math.min(Number(limit) || SEARCH_LIMIT_DEFAULT, SEARCH_LIMIT_MAX);
			const start = Math.max(Number(offset) || 0, 0);

			// `getItems("items")` already excludes children, but is typed as the full union - narrow it back
			const matches = matchItems(window.zoteroRoam.getItems("items").filter(isZItemTop), query);
			const citekeyPages = getCitekeyPages();

			return {
				total: matches.length,
				items: matches
					.slice(start, start + size)
					.map(item => simplifyItemForAgent(item, { inGraph: citekeyPages.get("@" + item.key) || false }))
			};
		}
	},
	{
		name: "zotero-import-metadata",
		description: "Imports a Zotero item's metadata into Roam, as blocks on its citekey page ([[@citekey]]) - creating that page if needed. This is the headless equivalent of zoteroRoam's 'Import metadata' button: it uses the user's configured metadata settings (default formatter, custom function, or SmartBlock) and covers the item's PDF links and notes as configured. If the citekey doesn't match a loaded item, the call fails with guidance - use zotero-search-items first when unsure. By default the call is refused if the citekey page already has content, to avoid duplicate imports.",
		scope: "edit",
		inputSchema: {
			type: "object",
			properties: {
				citekey: {
					type: "string",
					description: "The item's citation key, with or without the leading @ (e.g. \"@smithSomeTitle2021\")"
				},
				allowDuplicate: {
					type: "boolean",
					default: false,
					description: "Import even if the item's Roam page already has content. This adds another copy of the metadata at the top of the page."
				}
			},
			required: ["citekey"],
			additionalProperties: false
		},
		handler: async ({ citekey, allowDuplicate }) => {
			const { item, pdfs, notes } = findItemWithChildren(citekey);
			const uid = findRoamPage("@" + item.key);

			if (uid && allowDuplicate !== true && hasBlockChildren(uid)) {
				throw new Error(`The page [[@${item.key}]] already has content - its metadata may already have been imported. Pass allowDuplicate: true to import anyway (this will add another copy of the metadata at the top of the page).`);
			}

			const settings = getCurrentSettings(extensionAPI);
			const outcome = await importItemMetadata({ item, pdfs, notes }, uid, settings.metadata, settings.typemap, settings.notes, settings.annotations);

			return {
				...reportImportOutcome(item, outcome, "Metadata import failed"),
				blocksAdded: outcome.args && "blocks" in outcome.args ? outcome.args.blocks.length : null
			};
		}
	},
	{
		name: "zotero-import-notes",
		description: "Imports a Zotero item's notes and PDF annotations into Roam, as blocks on its citekey page ([[@citekey]]) - creating that page if needed. This is the headless equivalent of zoteroRoam's 'Import notes' button: notes and annotations are formatted with the user's notes/annotations settings. Fails if the item has no notes or annotations, or if the citekey doesn't match a loaded item - use zotero-search-items first when unsure. Unlike zotero-import-metadata this call has no duplicate guard, because the citekey page normally already holds the item's metadata: calling it twice imports the notes twice, so do not retry it blindly (a call that exceeds the handler deadline may still have written its blocks).",
		scope: "edit",
		inputSchema: {
			type: "object",
			properties: {
				citekey: {
					type: "string",
					description: "The item's citation key, with or without the leading @ (e.g. \"@smithSomeTitle2021\")"
				}
			},
			required: ["citekey"],
			additionalProperties: false
		},
		handler: async ({ citekey }) => {
			const { item, notes } = findItemWithChildren(citekey);

			if (notes.length == 0) {
				throw new Error(`The item "@${item.key}" has no notes or annotations in Zotero - there is nothing to import.`);
			}

			const uid = findRoamPage("@" + item.key);
			const settings = getCurrentSettings(extensionAPI);
			const outcome = await importItemNotes({ item, notes }, uid, settings.notes, settings.annotations);

			return {
				...reportImportOutcome(item, outcome, "Notes import failed"),
				notesImported: notes.length
			};
		}
	}
];

// Stored at registration so that teardown can reach the API: Roam's `onunload` receives no arguments
let registeredWith: Roam.ExtensionAPI | null = null;

/** Registers the extension's AI tools, so that agents connected through Roam's MCP server can invoke them (via `call_extension_tool`).
 * No-ops on Roam builds that predate extension AI tools. Safe to call again (re-adding a name updates the tool in place).
 * @returns Whether the tools were registered
 */
function registerAiTools({ extensionAPI }: { extensionAPI: Roam.ExtensionAPI }): boolean {
	const ai = extensionAPI.ai;
	if (!ai || typeof ai.addTool !== "function") {
		registeredWith = null;
		return false;
	}

	unregisterAiTools();

	aiTools({ extensionAPI }).forEach(tool => ai.addTool(tool));
	registeredWith = extensionAPI;
	return true;
}

/** Unregisters the extension's AI tools.
 * Roam removes an extension's tools automatically on unload; this makes the teardown explicit, as for the extension's other registrations, so that a stale tool can never outlive the data it reads.
 */
function unregisterAiTools(): void {
	const extensionAPI = registeredWith;
	const ai = extensionAPI?.ai;

	registeredWith = null;

	if (!ai || typeof ai.removeTool !== "function") {
		return;
	}

	aiTools({ extensionAPI: extensionAPI! }).forEach(({ name }) => ai.removeTool({ name }));
}


export { aiTools, registerAiTools, unregisterAiTools };
