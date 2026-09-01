import { getItemYear } from "../../api/helpers";
import { parseDOI } from "../../utils";

import { ZItemTop } from "Types/transforms";


/** Simplified, JSON-serializable summary of a Zotero item, suitable for returning to an agent */
type SimplifiedItem = {
	/** The item's citekey, with the `@` prefix. Falls back to the item's Zotero key if no citekey is pinned. */
	citekey: string,
	creators: string,
	doi: string,
	/** Whether the item has a pinned citation key (via Better BibTeX) */
	hasCitekey: boolean,
	/** The UID of the item's Roam page, if it exists - otherwise `false` */
	inGraph: string | false,
	itemType: string,
	/** The item's Zotero key */
	key: string,
	/** The path of the item's Zotero library (e.g. `users/123456`) */
	library: string,
	title: string,
	year: string
};

/** Normalizes an agent-provided citekey: coerces to string, trims, and removes the `@` prefix.
 * Handler arguments are only schema-validated when the call comes through Roam's MCP server, so they are coerced here rather than assumed.
 */
function normalizeCitekey(citekey: unknown) {
	return String(citekey ?? "").trim().replace(/^@/, "");
}

/** Formats a Zotero item into a compact summary for agents */
function simplifyItemForAgent(item: ZItemTop, { inGraph }: { inGraph: string | false }): SimplifiedItem {
	return {
		citekey: "@" + item.key,
		creators: item.meta.creatorSummary || "",
		doi: parseDOI(item.data.DOI) || "",
		hasCitekey: item.has_citekey,
		inGraph,
		itemType: item.data.itemType,
		key: item.data.key,
		library: item.library.type + "s/" + item.library.id,
		title: item.data.title || "",
		year: getItemYear(item)
	};
}

/** Matches Zotero items against a search string - by citekey, Zotero key, DOI, or title substring.
 * @returns The matching items, with exact citekey/key/DOI matches sorted before title matches
 */
function matchItems(items: ZItemTop[], query: unknown): ZItemTop[] {
	const trimmed = String(query ?? "").trim();
	const lowercased = trimmed.toLowerCase();
	const citekey = normalizeCitekey(trimmed).toLowerCase();
	const doi = parseDOI(trimmed);

	const exact: ZItemTop[] = [];
	const partial: ZItemTop[] = [];

	items.forEach(item => {
		const itemKey = item.key.toLowerCase();

		if (itemKey == citekey || item.data.key.toLowerCase() == lowercased || (doi && parseDOI(item.data.DOI) == doi)) {
			exact.push(item);
		} else if (itemKey.includes(citekey) || (item.data.title || "").toLowerCase().includes(lowercased)) {
			partial.push(item);
		}
	});

	return [...exact, ...partial];
}


export { matchItems, normalizeCitekey, simplifyItemForAgent };
export type { SimplifiedItem };
