import { groupNotesByDay } from ".";

import { sampleNote } from "Mocks";
import { ZItemNote } from "Types/transforms";


const withDateAdded = (key: string, dateAdded: string): ZItemNote => ({
	...sampleNote,
	key,
	data: { ...sampleNote.data, key, dateAdded }
});

describe("groupNotesByDay", () => {
	const originalTZ = process.env.TZ;

	// West of UTC, a bare "YYYY-MM-DD" parsed as UTC midnight lands on the previous local day
	beforeAll(() => {
		process.env.TZ = "America/New_York";
	});

	afterAll(() => {
		process.env.TZ = originalTZ;
	});

	it("labels each group with the local day the notes were added", () => {
		const notes = [
			// 10am Nov 21 in New York
			withDateAdded("NOTE_A", "2026-11-21T15:00:00Z"),
			// 9pm Nov 20 in New York, but already Nov 21 in UTC
			withDateAdded("NOTE_B", "2026-11-21T02:00:00Z")
		];

		expect(groupNotesByDay(notes).map(({ date, notes }) => ({ date, keys: notes.map(n => n.key) })))
			.toEqual([
				{ date: "November 21st, 2026", keys: ["NOTE_A"] },
				{ date: "November 20th, 2026", keys: ["NOTE_B"] }
			]);
	});
});
