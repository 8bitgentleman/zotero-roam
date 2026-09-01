import { FC, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { getCitekeyPages } from "@services/roam";

import { RCitekeyPages } from "Types/transforms";


// https://devtrium.com/posts/how-use-react-context-pro#memoize-values-in-your-context-with-usememo-and-usecallback

const RoamCitekeys = createContext<(readonly [RCitekeyPages, () => void]) | null>(null);

const RoamCitekeysProvider: FC = ({ children }) => {
	const [roamCitekeys, setRoamCitekeys] = useState<RCitekeyPages>(() => getCitekeyPages());

	const update = useCallback(() => {
		setRoamCitekeys(() => getCitekeyPages());
	}, []);

	// Imports that don't go through the UI (AI tools, or any other consumer of the import functions) can create citekey pages.
	// Without this, the map would stay stale until the next mount, and the UI would treat those pages as missing.
	useEffect(() => {
		const refreshIfPageCreated = (event: CustomEvent<{ page?: { new?: boolean } }>) => {
			if (event.detail?.page?.new) { update(); }
		};

		document.addEventListener("zotero-roam:metadata-added", refreshIfPageCreated);
		document.addEventListener("zotero-roam:notes-added", refreshIfPageCreated);

		return () => {
			document.removeEventListener("zotero-roam:metadata-added", refreshIfPageCreated);
			document.removeEventListener("zotero-roam:notes-added", refreshIfPageCreated);
		};
	}, [update]);

	const contextValue = useMemo(() => [roamCitekeys, update] as const, [roamCitekeys, update]);

	return (
		<RoamCitekeys.Provider value={contextValue}>
			{children}
		</RoamCitekeys.Provider>
	);
};

const useRoamCitekeys = () => {
	const context = useContext(RoamCitekeys);

	if (!context) {
		throw new Error("No context provided");
	}

	return context;
};

export { 
	RoamCitekeys, // For Storybook only
	RoamCitekeysProvider,
	useRoamCitekeys
};
