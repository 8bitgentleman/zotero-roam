import { fn } from "@storybook/test";
import { makeOrdinal } from "../src/utils";


export const uid_with_existing_block = "__UID_WITH_EXISTING_BLOCK__";
export const uid_with_existing_block_with_children = "__UID_WITH_EXISTING_BLOCK_WITH_CHILDREN__";
export const existing_block_uid = "__SOME_UID__";
export const existing_block_uid_with_children = "__SOME_UID_WITH_CHILDREN__";
export const existing_page_uid = "__PAGE_UID__";
export const existing_page_with_content_uid = "__PAGE_WITH_CONTENT_UID__";

function addPaletteCommand(){}

function findRoamBlock(_string, pageUID){
	switch(pageUID){
	case uid_with_existing_block:
		return {
			uid: existing_block_uid
		};
	case uid_with_existing_block_with_children:
		return {
			uid: existing_block_uid_with_children,
			children: [{ id: 123 }, { id: 456 }]
		};
	default:
		return false;
	}
}

const findRoamPage = fn((_title: string): string | false => false);

function getAllPages(){
	return [];
}

const getCitekeyPages = fn((): Map<string, string> => new Map());

function getCitekeyPagesWithEditTime(){
	return new Map([]);
}

function getCurrentCursorLocation() {
	return null;
}

function getGraphName() {
	return "mock-graph";
}

function getInitialedPages(keys) {
	if (keys.includes("h")) {
		return [
			{ title: "housing", uid: "__some_uid__" }
		];
	}

	return [];
}

function hasBlockChildren(uid) {
	return [uid_with_existing_block_with_children, existing_page_with_content_uid].includes(uid);
}

/** The shape both import functions resolve with. Widened past the happy path, so that tests can stub failed and uncertain outcomes. */
type MockImportOutcome = {
	args: { blocks: unknown[], uid: string },
	error: unknown,
	page: { new: boolean, title: string, uid: string },
	raw?: Record<string, unknown>,
	success: boolean | null
};

const mockImportOutcome = ({ item }, uid): Promise<MockImportOutcome> => {
	const pageUID = uid || existing_page_uid;
	return Promise.resolve({
		args: { blocks: [], uid: pageUID },
		error: null,
		page: { new: !uid, title: "@" + item.key, uid: pageUID },
		raw: {},
		success: true
	});
};

const importItemMetadata = fn(mockImportOutcome);

const importItemNotes = fn(mockImportOutcome);

function makeDNP(date: Date | any, { brackets = true }: { brackets?: boolean } = {}) {
	const thisdate = date.constructor === Date ? date : new Date(date);
	const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
	const dateString = `${months[thisdate.getMonth()]} ${makeOrdinal(thisdate.getDate())}, ${thisdate.getFullYear()}`;
	if (brackets) {
		return `[[${dateString}]]`;
	} else {
		return dateString;
	}
}

function maybeReturnCursorToPlace(){}

async function openInSidebarByUID(){}

async function openPageByUID(){}

function readDNP(string: string, { as_date = true }: { as_date?: boolean } = {}) {
	const [/* match */, mm, dd, yy] = Array.from(string.matchAll(/(.+) ([0-9]+).{2}, ([0-9]{4})/g))[0];
	const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

	const parsedDate = [parseInt(yy), months.findIndex(month => month == mm), parseInt(dd)] as const;

	return as_date ? new Date(...parsedDate) : parsedDate;
}

function removePaletteCommand(){}

export {
	addPaletteCommand,
	findRoamBlock,
	findRoamPage,
	getAllPages,
	getCitekeyPages,
	getCitekeyPagesWithEditTime,
	getCurrentCursorLocation,
	getGraphName,
	getInitialedPages,
	hasBlockChildren,
	importItemMetadata,
	importItemNotes,
	makeDNP,
	maybeReturnCursorToPlace,
	openInSidebarByUID,
	openPageByUID,
	readDNP,
	removePaletteCommand
};