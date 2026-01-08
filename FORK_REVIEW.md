# Zotero-Roam Fork Review

**Review Date:** 2026-01-08
**Original Repository:** https://github.com/alixlahuec/zotero-roam
**Current Version:** 0.7.22

## Executive Summary

This review analyzes 14 open issues and 7 open pull requests from the original repository to identify opportunities for improvement in your fork.

### Priority Issues Identified

1. **Critical Bug (#790)**: Settings loss in shared graphs - HIGH PRIORITY
2. **Citation Key Compatibility**: Better BibTeX integration needs updating
3. **Performance**: Large database freezing issues
4. **Recent Bug (#793)**: Metadata import failures

---

## Pull Requests Analysis

### 🔴 Security PRs (RECOMMEND MERGING)

**#789 - Update axios to v1.8.2 [SECURITY]**
- **Status:** Open since Jun 24, 2025
- **Impact:** Security vulnerability in axios dependency
- **Recommendation:** **MERGE IMMEDIATELY**
- **Effort:** Minimal - dependency update

**#788 - Update vite to v5.4.19 [SECURITY]**
- **Status:** Open since Jun 24, 2025
- **Impact:** Security vulnerability in build tooling
- **Recommendation:** **MERGE IMMEDIATELY**
- **Effort:** Minimal - dependency update

**#792 - Update storybook to v8.6.15 [SECURITY]**
- **Status:** Marked as "abandoned"
- **Recommendation:** Evaluate if still needed, likely superseded by newer version

### 🟡 Feature PRs (EVALUATE CAREFULLY)

**#702 - feat: make the Explorer easier to use**
- **Author:** alixlahuec (original maintainer)
- **Status:** Draft, 72 commits, 159 files changed
- **Changes:**
  - Refactors query input from buttons/dropdowns to single text string
  - Adds real-time filter suggestions
  - Enables Notes tab completion and functional PDFs tab
- **Test Coverage:** 92.97% patch coverage, 84.07% overall
- **Outstanding Work:** Components styling, stories, PDF/Notes filter expansion
- **Recommendation:** **WORTH EVALUATING** - Major UX improvement but incomplete
- **Risk:** Large change with incomplete work
- **Action:** Review code quality, finish TODOs, test thoroughly before merging

### 🔵 Maintenance PRs (LOW PRIORITY)

**#777 - Update storybook core to ^8.6.8**
- **Recommendation:** Skip - superseded by #792

**#524 - Update Scite dependency (Draft)**
- **Recommendation:** Low priority - evaluate if Scite integration is used

**#452 - Refactor error handling (Draft)**
- **Recommendation:** Low priority - review if error handling improvements are needed

---

## Critical Issues

### 🔴 Issue #790: SmartBlock Formatter Loses UID in Shared Graphs

**Priority:** CRITICAL
**Impact:** Users lose configuration unpredictably
**Root Cause Identified:** Yes

**Problem:**
In `src/setup.ts:309-315`, the `configRoamDepot()` function:
1. Calls `extensionAPI.settings.getAll()`
2. Merges with defaults via `setupInitialSettings()`
3. **Writes ALL settings back**, including empty defaults

When Roam returns incomplete metadata (missing nested SmartBlock config), the defaults overwrite previously stored settings.

**Code Location:** `src/setup.ts:309-331`

```typescript
function configRoamDepot({ extensionAPI }: { extensionAPI: Roam.ExtensionAPI }){
	const current = extensionAPI.settings.getAll();
	const settings = setupInitialSettings(current || {});

	Object.entries(settings).forEach(([key, val]) => {
		extensionAPI.settings.set(key, val);  // <-- PROBLEM: Always writes back
	});
	// ...
}
```

**Proposed Solutions:**

**Option A (Safer):** Only write settings if they're missing
```typescript
Object.entries(settings).forEach(([key, val]) => {
	if (!current[key]) {
		extensionAPI.settings.set(key, val);
	}
});
```

**Option B (Cleaner):** Never write back, only use merged settings in-memory
```typescript
// Remove the Object.entries loop entirely
// Return merged settings for in-memory use only
```

**Recommendation:** Implement Option B - it's cleaner and prevents all write-back issues. Settings should only be written when explicitly changed by the user, not on every load.

---

### 🟡 Issue #793: Cannot Import Metadata (Recent Bug)

**Priority:** HIGH
**Reported:** Jan 3, 2026 (5 days ago)
**Impact:** Recently added items fail to import metadata

**Symptoms:**
- AxiosError when importing metadata
- Only affects recently added items
- Older items (several months) work fine
- User hypothesis: Related to recent Roam update

**Likely Causes:**
1. Zotero API response format change
2. Roam desktop app API compatibility
3. New item format from Zotero 7

**Action Items:**
- Reproduce the issue with fresh Zotero items
- Check Zotero API response format for new items
- Add better error logging to identify the exact failure point
- Review `src/api/index.tsx` and `src/clients/zotero/base.ts`

---

### 🟠 Citation Key Compatibility Issue

**Priority:** MEDIUM-HIGH
**Impact:** Better BibTeX integration may be broken with Zotero 7

**Current Implementation:** `src/clients/zotero/helpers.ts:81-84`
```typescript
if (item.data.extra.includes("Citation Key: ")) {
	key = item.data.extra.match("Citation Key: (.+)")?.[1] || key;
	has_citekey = true;
}
```

**Problem:**
- Code only checks for "Citation Key: " in the `extra` field
- Better BibTeX on Zotero 7 may store citation keys differently
- [Zotero 7 BBT has limited API support](https://forums.zotero.org/discussion/119427/betterbibtex-zotero-7-citation-key-api) as of Feb 2024

**Research Needed:**
1. How does Better BibTeX 6.x store citation keys? (Zotero 6)
2. How does Better BibTeX store citation keys in Zotero 7?
3. Are there alternative field locations? (`citationKey` field exists in types but unused)
4. Can we use the Better BibTeX JSON-RPC API?

**Action Items:**
- Test with Zotero 7 + Better BibTeX to confirm citation key location
- Update `extractCitekeys()` function to check multiple locations
- Add fallback mechanisms

---

### 🟠 Performance: Freezing with Large Databases

**Priority:** MEDIUM-HIGH
**Impact:** Extension becomes unusable for users with large libraries

**Current State:**
- Extension uses IndexedDB caching (optional: `settings.other.cacheEnabled`)
- API fetches are paginated (100 items/request)
- Axios retry mechanism with backoff
- React Query for data management

**Potential Issues:**

1. **Initial Load Performance:**
   - Large libraries may require many API calls
   - No progressive loading indicator
   - All data processed at once

2. **Memory Management:**
   - Entire library loaded into memory
   - No virtual scrolling for large lists
   - React Query cache may grow unbounded

3. **Rate Limiting:**
   - Extension handles backoff properly (`src/clients/zotero/base.ts:25-49`)
   - But doesn't show user-friendly feedback during delays

**Recommendations:**

1. **Add Performance Monitoring:**
   - Track library size vs. load time
   - Log slow operations
   - Add performance metrics

2. **Implement Progressive Loading:**
   - Show initial batch of items immediately
   - Load remainder in background
   - Add loading indicators

3. **Optimize Cache Strategy:**
   - Implement selective caching (e.g., only recent items)
   - Add cache size limits
   - Clear stale data automatically

4. **Add Virtualization:**
   - Implement virtual scrolling for large lists
   - Lazy load item details

5. **User Settings:**
   - Add "performance mode" option
   - Allow users to limit initial load size
   - Option to disable heavy features (badges, etc.)

---

## Easy Win Issues

### ✅ Issue #23: Include Year in Default Metadata Format
**Effort:** LOW | **Impact:** MEDIUM

Users want publication year in default metadata template. This is a simple template string change in `src/setup.ts:188-304` (setupInitialSettings defaults).

**Current relevant code:**
```typescript
metadata: {
	func: "",
	smartblock: {
		param: "srcUid",
		paramValue: ""
	},
	use: "default",
	...metadata
}
```

**Action:** Review default metadata formatter and add year field.

---

### ✅ Issue #550: Import Multiple Items Simultaneously
**Effort:** MEDIUM | **Impact:** HIGH

Currently metadata import is one-by-one. Adding batch import would significantly improve UX.

**Implementation:**
- Add multi-select in Explorer/Dashboard
- Batch API calls (respect rate limits)
- Show progress indicator
- Handle partial failures gracefully

---

### ✅ Issue #26: Notes Import Formatting of Bullets
**Effort:** LOW-MEDIUM | **Impact:** MEDIUM

Bullet point formatting issues when importing notes. Review `src/api/helpers.ts` (`formatNotes` function) and ensure proper HTML → Roam markdown conversion.

---

### ✅ Issue #19: Add Authors/Editors Script
**Effort:** LOW | **Impact:** LOW-MEDIUM

Users want metadata option for "authors, or editors if no authors". This is a simple conditional in the metadata formatter.

---

## Issues to Close/Defer

### ⏸️ Issue #42: Dependency Dashboard (Renovate Bot)
**Action:** Keep open - automated dependency tracking

### ⏸️ Issue #754, #752, #588: Vague Bug Reports
**Action:** Request more information or close as stale

### ⏸️ Issue #705: New Page Menu Elements
**Action:** Low priority enhancement - defer

### ⏸️ Issue #551: Dashboard Import Inconsistency
**Action:** Investigate if part of #793

### ⏸️ Issue #18: List in Zotero Plugin Page
**Action:** Marketing/distribution task - low priority

---

## Testing & Development Setup

### Do You Need a Zotero Account?

**Yes, strongly recommended** for comprehensive testing:

1. **Free Zotero Account:**
   - 300 MB free storage
   - Unlimited API access
   - Create at https://www.zotero.org/user/register

2. **Test Library Setup:**
   ```
   - Create test library with ~50 items (small)
   - Create test library with ~1000 items (medium)
   - Test with large library (5000+ items) if possible
   ```

3. **Better BibTeX Testing:**
   - Install Zotero 7 desktop client
   - Install Better BibTeX plugin
   - Generate citation keys
   - Verify "Citation Key: " in Extra field

4. **API Key Setup:**
   - Generate API key: https://www.zotero.org/settings/keys
   - Permissions needed: Read library access
   - Use in extension settings

### Recommended Test Cases

1. **Basic Functionality:**
   - Import single item metadata
   - Import notes and annotations
   - Search and filter items
   - Copy citations

2. **Performance Testing:**
   - Time to load 100 items
   - Time to load 1000 items
   - Memory usage over time
   - Cache behavior

3. **Edge Cases:**
   - Items without citation keys
   - Items with special characters
   - PDF attachments
   - Zotero 7 vs. Zotero 6 format differences

4. **Roam Integration:**
   - Shared vs. personal graphs
   - Settings persistence
   - Citekey resolution

---

## Recommended Priority Order

### Phase 1: Critical Fixes (Week 1-2)
1. ✅ Merge security PRs (#789, #788)
2. ✅ Fix Issue #790 (settings loss)
3. ✅ Setup test Zotero account and environment
4. ✅ Reproduce and fix Issue #793 (metadata import)

### Phase 2: Core Improvements (Week 3-4)
1. ✅ Update citation key handling for Zotero 7
2. ✅ Add performance monitoring/logging
3. ✅ Implement easy wins (#23, #26, #19)
4. ✅ Add batch import (#550)

### Phase 3: Performance & Features (Week 5-6)
1. ✅ Optimize large database handling
2. ✅ Add progressive loading
3. ✅ Evaluate PR #702 (Explorer refactor)
4. ✅ Add virtualization for large lists

### Phase 4: Polish (Ongoing)
1. ✅ Improve error messages
2. ✅ Add user documentation
3. ✅ Request more info on vague issues
4. ✅ Community engagement

---

## Technical Debt & Architecture

### Current Architecture Strengths
- ✅ Good separation: clients/services/components
- ✅ TypeScript for type safety
- ✅ React Query for data management
- ✅ Proper retry/backoff handling
- ✅ IndexedDB caching option
- ✅ Good test coverage (84%+)

### Areas for Improvement
- ⚠️ Settings persistence logic fragile (#790)
- ⚠️ No performance monitoring
- ⚠️ Limited error context for debugging
- ⚠️ Large bundle size (check if tree-shaking works)
- ⚠️ No progressive enhancement for large datasets

---

## Resources & References

### Zotero API Documentation
- [API v3 Basics](https://www.zotero.org/support/dev/web_api/v3/basics)
- [Rate Limiting](https://forums.zotero.org/discussion/60190/api-rate-limit)

### Better BibTeX
- [Better BibTeX for Zotero](https://retorque.re/zotero-better-bibtex/)
- [Citation Keys Documentation](https://retorque.re/zotero-better-bibtex/citing/)
- [Zotero 7 BBT API Discussion](https://forums.zotero.org/discussion/119427/betterbibtex-zotero-7-citation-key-api)

### Original Extension
- [Extension Documentation](https://alix-lahuec.gitbook.io/zotero-roam/)
- [Public Roadmap](https://alix.canny.io/zoteroroam)

---

## Conclusion

**Worth Bringing Over:**
- ✅ Security PRs (#789, #788) - immediate merge
- 🤔 Explorer refactor (#702) - evaluate after completing Phase 1-2

**Easy Wins:**
- Issue #23 (year in metadata)
- Issue #26 (bullet formatting)
- Issue #19 (authors/editors)

**Critical Focus:**
- Issue #790 (settings loss) - affects user trust
- Issue #793 (recent import failures) - actively broken
- Citation key compatibility - affects core functionality
- Performance issues - affects usability

**Testing Setup:**
Yes, you should create a Zotero test account. The free tier is sufficient for testing, and proper integration testing is essential for this extension.

**Estimated Effort:**
- Phase 1 (Critical): 20-30 hours
- Phase 2 (Core): 30-40 hours
- Phase 3 (Performance): 40-50 hours
- Phase 4 (Polish): Ongoing

This is a well-architected extension with good bones. The main issues are edge cases (#790), potential API compatibility (#793, citation keys), and performance optimization for power users. The security updates should be merged immediately, and Issue #790 should be your top priority as it affects user trust in the extension.
