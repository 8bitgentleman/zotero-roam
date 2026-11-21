import { render } from "@testing-library/react";

import NotesImportItem from ".";

import { sampleAnnot, sampleImageAnnot } from "Mocks";
import { ZItemAnnotation } from "Types/transforms";


const renderItem = (note: ZItemAnnotation) => render(
	<NotesImportItem note={note} isSelected={false} isSingleChild={true} onToggle={vi.fn()} />
);

describe("NotesImportItem - annotations", () => {
	it("shows image annotations with their comment instead of an unsupported message", () => {
		const { getByText, queryByText } = renderItem(sampleImageAnnot);

		expect(getByText("Image annotation")).toBeTruthy();
		expect(getByText("Good figure to dissect")).toBeTruthy();
		expect(queryByText(/not supported/i)).toBeNull();
	});

	it("labels ink annotations as ink", () => {
		const ink = { ...sampleImageAnnot, data: { ...sampleImageAnnot.data, annotationType: "ink" as const } };
		const { getByText } = renderItem(ink);

		expect(getByText("Ink annotation")).toBeTruthy();
	});

	it("shows no region label for highlights", () => {
		const { queryByText } = renderItem(sampleAnnot);

		expect(queryByText(/annotation$/)).toBeNull();
	});
});
