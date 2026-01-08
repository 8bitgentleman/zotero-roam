# Zotero-Roam Implementation Plan

**Created:** 2026-01-08
**Fork:** https://github.com/8bitgentleman/zotero-roam

## Overview

This document outlines the implementation strategy for addressing issues and improvements identified in the fork review. Issues are categorized by priority, effort, and grouped into logical PRs.

---

## PR Grouping Strategy

### Why Group Some Changes?

**Separate PRs:**
- Security updates (merge fast, independent)
- Large features (easier review, can be reverted independently)
- Breaking changes (need careful review)
- Experimental features (may not be accepted)

**Grouped PRs:**
- Related bug fixes (context helps reviewers)
- Multiple small formatting/template changes (test together)
- Documentation updates (logical grouping)

---

## Phase 1: Critical Fixes & Security

### PR #1: Security Dependency Updates ⚡
**Priority:** CRITICAL | **Effort:** 30 min | **Risk:** LOW

**Changes:**
- Update axios to v1.8.2 (fixes security vulnerability)
- Update vite to v5.4.19 (fixes security vulnerability)
- Run tests to ensure no breaking changes

**Files:**
- `package.json`
- `package-lock.json`

**Why Separate:** Security fixes should be merged immediately without waiting for other work.

**Testing:**
```bash
npm install
npm run test
npm run build:prod
```

---

### PR #2: Fix Settings Loss in Shared Graphs (Issue #790) 🔥
**Priority:** CRITICAL | **Effort:** 2-3 hours | **Risk:** LOW-MEDIUM

**Problem:**
- `configRoamDepot()` writes ALL settings back on every load
- Roam sometimes returns incomplete settings (missing nested objects)
- Defaults with empty values overwrite user configurations
- Affects shared graphs where multiple users load the extension

**Solution:**
- Remove automatic write-back in `configRoamDepot()`
- Only write settings on first-time setup or explicit user changes
- Merge defaults in-memory for use, don't persist them

**Files:**
- `src/setup.ts` - Main fix in `configRoamDepot()` function
- `src/setup.test.ts` - Add/update tests
- `src/api/index.tsx` - May need updates if it calls setup

**Implementation:**
```typescript
function configRoamDepot({ extensionAPI }: { extensionAPI: Roam.ExtensionAPI }){
    const current = extensionAPI.settings.getAll();

    // Only write on first-time setup
    if (!current || Object.keys(current).length === 0) {
        const settings = setupInitialSettings({});
        Object.entries(settings).forEach(([key, val]) => {
            extensionAPI.settings.set(key, val);
        });

        let requests = {
            dataRequests: [],
            apiKeys: [],
            libraries: []
        };
        extensionAPI.settings.set("requests", requests);

        return { requests, settings };
    }

    // Subsequent loads: merge in-memory only, don't write back
    const settings = setupInitialSettings(current || {});
    let requests = extensionAPI.settings.get<UserRequests>("requests") || {
        dataRequests: [],
        apiKeys: [],
        libraries: []
    };

    return { requests, settings };
}
```

**Testing:**
- [ ] Fresh install: settings are created correctly
- [ ] Reload: settings persist without being overwritten
- [ ] Partial settings (missing nested objects): defaults used but not persisted
- [ ] User changes settings: changes persist correctly

**Why Separate:** Critical bug affecting user trust. Needs careful testing. Clear scope for revert if issues arise.

---

## Phase 2: Easy Wins (Low Effort, High Impact)

### PR #3: Small Bug Fixes & Template Improvements 🎯
**Priority:** HIGH | **Effort:** 3-4 hours | **Risk:** LOW

**Why Grouped:** All are small, related formatting/template changes. Testing them together ensures compatibility. If one has issues, easy to identify which one.

#### Fix A: Add Year to Default Metadata Template (Issue #23)
**Effort:** 30 min

**Changes:**
- Review current default metadata formatter
- Add publication year field to template
- Update documentation

**Files:**
- `src/api/helpers.ts` - `formatItemMetadata()` function
- Possibly `src/setup.ts` - if defaults need updating

**Implementation Notes:**
- Check `getItemPublication()` function for year extraction
- Ensure year is available in default typemap
- Test with items that have/don't have year

---

#### Fix B: Improve Notes Bullet Formatting (Issue #26)
**Effort:** 1-2 hours

**Changes:**
- Fix HTML → Roam markdown conversion for bullets
- Handle nested lists properly
- Preserve indentation

**Files:**
- `src/api/helpers.ts` - `formatNotes()` function
- May need to update HTML parsing logic

**Implementation Notes:**
- Test with various HTML bullet formats (`<ul>`, `<ol>`, nested)
- Ensure proper Roam block structure (indentation with tabs/spaces)
- Handle edge cases: mixed lists, empty list items

---

#### Fix C: Add Authors/Editors Conditional (Issue #19)
**Effort:** 1 hour

**Changes:**
- Add metadata template option: "authors, or editors if no authors"
- Extend `getItemCreators()` or create new helper

**Files:**
- `src/api/helpers.ts` - Creator extraction logic
- `src/types/extension/settings.ts` - If adding new setting

**Implementation Notes:**
- Check if item has authors
- Fallback to editors if authors empty
- Format consistently with existing creator formatting

---

**Combined Testing for PR #3:**
```bash
# Test metadata formatting
- Item with year → year appears
- Item without year → no error
- Notes with bullets → proper Roam formatting
- Item with authors → shows authors
- Item with editors but no authors → shows editors
- Item with both → shows authors (not editors)
```

**Why Grouped:** Related formatting/template improvements. Low risk. Testing together ensures they don't conflict. Single review cycle.

---

## Phase 3: Investigation & Compatibility

### PR #4: Investigate and Fix Metadata Import Failures (Issue #793) 🔍
**Priority:** HIGH | **Effort:** 4-6 hours | **Risk:** MEDIUM

**Status:** Needs investigation first

**Problem:**
- Recent items fail metadata import
- Older items work fine
- AxiosError reported
- Possibly related to Zotero 7 format changes

**Investigation Steps:**
1. Set up test environment with Zotero 7
2. Create fresh test items
3. Reproduce the error
4. Check API response format
5. Compare old vs new item structure
6. Review error logs

**Likely Files:**
- `src/api/index.tsx` - Metadata import logic
- `src/clients/zotero/base.ts` - API calls
- `src/clients/zotero/helpers.ts` - Data processing
- `src/api/helpers.ts` - Formatting

**Testing:**
- [ ] Import metadata for new items (created today)
- [ ] Import metadata for old items (6+ months ago)
- [ ] Check various item types (book, article, webpage, etc.)
- [ ] Test with/without attachments
- [ ] Test with/without notes/annotations

**Why Separate:** Requires investigation. Unknown scope. May uncover additional issues. Should not block other PRs.

---

### PR #5: Update Citation Key Handling for Zotero 7 🔑
**Priority:** HIGH | **Effort:** 4-6 hours | **Risk:** MEDIUM

**Problem:**
- Current code only checks `"Citation Key: "` in Extra field
- Better BibTeX on Zotero 7 may store keys differently
- Limited API support in Zotero 7 BBT

**Investigation Steps:**
1. Install Zotero 7 + Better BibTeX
2. Generate citation keys
3. Check where keys are stored (Extra field? Other field?)
4. Test various BBT settings
5. Check for BBT API access (if available)

**Implementation:**
Update `extractCitekeys()` in `src/clients/zotero/helpers.ts:74-92`

**Possible Solutions:**
```typescript
// Current (line 81-84)
if (item.data.extra.includes("Citation Key: ")) {
    key = item.data.extra.match("Citation Key: (.+)")?.[1] || key;
    has_citekey = true;
}

// Enhanced (check multiple sources)
function extractCitekeyFromItem(item) {
    let key = item.key;
    let has_citekey = false;

    // Method 1: Check Extra field (BBT 5.x & 6.x)
    if (item.data.extra?.includes("Citation Key: ")) {
        const match = item.data.extra.match(/Citation Key:\s*(.+?)(?:\n|$)/);
        if (match) {
            key = match[1].trim();
            has_citekey = true;
            return { key, has_citekey };
        }
    }

    // Method 2: Check citationKey field (if exposed by API)
    if (item.data.citationKey) {
        key = item.data.citationKey;
        has_citekey = true;
        return { key, has_citekey };
    }

    // Method 3: Check BBT API (if available)
    // TODO: Research if BBT exposes JSON-RPC API

    return { key, has_citekey };
}
```

**Files:**
- `src/clients/zotero/helpers.ts` - Update `extractCitekeys()`
- `src/clients/zotero/helpers.test.ts` - Add test cases
- `src/clients/zotero/types.ts` - May need type updates

**Testing:**
- [ ] Zotero 6 + BBT: citation keys extracted correctly
- [ ] Zotero 7 + BBT: citation keys extracted correctly
- [ ] Items without BBT: falls back to Zotero key
- [ ] Special characters in keys: handled properly
- [ ] Multiple citation formats: all work

**Why Separate:** Needs Zotero 7 testing environment. Affects core functionality. Should be thoroughly tested before merge.

---

## Phase 4: Performance Improvements

### PR #6: Add Performance Monitoring & Optimization 📊
**Priority:** MEDIUM | **Effort:** 6-8 hours | **Risk:** LOW-MEDIUM

**Why Grouped:** All performance-related changes. Need to test together to measure cumulative impact.

#### Enhancement A: Add Performance Metrics
**Effort:** 2 hours

**Changes:**
- Add timing for initial load
- Track API call duration
- Measure memory usage
- Log library size correlation

**Files:**
- `src/api/index.tsx` - Add logging
- `src/clients/zotero/base.ts` - Track API calls
- `src/services/idb/index.ts` - Track cache operations

**Implementation:**
```typescript
// Track load time
const startTime = performance.now();
// ... load operations ...
const duration = performance.now() - startTime;

window.zoteroRoam?.info?.({
    origin: "Performance",
    message: `Loaded ${itemCount} items in ${duration.toFixed(2)}ms`,
    context: {
        itemCount,
        duration,
        cacheUsed: true/false,
        apiCalls: callCount
    }
});
```

---

#### Enhancement B: Add Loading Indicators
**Effort:** 2 hours

**Changes:**
- Show progress during initial load
- Display batch loading status
- Add retry/backoff feedback

**Files:**
- `src/components/Dashboard/` - UI components
- `src/api/index.tsx` - Emit progress events

---

#### Enhancement C: Implement Progressive Loading
**Effort:** 3-4 hours

**Changes:**
- Load first 100 items immediately (show UI)
- Load remainder in background
- Update UI as batches complete

**Files:**
- `src/clients/zotero/base.ts` - Batch loading logic
- `src/services/react-query/` - Query strategies
- `src/components/Dashboard/` - Update UI

**Testing:**
- [ ] Small library (50 items): loads fast, no issues
- [ ] Medium library (1000 items): progressive loading works
- [ ] Large library (5000+ items): doesn't freeze UI
- [ ] Network interruption: graceful degradation
- [ ] Cache enabled: faster subsequent loads

**Why Grouped:** Performance improvements should be measured together. Need to test on various library sizes. Single review cycle for performance focus.

---

## Phase 5: Feature Enhancements

### PR #7: Add Batch Metadata Import (Issue #550) 🚀
**Priority:** MEDIUM | **Effort:** 4-6 hours | **Risk:** LOW-MEDIUM

**Changes:**
- Add multi-select in Explorer/Dashboard
- Batch API calls (respect rate limits)
- Show progress indicator
- Handle partial failures gracefully

**Files:**
- `src/components/Dashboard/Explorer/` - Add multi-select UI
- `src/components/Dashboard/RecentItems/` - Batch actions
- `src/api/index.tsx` - Batch import logic
- `src/components/GraphWatcher/Menus/` - Update menu items

**Implementation Strategy:**
```typescript
async function importMetadataBatch(items: ZItemTop[]) {
    const total = items.length;
    let succeeded = 0;
    let failed = 0;

    // Show progress UI
    const progressId = showProgress({ total, current: 0 });

    // Process in batches to respect rate limits
    const batchSize = 5;
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);

        try {
            await Promise.all(batch.map(item => importMetadata(item)));
            succeeded += batch.length;
        } catch (error) {
            // Handle partial failures
            failed += batch.length;
            logError(error);
        }

        updateProgress(progressId, { current: i + batch.length });

        // Respect rate limiting
        await sleep(1000);
    }

    hideProgress(progressId);
    showSummary({ total, succeeded, failed });
}
```

**Testing:**
- [ ] Select multiple items (5, 10, 50)
- [ ] Progress indicator shows correctly
- [ ] Partial failures handled gracefully
- [ ] Rate limiting respected (no 429 errors)
- [ ] UI remains responsive during batch

**Why Separate:** Significant feature addition. New UI components. Needs thorough testing. Can be used independently.

---

## Phase 6: Evaluate Upstream PRs

### PR #8: Evaluate & Merge Explorer Refactor (Upstream #702) 🤔
**Priority:** LOW-MEDIUM | **Effort:** 8-12 hours | **Risk:** HIGH

**Status:** Requires careful evaluation

**Upstream PR Details:**
- Author: Original maintainer (alixlahuec)
- Status: Draft, incomplete
- Changes: 72 commits, 159 files
- Benefits: Better UX for queries (single text string vs. buttons/dropdowns)
- Concerns: Incomplete, needs styling/stories, large diff

**Evaluation Steps:**
1. Create feature branch
2. Cherry-pick or merge upstream PR
3. Resolve conflicts
4. Complete outstanding TODOs
5. Test thoroughly
6. Compare UX improvement vs. maintenance burden

**Decision Criteria:**
- Does it work without bugs?
- Is the UX significantly better?
- Can we maintain the new code?
- Does it conflict with our other changes?

**Files:** 159 files (large refactor)

**Why Separate:** Large, incomplete feature from upstream. High risk. Should not block other work. May decide not to merge.

**Recommendation:** Defer until Phase 1-5 complete. Only consider if all critical fixes are done and stable.

---

## Quick Reference: Easy Wins Priority Order

### 🥇 Start Here (Can Do Today)

**1. PR #1: Security Updates** ⚡
- **Effort:** 30 minutes
- **Impact:** HIGH (security)
- **Risk:** LOW
- **Blocking:** Nothing
- **Why First:** Quick, safe, high value

**2. PR #2: Fix Issue #790** 🔥
- **Effort:** 2-3 hours
- **Impact:** CRITICAL (user trust)
- **Risk:** LOW-MEDIUM
- **Blocking:** Nothing
- **Why Second:** Most impactful bug fix, clear solution

---

### 🥈 Next Steps (This Week)

**3. PR #3: Small Bug Fixes** 🎯
- **Effort:** 3-4 hours
- **Impact:** MEDIUM-HIGH
- **Risk:** LOW
- **Blocking:** Nothing
- **Why Third:** Quick wins, good for momentum, user-facing improvements

---

### 🥉 After Easy Wins (Next Week)

**4. Set Up Test Environment** 🧪
- Install Zotero 7
- Create test libraries (small/medium/large)
- Install Better BibTeX
- Generate test data
- Set up API keys

**5. PR #4: Investigate Issue #793** 🔍
- **Needs:** Test environment
- **Effort:** 4-6 hours
- **Impact:** HIGH (currently broken)
- **Risk:** MEDIUM

**6. PR #5: Citation Key Updates** 🔑
- **Needs:** Test environment with Zotero 7 + BBT
- **Effort:** 4-6 hours
- **Impact:** HIGH (core functionality)
- **Risk:** MEDIUM

---

## PR Strategy Summary

| PR | Description | Priority | Effort | Separate/Grouped |
|---|---|---|---|---|
| #1 | Security updates | CRITICAL | 30m | Separate |
| #2 | Fix Issue #790 | CRITICAL | 2-3h | Separate |
| #3 | Small bug fixes (#23, #26, #19) | HIGH | 3-4h | **Grouped** |
| #4 | Investigate Issue #793 | HIGH | 4-6h | Separate |
| #5 | Citation keys for Zotero 7 | HIGH | 4-6h | Separate |
| #6 | Performance improvements | MEDIUM | 6-8h | **Grouped** |
| #7 | Batch import | MEDIUM | 4-6h | Separate |
| #8 | Evaluate upstream #702 | LOW | 8-12h | Separate |

---

## When to Group vs. Separate

### ✅ Group These Types:
- Related formatting/template fixes (PR #3)
- Performance improvements that need joint testing (PR #6)
- Documentation updates
- Multiple fixes in same file/function
- Changes that provide context for each other

### ❌ Keep Separate:
- Security updates (fast track)
- Critical bugs (clear scope for rollback)
- Large features (easier review)
- Changes requiring investigation
- Experimental changes
- Breaking changes

---

## Testing Strategy

### Before Each PR:
```bash
# Run full test suite
npm run test

# Type checking
npm run typecheck

# Build for production
npm run build:prod

# Build for Roam Depot
npm run build:roam

# Manual testing in Roam
# - Load extension
# - Test changed functionality
# - Check console for errors
# - Verify settings persist
```

### Integration Testing:
After merging multiple PRs, test interactions:
- Settings persistence + new features
- Performance improvements + batch operations
- Citation keys + metadata import

---

## Timeline Estimate

| Phase | Duration | PRs |
|---|---|---|
| **Phase 1: Critical** | Week 1 | #1, #2 |
| **Phase 2: Easy Wins** | Week 1-2 | #3 |
| **Phase 3: Investigation** | Week 2-3 | #4, #5 |
| **Phase 4: Performance** | Week 3-4 | #6 |
| **Phase 5: Features** | Week 4-5 | #7 |
| **Phase 6: Evaluation** | Week 5+ | #8 (maybe) |

**Total:** ~5 weeks for core improvements (Phases 1-5)

---

## Success Metrics

### After Phase 1-2 (2 weeks):
- ✅ No security vulnerabilities
- ✅ Settings persist correctly in shared graphs
- ✅ Year shows in metadata
- ✅ Notes format correctly
- ✅ Authors/editors conditional works

### After Phase 3 (3 weeks):
- ✅ Recent items import successfully
- ✅ Citation keys work with Zotero 7
- ✅ Better BibTeX integration confirmed

### After Phase 4-5 (5 weeks):
- ✅ Large libraries don't freeze UI
- ✅ Performance metrics available
- ✅ Batch import works
- ✅ Loading indicators help UX

### Longer Term:
- ✅ Upstream PR #702 evaluated
- ✅ Community feedback incorporated
- ✅ Documentation updated
- ✅ New version released

---

## Notes

- **PR Size:** Aim for <500 lines changed per PR (except large features)
- **Review Time:** Small PRs get faster reviews
- **Rollback:** Separate critical fixes make rollback easier
- **Testing:** Grouped PRs need comprehensive integration testing
- **Documentation:** Update docs in same PR as feature changes

## Questions to Answer

- [ ] Do we want to maintain Zotero 6 compatibility or focus on Zotero 7?
- [ ] What's the minimum library size that causes freezing?
- [ ] Should we add telemetry/analytics for performance tracking?
- [ ] Do we want to add a "lite mode" for large libraries?
