# Zotero-Roam Codebase Analysis

> Last updated: 2025-11-22
> Purpose: Quick reference for understanding the codebase structure, known issues, and improvement opportunities.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Directory Structure](#directory-structure)
3. [Key Files Reference](#key-files-reference)
4. [Data Flow](#data-flow)
5. [Performance Issues](#performance-issues)
6. [Known Bugs](#known-bugs)
7. [Feature Gaps](#feature-gaps)
8. [Security Vulnerabilities](#security-vulnerabilities)
9. [Test Coverage](#test-coverage)
10. [Improvement Recommendations](#improvement-recommendations)

---

## Architecture Overview

### Tech Stack
- **UI Framework:** React 17.0.2 + Blueprint.js 3.54.0
- **State Management:** @tanstack/react-query v4.36.1
- **Persistence:** IndexedDB via `idb` package
- **HTTP Client:** axios with axios-retry
- **Build Tool:** Vite 5.3.4
- **Testing:** Vitest + React Testing Library + Storybook
- **Language:** TypeScript 4.9.5

### Entry Point Flow
```
src/index.tsx (IIFE)
    ├─ setupPortals() - Creates DOM containers for React portals
    ├─ initialize() - Loads settings, validates API requests
    ├─ IDBDatabase() - Opens IndexedDB connection
    ├─ new ZoteroRoam() - Instantiates public API class
    ├─ setup() - Registers event hooks
    └─ render() - Mounts React tree
        └─ HotkeysProvider
            └─ UserSettingsProvider
                └─ AppWrapper
                    └─ App (Class Component)
                        └─ QueryClientProvider / PersistQueryClientProvider
                            └─ RoamCitekeysProvider
                                └─ [UI Components]
```

### Component Hierarchy
```
App
├─ Dashboard (Modal)
│   ├─ Explorer
│   │   ├─ QueryItems - Browse/filter items
│   │   ├─ QueryPDFs - View PDFs
│   │   └─ QueryNotes - View annotations
│   ├─ TagManager - Manage Zotero tags
│   └─ RecentItems - Recently accessed
├─ SearchPanel (Modal)
│   ├─ SearchInputGroup
│   └─ LibraryQueryList
├─ GraphWatcher (Portal) - Watches Roam DOM
│   ├─ CitekeyMenuFactory
│   ├─ DNPMenuFactory
│   ├─ TagMenuFactory
│   ├─ Autocomplete
│   ├─ WebImportFactory
│   └─ InlineCitekeys
├─ ItemDetails (Modal) - Full item view
├─ ExtensionIcon (Portal) - Status/menu in sidebar
└─ UserSettings (Dialog)
```

---

## Directory Structure

```
/home/user/zotero-roam/
├── src/
│   ├── index.tsx              # Main entry point (IIFE)
│   ├── setup.ts               # Config validation, settings initialization
│   ├── constants.ts           # App constants
│   ├── utils.ts               # Utility functions (~800 lines)
│   │
│   ├── api/
│   │   ├── index.tsx          # ZoteroRoam public API class
│   │   ├── helpers.ts         # Bibliography/metadata formatting
│   │   └── logging.tsx        # Logging functionality
│   │
│   ├── clients/
│   │   ├── zotero/
│   │   │   ├── base.ts        # Core API functions, axios client
│   │   │   ├── helpers.ts     # Data parsing, tag categorization
│   │   │   ├── hooks.ts       # React Query hooks (useItems, useCollections, etc.)
│   │   │   ├── mutations.ts   # Write operations (tags, items)
│   │   │   └── types.ts       # Zotero API type definitions
│   │   ├── citoid/            # Citation metadata from URLs
│   │   └── semantic/          # Semantic Scholar integration
│   │
│   ├── services/
│   │   ├── idb/               # IndexedDB wrapper
│   │   ├── roam/              # Roam API interactions
│   │   ├── react-query/       # Query utilities and selectors
│   │   ├── events/            # Custom event system
│   │   ├── smartblocks/       # Roam SmartBlocks integration
│   │   └── tribute/           # Autocomplete (TributeJS) integration
│   │
│   ├── hooks/                 # Custom React hooks
│   │   ├── useText.ts, useSelect.ts, useBool.ts, etc.
│   │   ├── useDebounceCallback.ts  # Available but underutilized
│   │   └── usePagination.ts
│   │
│   ├── types/
│   │   ├── extension/         # Extension config types
│   │   ├── transforms/        # Zotero ↔ Roam type transforms
│   │   └── helpers.ts         # Utility types
│   │
│   └── components/            # 28 component directories
│       ├── App/               # Root component (Class-based)
│       ├── Dashboard/         # Main UI modal
│       ├── SearchPanel/       # Search interface
│       ├── GraphWatcher/      # DOM watcher (performance critical)
│       ├── ItemDetails/       # Item display modal
│       ├── UserSettings/      # Settings (12 tabs)
│       ├── Autocomplete/      # TributeJS integration
│       └── ...
│
├── dev/
│   ├── vite.config.mts        # Build configuration
│   └── .release-it.cjs        # Release config
│
├── styles/                    # SASS stylesheets
├── stories/                   # Storybook stories (49 stories)
├── tests/                     # Test utilities
├── mocks/                     # API mocks for testing
│   ├── zotero/
│   ├── citoid/
│   ├── semantic-scholar/
│   └── roam.ts
│
└── .github/workflows/         # CI/CD
    ├── ci.yaml               # Lint, test, build
    └── dist.yaml             # Release/publish
```

---

## Key Files Reference

### Core Logic
| File | Purpose | Lines | Notes |
|------|---------|-------|-------|
| `src/index.tsx` | Entry point | 65 | IIFE initialization |
| `src/setup.ts` | Config/settings | 400+ | `initialize()`, `analyzeUserRequests()` |
| `src/utils.ts` | Data utilities | 800+ | `cleanLibraryItem()`, `identifyChildren()` |
| `src/api/index.tsx` | Public API | 249 | `ZoteroRoam` class |

### API Layer
| File | Purpose | Key Functions |
|------|---------|---------------|
| `src/clients/zotero/base.ts` | HTTP requests | `fetchItems()`, `fetchAdditionalData()`, `writeItems()` |
| `src/clients/zotero/hooks.ts` | React Query | `useItems()`, `useCollections()`, `useTags()` |
| `src/clients/zotero/helpers.ts` | Data parsing | `categorizeZoteroTags()`, `matchWithCurrentData()` |
| `src/clients/zotero/mutations.ts` | Write ops | `useDeleteTags()`, `useModifyTags()` |

### UI Components
| File | Purpose | Notes |
|------|---------|-------|
| `src/components/App/index.tsx` | Root component | Class component, manages QueryClient |
| `src/components/GraphWatcher/index.tsx` | DOM watcher | **Performance critical** - 1s interval |
| `src/components/SearchPanel/index.tsx` | Search UI | 50-result hard limit |
| `src/components/Dashboard/index.tsx` | Main dashboard | Tabbed interface |
| `src/components/Autocomplete/index.tsx` | Inline cite | TributeJS integration |

### Services
| File | Purpose | Key Functions |
|------|---------|---------------|
| `src/services/roam/index.ts` | Roam API | `addBlock()`, `getCitekeyPages()`, `createRoamBlock()` |
| `src/services/idb/index.ts` | IndexedDB | `IDBDatabaseService` class |
| `src/services/react-query/index.ts` | Query utils | `selectItems()`, query key definitions |

---

## Data Flow

### Zotero → Roam Pipeline
```
Zotero API (api.zotero.org)
    │
    ▼
Axios Client (src/clients/zotero/base.ts)
    │ - Retry logic (2 attempts)
    │ - Rate limit handling (429 status)
    │ - Pagination (100 items/page)
    ▼
React Query Cache (TanStack)
    │ - Query keys: ["items", library, identifiers]
    │ - Stale time: 1min (items), 5min (collections)
    │ - Refetch interval: 1min (items)
    ▼
IndexedDB Persistence (ZOTERO_ROAM_{graphName})
    │ - Max age: 3 days
    │ - Store: REACT_QUERY
    ▼
React Components
    │ - selectItems() for data access
    │ - cleanLibraryItem() for transformation
    ▼
Roam API (src/services/roam/)
    │ - addBlock(), createRoamBlock()
    ▼
Roam Graph (blocks & pages)
```

### Query Key Structure
```typescript
// Items
["items", "users/123", { apikey, dataURI, library, name }]

// Collections
["collections", { library: "users/123" }]

// Tags
["tags", { library: "users/123" }]

// Permissions (NOT persisted to IndexedDB)
["permissions", { apikey: "..." }]
```

### Data Types Transformation
```
ZoteroAPI.Item (raw API response)
    ↓ extractCitekeys()
ZItem (with has_citekey field)
    ↓ categorizeLibraryItems()
ZLibraryContents { items: ZItemTop[], pdfs: ZItemAttachment[], notes: [] }
    ↓ cleanLibraryItem()
ZCleanItemTop (UI-ready with computed fields)
```

---

## Performance Issues

### Critical (Cause Freezing)

#### 1. O(n²) Tag Categorization
**Location:** `src/clients/zotero/helpers.ts:37-65`
```javascript
for (const elem of zdata) {
    const in_table = output.findIndex(tk =>
        searchEngine(elem, tk.token, { any_case: true, match: "exact" }));
    // findIndex = O(n) for each tag
}
```
**Impact:** 10,000 tags = 100M+ comparisons
**Fix:** Use Map<token, index> for O(1) lookup

#### 2. DOM Polling Every 1 Second
**Location:** `src/components/GraphWatcher/index.tsx:66-76`
```javascript
const watcher = setInterval(() => {
    addPageMenus();        // querySelectorAll("h1.rm-title-display")
    setWebimportDivs();    // querySelectorAll(".rm-block:not(.rm-block--ghost)")
    updatePageElements();
}, 1000);
```
**Impact:** Constant reflows on large Roam graphs
**Fix:** Use MutationObserver or increase interval to 3-5s with debouncing

#### 3. Blocking Data Processing
**Location:** `src/components/Dashboard/Explorer/QueryItems/index.tsx:19-33`
```javascript
setTimeout(() => {
    const data = itemList.items.map(item => {
        // Synchronous processing of ALL items
        return cleanLibraryItem(item, pdfs, notes, roamCitekeys);
    });
    resolve(data);
}, 0);
```
**Impact:** UI freeze with 5000+ items
**Fix:** Use `requestIdleCallback` with chunked processing

#### 4. Linear Search in Item Merging
**Location:** `src/clients/zotero/helpers.ts:154-161`
```javascript
modifiedData.forEach(item => {
    const duplicateIndex = datastore.findIndex(i => i.data.key == item.data.key);
    // O(n) for each modified item
});
```
**Impact:** O(n*m) where n=modified, m=total items
**Fix:** Build Map<key, index> before loop

#### 5. No Concurrency Control on API Calls
**Location:** `src/clients/zotero/base.ts:104-122`
```javascript
for (let i = 1; i <= nbExtraCalls; i++) {
    apiCalls.push(zoteroClient.get(...));
}
const apiResponses = await Promise.all(apiCalls);
```
**Impact:** 10,000 items = 100 parallel requests
**Fix:** Use p-limit to cap at 5 concurrent requests

#### 6. No Debouncing on Autocomplete
**Location:** `src/components/Autocomplete/index.tsx:109-111`
```javascript
values: (text, cb) => {
    cb(formattedLib.filter(item =>
        item[LOOKUP_KEY].toLowerCase().includes(text.toLowerCase())));
}
```
**Impact:** Filters entire library on every keystroke
**Fix:** Add debounce (useDebounceCallback hook exists but unused here)

### Additional Performance Locations
- `src/utils.ts:515-524` - `identifyChildren()` filters arrays repeatedly
- `src/components/Dashboard/TagManager/utils.ts:105-133` - O(n²) tag matching
- `src/components/GraphWatcher/Menus/utils.ts:7-44` - Multiple querySelectorAll
- `src/utils.ts:160-173` - Recursive string cleaning (stack overflow risk)

---

## Known Bugs

### Silent Error Swallowing
| Location | Code | Issue |
|----------|------|-------|
| `NotesImport/index.tsx:94-96` | `catch(e){ // }` | Import failures silent |
| `Autocomplete/index.tsx:157-159` | `catch(e){ // Do nothing }` | DOM errors ignored |
| `InlineCitekeys/index.tsx:126-131` | `catch(e){ // Do nothing }` | Context menu errors |

### Unsafe Array Access
| Location | Code | Risk |
|----------|------|------|
| `react-query/index.ts:137` | `Array.from(itemURI.matchAll(relRegex))[0]` | Empty array crash |
| `InlineCitekeys/index.tsx:256,287,309` | `getElementsByClassName()[0]` | Undefined access |

### Unsafe JSON.parse
| Location | Code | Risk |
|----------|------|------|
| `utils.ts:835` | `JSON.parse(annotationPosition)` | No try-catch |
| `GraphWatcher/WebImport/helpers.ts:22,27` | `JSON.parse(getAttribute())` | Invalid JSON crash |
| `GraphWatcher/Menus/index.tsx:99` | `JSON.parse(menu.getAttribute()!)` | Non-null assertion |

### Unhandled Promise Rejections
| Location | Code |
|----------|------|
| `services/idb/index.ts:48-50` | `.then().then()` no `.catch()` |
| `clients/zotero/base.ts:166` | `Promise.all()` no fallback |
| `api/index.tsx:160` | `Promise.all(bibEntries)` no handler |

### Race Conditions
| Location | Issue |
|----------|-------|
| `GraphWatcher/index.tsx:66-84` | setInterval without proper cleanup |
| `InlineCitekeys/index.tsx:294-298` | Multiple renders simultaneously |

### TODO/FIXME Comments (24 total)
| Location | Note |
|----------|------|
| `utils.ts:304` | "Can rect selections be extracted into an image?" |
| `utils.ts:544` | "FIXME: consider moving to Zotero helpers" |
| `services/roam/index.ts:146` | "TODO: migrate shortcuts to command palette" |
| `ItemDetails/index.tsx:52,103,238` | "TODO: move validation step upstream" |
| `queries.ts:175,181` | "TODO: support PDF children" |
| `CitekeyPopover/index.tsx:18` | "TODO: Update to Popover2SharedProps" |

---

## Feature Gaps

### Missing User-Expected Features
1. **Batch Import** - Can only import one item at a time
2. **Search Filters** - No filter by type/year/author in main search (only in Dashboard Explorer)
3. **Saved Searches** - No query persistence
4. **Advanced Search** - No Boolean operators (AND/OR/NOT)
5. **Undo/Redo** - No undo for imports or tag deletions
6. **Citation Styles** - No CSL support (APA, Chicago, etc.)
7. **Sync Progress** - No progress indicator for large libraries
8. **Image Annotations** - Shows placeholder only (`NotesDrawer/index.tsx:60`)

### Hardcoded Limits
| Location | Value | Should Be |
|----------|-------|-----------|
| `SearchPanel/LibraryQueryList/index.tsx:23` | `results_limit = 50` | Configurable |
| Autocomplete menu | 25 items | Configurable |
| `SearchPanel/LibraryQueryList/index.tsx:21` | `query_debounce = 300` | Configurable |
| `clients/zotero/base.ts:100,109,110` | API limit 100 | Use constant |

### UX Friction Points
1. No loading indicator during search debounce
2. 50-result limit with no pagination
3. Autocomplete trigger (`@`) undiscoverable
4. 12 settings tabs with no guided setup
5. Silent copy - no toast notification
6. Modal stacking issues (escape key behavior)
7. No search history or recent searches

### Accessibility Gaps
- Missing `aria-live` regions for status updates
- `enforceFocus={false}` allows focus escape from modals
- Color-only annotation highlights (no text labels)
- Missing alt text on status icons
- No screen reader announcements for result counts

---

## Security Vulnerabilities

### npm audit Results (47 total)
| Severity | Count | Notable Packages |
|----------|-------|------------------|
| Critical | 3 | vitest (RCE), ws (DoS) |
| High | 14 | axios (SSRF), body-parser (DoS), cross-spawn (ReDoS) |
| Moderate | 21 | octokit (ReDoS), brace-expansion |
| Low | 9 | Various |

### Outdated Dependencies
| Package | Current | Latest | Gap |
|---------|---------|--------|-----|
| react | 17.0.2 | 19.2.0 | 2 major |
| @blueprintjs/core | 3.54.0 | 6.3.4 | 3 major |
| @tanstack/react-query | 4.36.1 | 5.90.10 | 1 major |
| idb | 6.1.5 | 8.0.3 | 2 major |

---

## Test Coverage

### Current State
- **Framework:** Vitest + Istanbul
- **Target:** 85% project-wide, 95% for utils
- **Actual:** ~37 test files for 249 TypeScript files (14.8% ratio)

### Coverage by Area
| Area | Status | Files Tested |
|------|--------|--------------|
| Utilities/Helpers | Good (~85%) | Well-covered |
| API Clients | Good | Integration tests with MSW |
| **UI Components** | **Critical Gap (~5%)** | 2 test files for 92 components |
| Visual | Partial | 49 Storybook stories |

### Files with Coverage Ignores
```javascript
/* istanbul ignore file */
- src/index.tsx
- src/components/App/index.tsx
- src/components/GraphWatcher/index.tsx
- src/components/Autocomplete/index.tsx
// ... 8+ files total
```

### TypeScript Strictness
```json
{
  "strictNullChecks": true,      // Good
  "strictBindCallApply": true,   // Good
  "noImplicitAny": false,        // Weak - allows implicit any
  // ESLint also has @typescript-eslint/no-explicit-any: off
}
```

---

## Improvement Recommendations

### Priority 1: Fix Freezing (Performance)

1. **Replace O(n²) with Map lookups**
   - `src/clients/zotero/helpers.ts` - `categorizeZoteroTags()`, `matchWithCurrentData()`
   - `src/utils.ts` - `identifyChildren()`

2. **Fix GraphWatcher polling**
   - Change from 1s setInterval to MutationObserver
   - Or debounce with 3-5s interval

3. **Chunk data processing**
   - `src/components/Dashboard/Explorer/QueryItems/index.tsx`
   - Use `requestIdleCallback` with batches of 100

4. **Add concurrency control**
   - `src/clients/zotero/base.ts:fetchAdditionalData()`
   - Use p-limit to cap parallel requests

### Priority 2: Fix Bugs

1. **Add error handling**
   - Replace silent catches with user notifications
   - Wrap JSON.parse in try-catch
   - Add array bounds checking

2. **Fix race conditions**
   - Proper cleanup in useEffect for intervals
   - Add loading states to prevent double-execution

### Priority 3: Security

1. **Update critical packages**
   ```bash
   npm update vitest axios ws
   npm audit fix
   ```

### Priority 4: Features

1. **AI Integration** (user request)
   - Semantic search with embeddings
   - LLM chat with library
   - Auto-summaries

2. **Batch operations**
   - Multi-select in search
   - Bulk import

3. **Better search**
   - Filters in main search
   - Boolean operators
   - Saved searches

### Priority 5: Code Quality

1. **Add component tests** for App, Dashboard, SearchPanel, GraphWatcher
2. **Migrate App to hooks** (currently class component)
3. **Enable stricter TypeScript** (`noImplicitAny: true`)
4. **Update major dependencies** (React 18+, Blueprint 5+)

---

## Roam API Usage Analysis

### Current API Usage (from `/home/user/roam-docs/`)

Based on official Roam documentation, here's how zotero-roam uses the Roam APIs:

#### What's Being Used Correctly
- `window.roamAlphaAPI.data.block.create()` - Creating blocks
- `window.roamAlphaAPI.data.page.create()` - Creating pages
- `window.roamAlphaAPI.ui.commandPalette.addCommand()` - Command palette integration
- `window.roamAlphaAPI.util.generateUID()` - UID generation
- `window.roamAlphaAPI.util.dateToPageTitle()` - Date utilities
- `window.roamAlphaAPI.ui.rightSidebar.addWindow()` - Sidebar integration

#### Critical Issues Found

**1. Using SYNC API Instead of ASYNC (Deprecation Risk)**

**Location:** `src/services/roam/index.ts:189, 213, 231, 244, 255, 308`

```javascript
// Current (SYNC - will be deprecated):
window.roamAlphaAPI.data.q(`[:find ...]`)

// Should use (ASYNC):
await window.roamAlphaAPI.data.async.q(`[:find ...]`)
```

From Roam docs: *"Eventually Roam will migrate to the async API and the sync functions will be deprecated. If you are building a new extension you should prefer using these to avoid migrating in the future."*

**2. Polling Instead of Pull Watches (Major Performance Issue)**

**Location:** `src/components/GraphWatcher/index.tsx:66-76`

Current implementation polls every 1 second with setInterval + querySelectorAll. Roam provides `addPullWatch` for reactive updates:

```javascript
// Current (inefficient):
setInterval(() => {
    document.querySelectorAll("h1.rm-title-display")...
}, 1000);

// Should use:
window.roamAlphaAPI.data.addPullWatch(
    "[:block/string {:block/children ...}]",
    '[:block/uid "page-uid"]',
    (before, after) => { /* react to changes */ }
);
```

**3. Missing Context Menu Integration**

Roam provides official APIs for adding to context menus that zotero-roam doesn't use:

```javascript
// Available but not used:
roamAlphaAPI.ui.blockContextMenu.addCommand({
    label: "Zotero: Import Citation",
    callback: (context) => { /* ... */ }
});

roamAlphaAPI.ui.pageContextMenu.addCommand({
    label: "Zotero: View in Zotero",
    'display-conditional': (ctx) => ctx['page-title'].startsWith('@'),
    callback: (context) => { /* ... */ }
});

roamAlphaAPI.ui.pageRefContextMenu.addCommand({
    label: "Zotero: Open Item Details",
    callback: (context) => { /* ... */ }
});
```

**4. Not Using Roam's Bundled Dependencies**

**Location:** `package.json`

Roam bundles these dependencies (available on `window`):
- `window.React` (v17.0.2)
- `window.ReactDOM` (v17.0.2)
- `window.Blueprint.Core` (v3.50.4)
- `window.Blueprint.Select` (v3.18.6)
- `window.Blueprint.DateTime` (v3.23.14)
- `window.idb` (v6.0.0)

zotero-roam bundles its own copies, increasing bundle size unnecessarily.

**5. Query Timeout Risk**

From Roam docs: *"q, pull, and variant API functions now have a timeout of 20 seconds. Throws an error with message 'Query and/or pull expression took too long to run.'"*

Large Zotero libraries could trigger this timeout. No error handling for this case exists.

#### Recommended Roam API Enhancements

| Feature | Roam API | Benefit |
|---------|----------|---------|
| Watch citekey pages | `addPullWatch` | Replace 1s polling, reactive updates |
| Slash commands | `slashCommand.addCommand` | Quick citation insertion |
| Block context menu | `blockContextMenu.addCommand` | Add Zotero actions to blocks |
| Page context menu | `pageContextMenu.addCommand` | Actions on citekey pages |
| Multi-select menu | `msContextMenu.addCommand` | Bulk operations |
| Graph view | `graphView.addCallback` | Visualize Zotero connections |

#### Datalog Query Props Available

For querying Roam data, these attributes are available (from `Roam Research Block Datalog Props.md`):

| Attribute | Purpose |
|-----------|---------|
| `:block/string` | Block text content |
| `:block/uid` | Unique identifier |
| `:block/refs` | Referenced pages/blocks |
| `:block/children` | Child blocks |
| `:block/page` | Parent page |
| `:node/title` | Page title |
| `:create/time` | Creation timestamp |
| `:edit/time` | Last edit timestamp |

---

## Quick Reference: Common Tasks

### Finding where items are fetched
→ `src/clients/zotero/hooks.ts:useItems()` (line 42)
→ `src/clients/zotero/base.ts:fetchItems()` (line 343)

### Finding where items are displayed
→ `src/components/SearchPanel/LibraryQueryList/index.tsx`
→ `src/components/Dashboard/Explorer/QueryItems/index.tsx`

### Finding where metadata is imported to Roam
→ `src/services/roam/index.ts:addBlock()` (line ~200)
→ `src/api/helpers.ts:formatItemMetadata()`

### Finding settings configuration
→ `src/components/UserSettings/` (12 subdirectories)
→ `src/types/extension/settings.ts`

### Finding DOM watchers (performance critical)
→ `src/components/GraphWatcher/index.tsx` (main watcher)
→ `src/components/GraphWatcher/InlineCitekeys/index.tsx`
→ `src/components/GraphWatcher/Menus/utils.ts`

### Finding React Query configuration
→ `src/components/App/index.tsx` (QueryClient setup, line 38)
→ `src/services/react-query/index.ts` (query keys, selectors)

### Finding Roam API interactions
→ `src/services/roam/index.ts` (all Roam operations)
→ `src/services/roam/types.ts` (Roam type definitions)
