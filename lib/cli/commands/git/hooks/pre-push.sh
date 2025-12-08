#!/bin/bash
# Supernal Coding Pre-Push Safety Hook
# Part of REQ-011: Git System Evaluation and Enhancement
# Implements REQ-050: Pre-Push Testing and Validation System

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "🚀 SUPERNAL CODING: Pre-push validation starting..."
echo ""

# Show bypass options upfront
echo "${YELLOW}💡 To bypass validation:${NC}"
echo "   git push --no-verify              # Skip all checks"
echo "   SC_SKIP_PRE_PUSH=true git push    # Skip via environment variable"
echo ""

# Check if we're in the project root
if [ ! -f "package.json" ]; then
    echo "${RED}❌ Error: Not in project root directory${NC}"
    exit 1
fi

# Get current branch
branch=$(git branch --show-current)
echo "${BLUE}📋 Current branch: $branch${NC}"

# Check for skip environment variable
if [ "${SC_SKIP_PRE_PUSH}" = "true" ]; then
    echo "${YELLOW}⚠️  Pre-push validation skipped (SC_SKIP_PRE_PUSH=true)${NC}"
    echo ""
    exit 0
fi

# Run tests before push
echo "${BLUE}🧪 Running test suite...${NC}"

# Create log file for test output
mkdir -p .git/logs
LOG_FILE=".git/logs/pre-push-tests-$(date +%Y%m%d-%H%M%S).log"

if npm test > "$LOG_FILE" 2>&1; then
    echo "${GREEN}✅ All tests passed${NC}"
    # Clean up successful test log
    rm "$LOG_FILE" 2>/dev/null || true
else
    echo ""
    echo "${RED}❌ TESTS FAILED - Push blocked!${NC}"
    echo ""
    echo "${YELLOW}📋 Test failures found:${NC}"
    echo "   Log file: $LOG_FILE"
    echo "   Last 10 lines:"
    tail -10 "$LOG_FILE" | sed 's/^/     /'
    echo ""
    echo "${YELLOW}🛠️  To fix:${NC}"
    echo "   1. Fix the failing tests"
    echo "   2. Commit your fixes"  
    echo "   3. Try pushing again"
    echo ""
    echo "${YELLOW}🔧 To debug:${NC}"
    echo "   cat $LOG_FILE                    # View full test log"
    echo "   npm test                         # Run tests locally"
    echo "   npm test -- --bail               # Stop on first failure"
    echo ""
    echo "${YELLOW}⚠️  Emergency bypass (use with caution):${NC}"
    echo "   git push --no-verify"
    echo "   OR"
    echo "   SC_SKIP_PRE_PUSH=true git push"
    echo ""
    
    # Clean up old log files (keep last 5)
    find .git/logs -name "pre-push-tests-*.log" -type f | sort -r | tail -n +6 | xargs rm -f 2>/dev/null || true
    
    exit 1
fi

# Security audit check (matches CI requirements)
echo "${BLUE}🔒 Running security audit...${NC}"
if npm audit --audit-level=moderate > "$LOG_FILE.audit" 2>&1; then
    echo "${GREEN}✅ Security audit passed${NC}"
    rm "$LOG_FILE.audit" 2>/dev/null || true
else
    echo ""
    echo "${RED}❌ SECURITY VULNERABILITIES DETECTED - Push blocked!${NC}"
    echo ""
    echo "${YELLOW}📋 Security audit failures found:${NC}"
    echo "   Log file: $LOG_FILE.audit"
    echo "   Last 15 lines:"
    tail -15 "$LOG_FILE.audit" | sed 's/^/     /'
    echo ""
    echo "${YELLOW}🛠️  To fix:${NC}"
    echo "   1. Run: npm audit fix"
    echo "   2. For breaking changes: npm audit fix --force"
    echo "   3. Update vulnerable packages manually if needed"
    echo "   4. Commit your fixes"
    echo "   5. Try pushing again"
    echo ""
    echo "${YELLOW}🔧 To debug:${NC}"
    echo "   cat $LOG_FILE.audit               # View full audit log"
    echo "   npm audit                         # Run audit locally"
    echo "   npm audit --json                  # Get detailed JSON report"
    echo ""
    echo "${YELLOW}⚠️  Emergency bypass (use with caution):${NC}"
    echo "   git push --no-verify"
    echo "   OR"
    echo "   SC_SKIP_PRE_PUSH=true git push"
    echo ""
    exit 1
fi

# Requirement validation check
echo "${BLUE}📋 Validating requirements...${NC}"
if command -v sc > /dev/null 2>&1; then
    if sc req validate --all > "$LOG_FILE.req" 2>&1; then
        echo "${GREEN}✅ All requirements valid${NC}"
        rm "$LOG_FILE.req" 2>/dev/null || true
    else
        echo ""
        echo "${RED}❌ REQUIREMENT VALIDATION FAILED - Push blocked!${NC}"
        echo ""
        echo "${YELLOW}📋 Requirement validation failures found:${NC}"
        echo "   Log file: $LOG_FILE.req"
        echo "   Last 10 lines:"
        tail -10 "$LOG_FILE.req" | sed 's/^/     /'
        echo ""
        echo "${YELLOW}🛠️  To fix:${NC}"
        echo "   1. Fix requirement validation issues"
        echo "   2. Run: sc req validate --all"
        echo "   3. Commit your fixes"
        echo "   4. Try pushing again"
        echo ""
        echo "${YELLOW}🔧 To debug:${NC}"
        echo "   cat $LOG_FILE.req                # View full validation log"
        echo "   sc req validate --all            # Run validation locally"
        echo "   sc req show <req-id>             # Check specific requirement"
        echo ""
        echo "${YELLOW}⚠️  Emergency bypass (use with caution):${NC}"
        echo "   git push --no-verify"
        echo "   OR"
        echo "   SC_SKIP_PRE_PUSH=true git push"
        echo ""
        exit 1
    fi

    # Requirement duplicate check
    echo "${BLUE}🔍 Checking for duplicate requirements...${NC}"
    if sc req check-duplicates > "$LOG_FILE.req-dup" 2>&1; then
        echo "${GREEN}✅ No duplicate requirements found${NC}"
        rm "$LOG_FILE.req-dup" 2>/dev/null || true
    else
        echo ""
        echo "${RED}❌ DUPLICATE REQUIREMENTS FOUND - Push blocked!${NC}"
        echo ""
        echo "${YELLOW}🚨 Duplicate requirement numbers detected:${NC}"
        echo "   Log file: $LOG_FILE.req-dup"
        echo "   Details:"
        cat "$LOG_FILE.req-dup" | sed 's/^/     /'
        echo ""
        echo "${YELLOW}🛠️  To fix:${NC}"
        echo "   1. Remove duplicate requirement files"
        echo "   2. Keep canonical versions in supernal-coding/requirements/"
        echo "   3. Run: sc req check-duplicates"
        echo "   4. Commit your fixes"
        echo "   5. Try pushing again"
        echo ""
        echo "${YELLOW}🔧 To debug:${NC}"
        echo "   sc req check-duplicates          # Run duplicate check locally"
        echo ""
        exit 1
    fi
else
    echo "${YELLOW}⚠️  Supernal Coding CLI not available, skipping requirement validation${NC}"
fi

# Date validation check
echo "${BLUE}📅 Validating document dates...${NC}"
if command -v sc > /dev/null 2>&1; then
    if sc date-validate --max-files=50 > "$LOG_FILE.dates" 2>&1; then
        echo "${GREEN}✅ All document dates valid${NC}"
        rm "$LOG_FILE.dates" 2>/dev/null || true
    else
        echo ""
        echo "${RED}❌ DATE VALIDATION FAILED - Push blocked!${NC}"
        echo ""
        echo "${YELLOW}📋 Date validation failures found:${NC}"
        echo "   Log file: $LOG_FILE.dates"
        echo "   Last 10 lines:"
        tail -10 "$LOG_FILE.dates" | sed 's/^/     /'
        echo ""
        echo "${YELLOW}🛠️  To fix:${NC}"
        echo "   1. Fix hallucinated dates in documents"
        echo "   2. Run: sc date-validate --fix"
        echo "   3. Commit your fixes"
        echo "   4. Try pushing again"
        echo ""
        echo "${YELLOW}🔧 To debug:${NC}"
        echo "   cat $LOG_FILE.dates              # View full validation log"
        echo "   sc date-validate --dry-run --fix # Preview fixes"
        echo "   sc date-validate --max-files=10  # Quick test"
        echo ""
        echo "${YELLOW}⚠️  Emergency bypass (use with caution):${NC}"
        echo "   git push --no-verify"
        echo "   OR"
        echo "   SC_SKIP_PRE_PUSH=true git push"
        echo ""
        exit 1
    fi
else
    echo "${YELLOW}⚠️  Supernal Coding CLI not available, skipping date validation${NC}"
fi

# Rule compliance check
echo "${BLUE}📏 Checking rule compliance...${NC}"
if command -v sc > /dev/null 2>&1; then
    if sc rules validate > "$LOG_FILE.rules" 2>&1; then
        echo "${GREEN}✅ All rules compliant${NC}"
        rm "$LOG_FILE.rules" 2>/dev/null || true
    else
        echo ""
        echo "${RED}❌ RULE COMPLIANCE FAILED - Push blocked!${NC}"
        echo ""
        echo "${YELLOW}📋 Rule compliance failures found:${NC}"
        echo "   Log file: $LOG_FILE.rules"
        echo "   Last 10 lines:"
        tail -10 "$LOG_FILE.rules" | sed 's/^/     /'
        echo ""
        echo "${YELLOW}🛠️  To fix:${NC}"
        echo "   1. Fix rule compliance issues"
        echo "   2. Run: sc rules validate"
        echo "   3. Commit your fixes"
        echo "   4. Try pushing again"
        echo ""
        echo "${YELLOW}🔧 To debug:${NC}"
        echo "   cat $LOG_FILE.rules              # View full rule validation log"
        echo "   sc rules validate                # Run validation locally"
        echo "   sc rules status                  # Check rule status"
        echo ""
        echo "${YELLOW}⚠️  Emergency bypass (use with caution):${NC}"
        echo "   git push --no-verify"
        echo "   OR"
        echo "   SC_SKIP_PRE_PUSH=true git push"
        echo ""
        exit 1
    fi
else
    echo "${YELLOW}⚠️  Supernal Coding CLI not available, skipping rule validation${NC}"
fi

# Type duplication check
if command -v sc > /dev/null 2>&1; then
    echo "${BLUE}🔍 Checking for type duplications...${NC}"
    if sc type-check --pre-commit > "$LOG_FILE.types" 2>&1; then
        echo "${GREEN}✅ No type duplications found${NC}"
        rm "$LOG_FILE.types" 2>/dev/null || true
    else
        # Check if blocking is enabled in config
        BLOCK_ON_DUPLICATIONS=$(grep -q "block_commits_on_duplications = true" supernal.yaml 2>/dev/null && echo "true" || echo "false")
        
        if [ "$BLOCK_ON_DUPLICATIONS" = "true" ]; then
            echo ""
            echo "${RED}❌ TYPE DUPLICATIONS DETECTED - Push blocked!${NC}"
            echo ""
            echo "${YELLOW}📋 Type duplication failures found:${NC}"
            echo "   Log file: $LOG_FILE.types"
            echo "   Last 10 lines:"
            tail -10 "$LOG_FILE.types" | sed 's/^/     /'
            echo ""
            echo "${YELLOW}🛠️  To fix:${NC}"
            echo "   1. Remove duplicate type definitions"
            echo "   2. Consolidate types in shared modules"
            echo "   3. Commit your fixes"
            echo "   4. Try pushing again"
            echo ""
            echo "${YELLOW}🔧 To debug:${NC}"
            echo "   cat $LOG_FILE.types              # View full duplication report"
            echo "   sc type-check                    # Run check locally"
            echo ""
            echo "${YELLOW}⚠️  Emergency bypass (use with caution):${NC}"
            echo "   git push --no-verify"
            echo "   OR"
            echo "   SC_SKIP_PRE_PUSH=true git push"
            echo ""
            exit 1
        else
            echo "${YELLOW}⚠️  Type duplications detected (warning only - not blocking)${NC}"
            echo "   Run: sc type-check"
            rm "$LOG_FILE.types" 2>/dev/null || true
        fi
    fi
fi

# Optional: Check build if build script exists
if npm run --silent build > /dev/null 2>&1; then
    echo "${BLUE}🔨 Running build check...${NC}"
    if npm run build > "$LOG_FILE.build" 2>&1; then
        echo "${GREEN}✅ Build successful${NC}"
        rm "$LOG_FILE.build" 2>/dev/null || true
    else
        echo ""
        echo "${RED}❌ BUILD FAILED - Push blocked!${NC}"
        echo ""
        echo "${YELLOW}📋 Build failures found:${NC}"
        echo "   Log file: $LOG_FILE.build"
        echo "   Last 10 lines:"
        tail -10 "$LOG_FILE.build" | sed 's/^/     /'
        echo ""
        echo "${YELLOW}🛠️  To fix:${NC}"
        echo "   1. Fix the build issues"
        echo "   2. Commit your fixes"
        echo "   3. Try pushing again"
        echo ""
        echo "${YELLOW}🔧 To debug:${NC}"
        echo "   cat $LOG_FILE.build              # View full build log"
        echo "   npm run build                    # Run build locally"
        echo ""
        echo "${YELLOW}⚠️  Emergency bypass (use with caution):${NC}"
        echo "   git push --no-verify"
        echo "   OR"
        echo "   SC_SKIP_PRE_PUSH=true git push"
        echo ""
        exit 1
    fi
fi

# Documentation organization validation
if [ -z "$SC_SKIP_DOC_VALIDATION" ]; then
    echo "${BLUE}📁 Validating documentation organization...${NC}"
    if command -v sc > /dev/null 2>&1; then
        if sc docs validate --template > "$LOG_FILE.docs" 2>&1; then
            echo "${GREEN}✅ Documentation organization valid${NC}"
            rm "$LOG_FILE.docs" 2>/dev/null || true
        else
            echo ""
            echo "${RED}❌ DOCUMENTATION VALIDATION FAILED - Push blocked!${NC}"
            echo ""
            echo "${YELLOW}📋 Documentation organization issues found:${NC}"
            echo "   Log file: $LOG_FILE.docs"
            echo "   Last 15 lines:"
            tail -15 "$LOG_FILE.docs" | sed 's/^/     /'
            echo ""
            echo "${YELLOW}🛠️  To fix:${NC}"
            echo "   1. Move files to appropriate directories (docs/, etc.)"
            echo "   2. Add frontmatter markers for exceptions"
            echo "   3. Run: sc docs validate --template --fix"
            echo "   4. Stage changes: git add <fixed-files>"
            echo "   5. Retry push"
            echo ""
            echo "${YELLOW}🔧 To debug:${NC}"
            echo "   cat $LOG_FILE.docs                       # View full validation report"
            echo "   sc docs validate --template              # Run validation locally"
            echo "   sc docs validate --template --fix        # Interactive fixes"
            echo ""
            echo "${YELLOW}⚠️  Emergency bypass (use with caution):${NC}"
            echo "   git push --no-verify"
            echo "   OR"
            echo "   SC_SKIP_DOC_VALIDATION=true git push"
            echo ""
            exit 1
        fi
    else
        echo "${YELLOW}⚠️  sc command not found - skipping documentation validation${NC}"
    fi
fi

echo ""
echo "${GREEN}✅ Pre-push validation complete - safe to push!${NC}"
echo ""
