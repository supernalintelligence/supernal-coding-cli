#!/bin/bash
# Integration test for WIP registry userid feature

set -e

echo "Testing WIP Registry User Tracking..."
echo "======================================"

# Setup test directory
TEST_DIR="/tmp/wip-userid-test-$$"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Initialize git repo
git init
git config user.name "Test User"
git config user.email "test@example.com"
git config user.github "testuser"

# Create test files
echo "console.log('test1');" > test1.ts
echo "console.log('test2');" > test2.ts
echo "console.log('test3');" > test3.ts

# Test 1: Register with explicit userid
echo ""
echo "Test 1: Register with explicit userid"
sc wip register test1.ts --feature=test-feature --requirement=REQ-001 --userid=alice
if sc wip list | grep -q "@alice"; then
  echo "✅ PASS: Userid displayed in list"
else
  echo "❌ FAIL: Userid not displayed"
  exit 1
fi

# Test 2: Register with auto-detected userid
echo ""
echo "Test 2: Register with auto-detected userid"
sc wip register test2.ts --feature=test-feature --requirement=REQ-002
if sc wip list | grep -q "testuser\|Test User"; then
  echo "✅ PASS: Auto-detected userid"
else
  echo "❌ FAIL: Auto-detection failed"
  exit 1
fi

# Test 3: Filter by userid
echo ""
echo "Test 3: Filter by userid"
sc wip register test3.ts --feature=test-feature --requirement=REQ-003 --userid=bob
ALICE_FILES=$(sc wip list --userid=alice | grep -c "test1.ts" || echo "0")
if [ "$ALICE_FILES" = "1" ]; then
  echo "✅ PASS: Filter by userid works"
else
  echo "❌ FAIL: Filter failed"
  exit 1
fi

# Test 4: Stats by user
echo ""
echo "Test 4: Stats by user"
if sc wip stats | grep -q "@alice"; then
  echo "✅ PASS: Stats show users"
else
  echo "❌ FAIL: Stats missing users"
  exit 1
fi

# Test 5: Reassign file
echo ""
echo "Test 5: Reassign file"
sc wip reassign test1.ts --to=charlie
if sc wip list --userid=charlie | grep -q "test1.ts"; then
  echo "✅ PASS: Reassignment works"
else
  echo "❌ FAIL: Reassignment failed"
  exit 1
fi

# Test 6: Conflict detection
echo ""
echo "Test 6: Conflict detection"
echo "console.log('test4');" > test4.ts
sc wip register test4.ts --feature=test-feature --requirement=REQ-004 --userid=alice
if sc wip register test4.ts --feature=test-feature --requirement=REQ-004 --userid=bob 2>&1 | grep -q "already WIP-tracked by @alice"; then
  echo "✅ PASS: Conflict detection works"
else
  echo "❌ FAIL: Conflict detection failed"
  exit 1
fi

# Cleanup
echo ""
echo "Cleaning up..."
cd /
rm -rf "$TEST_DIR"

echo ""
echo "======================================"
echo "All tests passed! ✅"


