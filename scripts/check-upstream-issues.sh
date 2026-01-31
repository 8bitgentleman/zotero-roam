#!/bin/bash
# Check upstream repository for new issues
# This helps track what's happening in the original repo that might affect this fork

set -e

UPSTREAM_REPO="alixlahuec/zotero-roam"
FORK_REPO="8bitgentleman/zotero-roam"

echo "═══════════════════════════════════════════════════════════"
echo "  Checking Upstream Issues for zotero-roam Fork"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Upstream: https://github.com/$UPSTREAM_REPO"
echo "Fork:     https://github.com/$FORK_REPO"
echo ""

# Get date 30 days ago for filtering
SINCE_DATE=$(date -v-30d +%Y-%m-%d 2>/dev/null || date -d '30 days ago' +%Y-%m-%d 2>/dev/null)

echo "Checking for issues created/updated in the last 30 days..."
echo ""

# Fetch recent upstream issues
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 RECENT UPSTREAM ISSUES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
gh issue list --repo "$UPSTREAM_REPO" \
  --limit 20 \
  --json number,title,createdAt,updatedAt,state,labels \
  --jq ".[] | select(.updatedAt >= \"$SINCE_DATE\") | \"#\(.number) [\(.state | ascii_upcase)] \(.title)\n  Created: \(.createdAt | fromdateiso8601 | strftime(\"%Y-%m-%d\"))\n  Updated: \(.updatedAt | fromdateiso8601 | strftime(\"%Y-%m-%d\"))\n  Labels: \([.labels[].name] | join(\", \"))\n  URL: https://github.com/$UPSTREAM_REPO/issues/\(.number)\n\"" || {
  echo "No recent issues found or error fetching issues"
}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TOTAL_OPEN=$(gh issue list --repo "$UPSTREAM_REPO" --state open --json number --jq 'length')
TOTAL_CLOSED=$(gh issue list --repo "$UPSTREAM_REPO" --state closed --limit 100 --json number --jq 'length')

echo "Total Open Issues: $TOTAL_OPEN"
echo "Recently Closed: $TOTAL_CLOSED (last 100)"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 NEXT STEPS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Review the issues above for relevance to your fork"
echo "2. For relevant issues, add them to your project roadmap:"
echo "   gh project item-add 1 --owner 8bitgentleman --url https://github.com/$UPSTREAM_REPO/issues/NUMBER"
echo ""
echo "3. View your roadmap: https://github.com/users/8bitgentleman/projects/1"
echo ""
echo "4. Update your notes in FORK_REVIEW.md or IMPLEMENTATION_PLAN.md if needed"
echo ""
