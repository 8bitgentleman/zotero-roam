# Zotero-Roam Improvement Plan

> **Goal:** Fix freezing issues, modernize Roam API usage, address security vulnerabilities, and enhance features.
>
> **User Feedback to Address:**
> - "I stopped using the Zotero extension because it would freeze once in a while, I think because of my zotero db size."
> - "Enable AI integration. Make it possible to chat with your zotero database while inside of Roam."

---

## Phase 1: Quick Wins (Low Effort, High Impact)

These can be done independently and provide immediate value.

### 1.1 Fix Silent Error Swallowing
**Effort:** 1-2 hours | **Impact:** Debugging, User Experience

| Location | Current | Fix |
|----------|---------|-----|
| `src/components/NotesImport/index.tsx:94-96` | `catch(e){ // }` | Add user notification + console.error |
| `src/components/Autocomplete/index.tsx:157-159` | `catch(e){ // Do nothing }` | Log error, don't swallow |
| `src/components/GraphWatcher/InlineCitekeys/index.tsx:126-131` | `catch(e){ // Do nothing }` | Log error with context |

```typescript
// Before
catch(e) { // }

// After
catch(e) {
    console.error("[zotero-roam] Operation failed:", e);
    window.zoteroRoam?.warn?.({ message: "Operation failed", context: { error: e } });
}
```

---

### 1.2 Add Try-Catch to JSON.parse Calls
**Effort:** 1 hour | **Impact:** Prevents crashes

| Location | Risk |
|----------|------|
| `src/utils.ts:835` | `JSON.parse(annotationPosition)` crashes on invalid JSON |
| `src/components/GraphWatcher/WebImport/helpers.ts:22,27` | Attribute could be malformed |
| `src/components/GraphWatcher/Menus/index.tsx:99` | Non-null assertion + parse |

```typescript
// Before
const data = JSON.parse(value);

// After
let data;
try {
    data = JSON.parse(value);
} catch (e) {
    console.error("[zotero-roam] Invalid JSON:", value);
    data = null; // or default value
}
```

---

### 1.3 Add Array Bounds Checking
**Effort:** 1 hour | **Impact:** Prevents crashes

| Location | Issue | Fix |
|----------|-------|-----|
| `src/services/react-query/index.ts:137` | `matchAll()[0]` on empty | Add `?.[0]` or length check |
| `src/components/GraphWatcher/InlineCitekeys/index.tsx:256,287,309` | `getElementsByClassName()[0]` | Add null check |

```typescript
// Before
const [, , , itemKey] = Array.from(itemURI.matchAll(relRegex))[0];

// After
const matches = Array.from(itemURI.matchAll(relRegex));
if (!matches.length) return null;
const [, , , itemKey] = matches[0];
```

---

### 1.4 Add Debouncing to Autocomplete Filter
**Effort:** 30 minutes | **Impact:** Reduces lag on typing

**Location:** `src/components/Autocomplete/index.tsx:109-111`

```typescript
// Before - filters on every keystroke
values: (text, cb) => {
    cb(formattedLib.filter(item =>
        item[LOOKUP_KEY].toLowerCase().includes(text.toLowerCase())));
}

// After - debounce by 150ms
import { useDebouncedCallback } from "@hooks/useDebounceCallback";

const debouncedFilter = useDebouncedCallback((text, cb) => {
    cb(formattedLib.filter(item =>
        item[LOOKUP_KEY].toLowerCase().includes(text.toLowerCase())));
}, 150);

values: (text, cb) => debouncedFilter(text, cb)
```

---

### 1.5 Make Result Limits Configurable
**Effort:** 1 hour | **Impact:** User control

**Locations:**
- `src/components/SearchPanel/LibraryQueryList/index.tsx:23` - hardcoded `50`
- Autocomplete menu - hardcoded `25`

```typescript
// Add to settings type
interface UserSettings {
    // ... existing
    other: {
        searchResultsLimit: number; // default 50
        autocompleteLimit: number;  // default 25
    }
}
```

---

### 1.6 Add Loading Indicator to Search
**Effort:** 30 minutes | **Impact:** Better UX

**Location:** `src/components/SearchPanel/LibraryQueryList/index.tsx`

```typescript
const [isSearching, setIsSearching] = useState(false);

// Show spinner during debounce
{isSearching && <Spinner size={SpinnerSize.SMALL} />}
```

---

## Phase 2: Performance Fixes (Medium Effort, Critical Impact)

These directly address the freezing issue.

### 2.1 Replace O(n²) Tag Categorization with Map
**Effort:** 2-3 hours | **Impact:** Critical for large libraries

**Location:** `src/clients/zotero/helpers.ts:37-65`

```typescript
// Before - O(n²)
for (const elem of zdata) {
    const in_table = output.findIndex(tk =>
        searchEngine(elem, tk.token, { any_case: true, match: "exact" }));
}

// After - O(n) with Map
function categorizeZoteroTags(z_data: string[], tagMap: ZTagMap): ZTagEntry[] {
    const tokenIndex = new Map<string, number>(); // token -> index in output
    const output: ZTagEntry[] = [];

    for (const elem of z_data.sort((a, b) => b.localeCompare(a))) {
        const normalizedToken = elem.toLowerCase();
        const existingIndex = tokenIndex.get(normalizedToken);

        if (existingIndex !== undefined) {
            // Update existing entry
            output[existingIndex].zotero.push(...);
        } else {
            // Create new entry
            const newIndex = output.length;
            tokenIndex.set(normalizedToken, newIndex);
            output.push({ token: normalizedToken, roam: [], zotero: [...] });
        }
    }
    return output;
}
```

---

### 2.2 Replace O(n) Item Merging with Map
**Effort:** 2 hours | **Impact:** Critical for sync performance

**Location:** `src/clients/zotero/helpers.ts:154-161`

```typescript
// Before - O(n*m)
modifiedData.forEach(item => {
    const duplicateIndex = datastore.findIndex(i => i.data.key == item.data.key);
});

// After - O(n+m)
function matchWithCurrentData<T extends { data: { key: string } }>(
    update: { modified?: T[], deleted?: string[] },
    arr: T[] = []
): T[] {
    const { modified = [], deleted = [] } = update;
    const deletedSet = new Set(deleted);

    // Build index map
    const keyToIndex = new Map<string, number>();
    const datastore = arr.filter((item, index) => {
        if (deletedSet.has(item.data.key)) return false;
        keyToIndex.set(item.data.key, index);
        return true;
    });

    // Merge modified items
    for (const item of modified) {
        const existingIndex = keyToIndex.get(item.data.key);
        if (existingIndex !== undefined) {
            datastore[existingIndex] = item;
        } else {
            datastore.push(item);
        }
    }
    return datastore;
}
```

---

### 2.3 Optimize identifyChildren with Pre-built Index
**Effort:** 2 hours | **Impact:** High for item display

**Location:** `src/utils.ts:515-524`

```typescript
// Before - called for every item, filters entire arrays
function identifyChildren(itemKey, location, { pdfs = [], notes = [] }) {
    const pdfItems = pdfs.filter(p => p.data.parentItem == itemKey && ...);
    const noteItems = notes.filter(n => ...);
}

// After - build index once, O(1) lookups
function buildChildrenIndex(pdfs: ZItemAttachment[], notes: (ZItemNote | ZItemAnnotation)[]) {
    const pdfsByParent = new Map<string, ZItemAttachment[]>();
    const notesByParent = new Map<string, (ZItemNote | ZItemAnnotation)[]>();

    for (const pdf of pdfs) {
        const key = `${pdf.data.parentItem}:${pdf.library.type}s/${pdf.library.id}`;
        if (!pdfsByParent.has(key)) pdfsByParent.set(key, []);
        pdfsByParent.get(key)!.push(pdf);
    }
    // Similar for notes...

    return { pdfsByParent, notesByParent };
}

function identifyChildren(itemKey, location, index) {
    const key = `${itemKey}:${location}`;
    return {
        pdfs: index.pdfsByParent.get(key) || [],
        notes: index.notesByParent.get(key) || []
    };
}
```

---

### 2.4 Chunk Data Processing with requestIdleCallback
**Effort:** 3-4 hours | **Impact:** Eliminates UI freezing

**Location:** `src/components/Dashboard/Explorer/QueryItems/index.tsx:19-33`

```typescript
// Before - processes all items synchronously
function cleanLibraryData(itemList, roamCitekeys): Promise<ZCleanItemTop[]> {
    return new Promise((resolve) => {
        setTimeout(() => {
            const data = itemList.items.map(item => cleanLibraryItem(...));
            resolve(data);
        }, 0);
    });
}

// After - process in chunks with progress
async function cleanLibraryData(
    itemList: ZLibraryContents,
    roamCitekeys: RCitekeyPages,
    onProgress?: (percent: number) => void
): Promise<ZCleanItemTop[]> {
    const CHUNK_SIZE = 100;
    const items = itemList.items;
    const results: ZCleanItemTop[] = [];

    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);

        // Process chunk
        for (const item of chunk) {
            results.push(cleanLibraryItem(item, pdfs, notes, roamCitekeys));
        }

        // Report progress
        onProgress?.(Math.round((i / items.length) * 100));

        // Yield to main thread
        await new Promise(resolve => {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(resolve, { timeout: 50 });
            } else {
                setTimeout(resolve, 0);
            }
        });
    }

    return results;
}
```

---

### 2.5 Add Concurrency Limit to API Pagination
**Effort:** 1-2 hours | **Impact:** Prevents rate limiting, reduces memory

**Location:** `src/clients/zotero/base.ts:104-122`

```typescript
// Before - all requests fire simultaneously
const apiCalls: Promise<AxiosResponse<T>>[] = [];
for (let i = 1; i <= nbExtraCalls; i++) {
    apiCalls.push(zoteroClient.get(...));
}
const apiResponses = await Promise.all(apiCalls);

// After - limit to 5 concurrent requests
async function fetchAdditionalData<T>(...) {
    const CONCURRENCY_LIMIT = 5;
    const results: T[] = [];

    for (let i = 0; i < nbExtraCalls; i += CONCURRENCY_LIMIT) {
        const batch = [];
        for (let j = i; j < Math.min(i + CONCURRENCY_LIMIT, nbExtraCalls); j++) {
            reqParams.set("start", `${100 * (j + 1)}`);
            batch.push(zoteroClient.get<T>(...));
        }
        const batchResults = await Promise.all(batch);
        results.push(...batchResults.map(r => r.data).flat());
    }

    return results;
}
```

---

## Phase 3: Roam API Modernization (Medium Effort, Future-Proofing)

### 3.1 Migrate from Sync to Async API
**Effort:** 4-6 hours | **Impact:** Prevents future breakage

**Locations:** `src/services/roam/index.ts:189, 213, 231, 244, 255, 308`

```typescript
// Before
const blockSearch = window.roamAlphaAPI.data.q<[[{ uid: string }]?]>(`...`);

// After
const blockSearch = await window.roamAlphaAPI.data.async.q<[[{ uid: string }]?]>(`...`);
```

**Files to update:**
- [ ] `src/services/roam/index.ts` - 6 query calls
- [ ] Any components that call these functions (make async)

---

### 3.2 Replace setInterval Polling with addPullWatch
**Effort:** 6-8 hours | **Impact:** Major performance improvement

**Location:** `src/components/GraphWatcher/index.tsx:66-76`

```typescript
// Before
const watcher = setInterval(() => {
    addPageMenus();
    setWebimportDivs(tags);
    updatePageElements();
}, 1000);

// After - Watch for page changes reactively
useEffect(() => {
    const pullPattern = "[:node/title :block/uid]";
    const watchedPages = new Set<string>();

    const watchPage = (pageUid: string) => {
        if (watchedPages.has(pageUid)) return;
        watchedPages.add(pageUid);

        window.roamAlphaAPI.data.addPullWatch(
            pullPattern,
            `[:block/uid "${pageUid}"]`,
            (before, after) => {
                // Only update when page actually changes
                if (JSON.stringify(before) !== JSON.stringify(after)) {
                    updatePageElements();
                }
            }
        );
    };

    // Watch current page
    const currentPageUid = window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
    if (currentPageUid) watchPage(currentPageUid);

    // Cleanup
    return () => {
        watchedPages.forEach(uid => {
            window.roamAlphaAPI.data.removePullWatch(pullPattern, `[:block/uid "${uid}"]`);
        });
    };
}, []);
```

---

### 3.3 Add Context Menu Integration
**Effort:** 3-4 hours | **Impact:** Better Roam integration

**Location:** New file `src/services/roam/contextMenus.ts`

```typescript
export function registerContextMenus() {
    // Block context menu - for any block
    window.roamAlphaAPI.ui.blockContextMenu.addCommand({
        label: "Zotero: Search for Citation",
        callback: (context) => {
            // Open search panel with block text as query
            openSearchPanel(context['block-string']);
        }
    });

    // Page context menu - for @citekey pages
    window.roamAlphaAPI.ui.pageContextMenu.addCommand({
        label: "Zotero: Open in Zotero",
        'display-conditional': (ctx) => ctx['page-title']?.startsWith('@'),
        callback: (context) => {
            const citekey = context['page-title'].slice(1);
            openInZotero(citekey);
        }
    });

    // Page ref context menu - for [[@citekey]] references
    window.roamAlphaAPI.ui.pageRefContextMenu.addCommand({
        label: "Zotero: View Item Details",
        'display-conditional': (ctx) => {
            const page = getPageTitle(ctx['ref-uid']);
            return page?.startsWith('@');
        },
        callback: (context) => {
            openItemDetails(context['ref-uid']);
        }
    });

    // Multi-select context menu
    window.roamAlphaAPI.ui.msContextMenu.addCommand({
        label: "Zotero: Import Citations to Selected",
        callback: (context) => {
            const selectedUids = window.roamAlphaAPI.ui.getSelectedUids();
            batchImportCitations(selectedUids);
        }
    });
}

export function unregisterContextMenus() {
    window.roamAlphaAPI.ui.blockContextMenu.removeCommand({ label: "Zotero: Search for Citation" });
    window.roamAlphaAPI.ui.pageContextMenu.removeCommand({ label: "Zotero: Open in Zotero" });
    window.roamAlphaAPI.ui.pageRefContextMenu.removeCommand({ label: "Zotero: View Item Details" });
    window.roamAlphaAPI.ui.msContextMenu.removeCommand({ label: "Zotero: Import Citations to Selected" });
}
```

---

### 3.4 Add Slash Command for Quick Citation
**Effort:** 2 hours | **Impact:** Faster workflow

```typescript
window.roamAlphaAPI.ui.slashCommand.addCommand({
    label: "Zotero Cite",
    callback: (context) => {
        // Open inline citation picker at cursor
        openInlineCitationPicker(context);
        return null; // Handle insertion manually
    }
});
```

---

## Phase 4: Security & Dependencies (Medium Effort, Required)

### 4.1 Update Critical Security Vulnerabilities
**Effort:** 2-3 hours | **Impact:** Security

```bash
# Critical vulnerabilities to fix
npm update vitest        # RCE vulnerability
npm update axios         # SSRF/credential leak
npm update ws            # DoS vulnerability

# Run audit and fix what's possible
npm audit fix
```

---

### 4.2 Update Major Dependencies
**Effort:** 8-16 hours | **Impact:** Maintenance, bundle size

| Package | Current | Target | Breaking Changes |
|---------|---------|--------|------------------|
| react | 17.0.2 | 18.x | Concurrent features, new root API |
| @blueprintjs/core | 3.54.0 | 5.x | Component API changes |
| @tanstack/react-query | 4.36.1 | 5.x | Query key changes |

**Migration order:**
1. React Query 4 → 5 (smaller surface area)
2. Blueprint.js 3 → 5 (UI components)
3. React 17 → 18 (requires Blueprint update first)

---

### 4.3 Use Roam's Bundled Dependencies (Optional)
**Effort:** 4-6 hours | **Impact:** Smaller bundle size

Update Vite config to use externals:

```typescript
// dev/vite.config.mts
export default defineConfig({
    build: {
        rollupOptions: {
            external: ['react', 'react-dom', '@blueprintjs/core', '@blueprintjs/select', '@blueprintjs/datetime', 'idb'],
            output: {
                globals: {
                    react: 'window.React',
                    'react-dom': 'window.ReactDOM',
                    '@blueprintjs/core': 'window.Blueprint.Core',
                    '@blueprintjs/select': 'window.Blueprint.Select',
                    '@blueprintjs/datetime': 'window.Blueprint.DateTime',
                    'idb': 'window.idb'
                }
            }
        }
    }
});
```

---

## Phase 5: Code Quality (Lower Priority)

### 5.1 Address TODO/FIXME Comments
**Effort:** 4-6 hours | **Impact:** Code quality

| Location | TODO | Action |
|----------|------|--------|
| `src/utils.ts:544` | FIXME: move to Zotero helpers | Move function |
| `src/services/roam/index.ts:146` | Migrate shortcuts to command palette | Done in 3.3 |
| `src/ItemDetails/index.tsx:52,103,238` | Move validation upstream | Centralize in setup.ts |
| `src/queries.ts:175,181` | Support PDF children | Implement filter |
| `src/CitekeyPopover/index.tsx:18` | Update to Popover2 | Migrate when updating Blueprint |

---

### 5.2 Add Component Tests
**Effort:** 8-12 hours | **Impact:** Reliability

Priority components to test:
1. `src/components/App/index.tsx` - Remove istanbul ignore, add tests
2. `src/components/GraphWatcher/index.tsx` - Critical for performance
3. `src/components/SearchPanel/index.tsx` - Core functionality
4. `src/components/Dashboard/index.tsx` - Main UI

---

### 5.3 Migrate App from Class to Hooks
**Effort:** 4-6 hours | **Impact:** Maintainability

**Location:** `src/components/App/index.tsx`

Convert class component to functional component with hooks for:
- QueryClient setup
- State management
- Lifecycle methods

---

### 5.4 Enable Stricter TypeScript
**Effort:** 4-8 hours | **Impact:** Type safety

```json
// tsconfig.json
{
    "compilerOptions": {
        "noImplicitAny": true,  // Currently false
        "strictNullChecks": true,  // Already enabled
        "strictFunctionTypes": true
    }
}
```

---

## Phase 6: New Features (Future)

### 6.1 AI Integration (User Request)
**Effort:** 20-40 hours | **Impact:** Major feature

**Possible approaches:**
1. **Semantic Search** - Embed Zotero items, enable similarity search
2. **Chat Interface** - Query library with natural language
3. **Auto-summarization** - Generate summaries of papers
4. **Connection Discovery** - Find related papers automatically

**Implementation considerations:**
- Need to decide on LLM provider (OpenAI, Anthropic, local)
- Embedding storage (in Roam? IndexedDB? External?)
- Privacy concerns with sending library data to external APIs
- Rate limiting and costs

---

### 6.2 Batch Import
**Effort:** 6-8 hours | **Impact:** Productivity

Add multi-select to search results:
- Checkbox on each result
- "Import Selected" button
- Progress indicator for bulk operations

---

### 6.3 Advanced Search
**Effort:** 8-12 hours | **Impact:** Power users

- Boolean operators (AND, OR, NOT)
- Field-specific search (`author:`, `year:`, `tag:`)
- Date range filters
- Saved searches

---

### 6.4 Citation Styles (CSL)
**Effort:** 12-16 hours | **Impact:** Academic users

Integrate Citation Style Language for proper formatting:
- APA, MLA, Chicago, etc.
- Use citeproc-js library
- Allow custom CSL files

---

## Implementation Order (Recommended)

### Week 1-2: Critical Bug Fixes
- [ ] Phase 1.1: Fix silent error swallowing
- [ ] Phase 1.2: Add try-catch to JSON.parse
- [ ] Phase 1.3: Add array bounds checking
- [ ] Phase 1.4: Add debouncing to autocomplete
- [ ] Phase 4.1: Update security vulnerabilities

### Week 3-4: Performance Fixes
- [ ] Phase 2.1: Replace O(n²) tag categorization
- [ ] Phase 2.2: Replace O(n) item merging
- [ ] Phase 2.3: Optimize identifyChildren
- [ ] Phase 2.4: Chunk data processing
- [ ] Phase 2.5: Add concurrency limit to API

### Week 5-6: Roam API Modernization
- [ ] Phase 3.1: Migrate to async API
- [ ] Phase 3.2: Replace polling with addPullWatch
- [ ] Phase 3.3: Add context menu integration
- [ ] Phase 3.4: Add slash command

### Week 7-8: Polish & Testing
- [ ] Phase 1.5: Make limits configurable
- [ ] Phase 1.6: Add loading indicators
- [ ] Phase 5.1: Address TODO comments
- [ ] Phase 5.2: Add component tests

### Future: Major Updates
- [ ] Phase 4.2: Update major dependencies
- [ ] Phase 5.3: Migrate to hooks
- [ ] Phase 6.x: New features

---

## Quick Reference: File Locations

| Issue | File | Line |
|-------|------|------|
| Silent error catch | `NotesImport/index.tsx` | 94-96 |
| Silent error catch | `Autocomplete/index.tsx` | 157-159 |
| Unsafe JSON.parse | `utils.ts` | 835 |
| Unsafe array access | `react-query/index.ts` | 137 |
| O(n²) tags | `zotero/helpers.ts` | 37-65 |
| O(n) merge | `zotero/helpers.ts` | 154-161 |
| identifyChildren | `utils.ts` | 515-524 |
| Blocking processing | `QueryItems/index.tsx` | 19-33 |
| No concurrency | `zotero/base.ts` | 104-122 |
| setInterval polling | `GraphWatcher/index.tsx` | 66-76 |
| Sync API usage | `roam/index.ts` | 189, 213, 231, 244, 255, 308 |
| No debounce | `Autocomplete/index.tsx` | 109-111 |
| Hardcoded limit | `LibraryQueryList/index.tsx` | 23 |

---

## Success Metrics

After implementing Phases 1-3:
- [ ] No UI freezing with 10,000+ item libraries
- [ ] Search response < 100ms
- [ ] Initial load < 5 seconds for large libraries
- [ ] Zero silent error swallowing
- [ ] All sync API calls migrated to async
- [ ] DOM polling eliminated (using pull watches)
