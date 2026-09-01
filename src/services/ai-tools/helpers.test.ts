import { matchItems, normalizeCitekey, simplifyItemForAgent } from "./helpers";

import { items, libraries } from "Mocks";


const { userLibrary } = libraries;

const blochItem = items.find(it => it.key == "blochImplementingSocialInterventions2021")!;
const pintoItem = items.find(it => it.key == "pintoExploringDifferentMethods2021")!;

describe("normalizeCitekey", () => {
	const cases = [
		["@blochImplementingSocialInterventions2021", "blochImplementingSocialInterventions2021"],
		["blochImplementingSocialInterventions2021", "blochImplementingSocialInterventions2021"],
		[" @someCitekey ", "someCitekey"]
	];

	test.each(cases)("%s -> %s", (input, expectation) => {
		expect(normalizeCitekey(input)).toBe(expectation);
	});
});

describe("simplifyItemForAgent", () => {
	it("returns a compact summary of the item", () => {
		expect(simplifyItemForAgent(blochItem, { inGraph: false })).toEqual({
			citekey: "@blochImplementingSocialInterventions2021",
			creators: "Bloch and Rozmovits",
			doi: "10.1503/cmaj.210229",
			hasCitekey: true,
			inGraph: false,
			itemType: "journalArticle",
			key: "PPD648N6",
			library: userLibrary.path,
			title: "Implementing social interventions in primary care",
			year: "2021"
		});
	});

	it("passes through the uid of the item's Roam page", () => {
		expect(simplifyItemForAgent(blochItem, { inGraph: "__SOME_UID__" }))
			.toMatchObject({ inGraph: "__SOME_UID__" });
	});
});

describe("matchItems", () => {
	it("matches by exact citekey, with or without the @ prefix", () => {
		expect(matchItems(items, "@blochImplementingSocialInterventions2021")).toEqual([blochItem]);
		expect(matchItems(items, "blochImplementingSocialInterventions2021")).toEqual([blochItem]);
	});

	it("matches by Zotero item key", () => {
		expect(matchItems(items, "PPD648N6")).toEqual([blochItem]);
	});

	it("matches by DOI, including DOI URLs", () => {
		expect(matchItems(items, "10.1503/cmaj.210229")).toEqual([blochItem]);
		expect(matchItems(items, "https://doi.org/10.1503/cmaj.210229")).toEqual([blochItem]);
	});

	it("matches by title substring, case-insensitively", () => {
		expect(matchItems(items, "BASIC INCOME interventions")).toEqual([pintoItem]);
	});

	it("sorts exact matches before partial ones", () => {
		// "pintoExploringDifferentMethods2021" is an exact citekey match for the Pinto item,
		// while other items only match on a shared substring ("2021") at most
		const results = matchItems(items, "pintoExploringDifferentMethods2021");
		expect(results[0]).toBe(pintoItem);
	});

	it("returns an empty list when nothing matches", () => {
		expect(matchItems(items, "__NO_SUCH_ITEM__")).toEqual([]);
	});
});
