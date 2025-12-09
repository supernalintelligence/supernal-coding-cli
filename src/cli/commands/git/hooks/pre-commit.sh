#!/bin/bash
# Supernal Coding Pre-Commit Hook - Lightweight Checks
# Focuses on basic validation to keep commits easy

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "${BLUE}🚀 SUPERNAL CODING: Pre-commit validation${NC}"

# Check for skip environment variable
if [ "${SC_SKIP_PRE_COMMIT}" = "true" ]; then
    echo "${YELLOW}⚠️  Pre-commit validation skipped${NC}"
    exit 0
fi

# Get current branch
branch=$(git branch --show-current)

# Prevent direct commits to main/master
if [ "$branch" = "main" ] || [ "$branch" = "master" ]; then
    echo ""
    echo "${RED}❌ BLOCKED: Direct commits to $branch not allowed${NC}"
    echo ""
    echo "${YELLOW}🔄 Proper workflow:${NC}"
    echo "   1. Create feature branch: git checkout -b feature/your-feature"
    echo "   2. Make your changes and commit"
    echo "   3. Push and create PR: git push -u origin feature/your-feature"
    echo "   4. Merge via: sc git-smart merge --push --delete-local"
    echo ""
    echo "${YELLOW}⚠️  Emergency bypass (use with extreme caution):${NC}"
    echo "   git commit --no-verify"
    echo "   OR"
    echo "   SC_SKIP_PRE_COMMIT=true git commit"
    echo ""
    exit 1
fi

# Basic file format validation (quick checks only)
echo "${BLUE}📝 Checking staged files...${NC}"

# Get list of staged files
STAGED_FILES=$(git diff --cached --name-only)

if [ -n "$STAGED_FILES" ]; then
    # Check for large files (>10MB)
    for file in $STAGED_FILES; do
        if [ -f "$file" ]; then
            size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo 0)
            if [ "$size" -gt 10485760 ]; then  # 10MB
                echo "${YELLOW}⚠️  Large file detected: $file ($(($size / 1048576))MB)${NC}"
                echo "   Consider using Git LFS for large files"
            fi
        fi
    done
    
    # Check for common sensitive patterns
    if echo "$STAGED_FILES" | grep -E "\.(key|pem|p12|pfx)$" > /dev/null; then
        echo "${RED}❌ Potential sensitive files detected${NC}"
        echo "   Files with sensitive extensions found in staging area"
        echo "   Review carefully before committing"
        exit 1
    fi
    
    echo "${GREEN}✅ Basic file validation passed${NC}"
else
    echo "${YELLOW}⚠️  No staged files found${NC}"
fi

# Quick syntax check for common file types (non-blocking)
echo "${BLUE}🔍 Quick syntax validation...${NC}"
syntax_issues=0

for file in $STAGED_FILES; do
    if [ -f "$file" ]; then
        case "$file" in
            *.json)
                if ! python -m json.tool "$file" > /dev/null 2>&1 && ! node -e "JSON.parse(require('fs').readFileSync('$file', 'utf8'))" > /dev/null 2>&1; then
                    echo "${YELLOW}⚠️  JSON syntax issue in: $file${NC}"
                    syntax_issues=$((syntax_issues + 1))
                fi
                ;;
            *.js|*.ts|*.jsx|*.tsx)
                if command -v node > /dev/null 2>&1; then
                    if ! node -c "$file" > /dev/null 2>&1; then
                        echo "${YELLOW}⚠️  JavaScript/TypeScript syntax issue in: $file${NC}"
                        syntax_issues=$((syntax_issues + 1))
                    fi
                fi
                ;;
        esac
    fi
done

if [ $syntax_issues -eq 0 ]; then
    echo "${GREEN}✅ Syntax validation passed${NC}"
else
    echo "${YELLOW}⚠️  $syntax_issues syntax issues found (warnings only)${NC}"
    echo "   Run your linter/formatter before pushing"
fi

# File organization validation (quick check)
echo "${BLUE}📁 Checking file organization...${NC}"
organization_issues=0

# Check if any staged files are in root that shouldn't be
for file in $STAGED_FILES; do
    if [ -f "$file" ]; then
        # Check if it's a root-level file that should be organized
        case "$file" in
            *.md)
                # Skip allowed root files
                case "$(basename "$file")" in
                    README.md|CHANGELOG.md|CONTRIBUTING.md|SECURITY.md|DEPLOYMENT.md) ;;
                    *)
                        if [[ "$file" != docs/* ]] && [[ "$file" != documentation/* ]] && [[ "$file" != supernal-coding/* ]] && [[ "$file" != archive/* ]]; then
                            echo "${YELLOW}⚠️  Documentation file in root: $file${NC}"
                            echo "   Consider organizing with: sc organize interactive"
                            organization_issues=$((organization_issues + 1))
                        fi
                        ;;
                esac
                ;;
            *.js)
                # Skip allowed root JS files
                case "$(basename "$file")" in
                    .eslintrc.js|*.config.js) ;;
                    *)
                        if [[ "$file" != scripts/* ]] && [[ "$file" != cli/* ]] && [[ "$file" != apps/* ]] && [[ "$file" != packages/* ]]; then
                            echo "${YELLOW}⚠️  JavaScript file in root: $file${NC}"
                            echo "   Consider moving to scripts/ or appropriate module"
                            organization_issues=$((organization_issues + 1))
                        fi
                        ;;
                esac
                ;;
        esac
    fi
done

if [ $organization_issues -eq 0 ]; then
    echo "${GREEN}✅ File organization looks good${NC}"
else
    echo "${YELLOW}⚠️  $organization_issues organization suggestions (warnings only)${NC}"
    echo "   Run: sc organize check for full analysis"
fi

# Date validation for staged files
echo "${BLUE}📅 Validating document dates...${NC}"

# Check for skip environment variable
if [ "${SC_SKIP_DATE_VALIDATION}" = "true" ]; then
    echo "${YELLOW}⚠️  Date validation skipped${NC}"
else
    # Get staged markdown and JSON files that might contain dates
    STAGED_DATE_FILES=$(echo "$STAGED_FILES" | grep -E "\.(md|json)$" || true)
    
    if [ -n "$STAGED_DATE_FILES" ]; then
        # Check if sc command is available
        if command -v sc > /dev/null 2>&1; then
            # Run date validation on staged files only
            date_validation_failed=false
            for file in $STAGED_DATE_FILES; do
                if [ -f "$file" ]; then
                    if ! sc date-validate --file="$file" > /dev/null 2>&1; then
                        date_validation_failed=true
                        echo "${YELLOW}⚠️  Date issues in: $file${NC}"
                    fi
                fi
            done
            
            if [ "$date_validation_failed" = true ]; then
                echo "${YELLOW}⚠️  Hardcoded dates detected that don't match file dates${NC}"
                echo "   Run: ${BLUE}sc date-validate --fix${NC} to fix automatically"
                echo "   Or skip with: ${BLUE}SC_SKIP_DATE_VALIDATION=true git commit${NC}"
                echo ""
                echo "${YELLOW}💡 This prevents hallucinated timestamps in documentation${NC}"
                exit 1
            else
                echo "${GREEN}✅ Document dates are accurate${NC}"
            fi
        else
            echo "${YELLOW}⚠️  sc command not found, skipping date validation${NC}"
            echo "   Install with: npm install -g supernal-code"
        fi
    else
        echo "${GREEN}✅ No date-containing files to validate${NC}"
    fi
fi

# Feature validation
if [ -z "$SC_SKIP_FEATURE_VALIDATION" ]; then
    echo "${BLUE}🎯 Validating feature structure...${NC}"
    
    # Check for feature README files in staging
    FEATURE_README_FILES=$(echo "$STAGED_FILES" | grep -E 'docs/features/[0-9]+_[^/]+/[^/]+/README\.md$' || true)
    
    if [ -n "$FEATURE_README_FILES" ]; then
        if command -v sc > /dev/null 2>&1; then
            feature_validation_failed=false
            
            for FILE in $FEATURE_README_FILES; do
                # Extract feature-id from path: docs/features/{domain}/feature-id/README.md
                FEATURE_ID=$(echo "$FILE" | sed -E 's|docs/features/[^/]+/([^/]+)/.*|\1|')
                
                # Extract domain from path
                DOMAIN=$(echo "$FILE" | sed -E 's|docs/features/([^/]+)/.*|\1|')
                
                # Run feature validation (quiet mode for hook)
                if ! sc feature validate "$FEATURE_ID" --quiet > /dev/null 2>&1; then
                    feature_validation_failed=true
                    echo "${RED}❌ Feature validation failed: $FEATURE_ID${NC}"
                    
                    # Show specific errors
                    sc feature validate "$FEATURE_ID" --quiet 2>&1 | grep -E "^   •" || true
                fi
            done
            
            if [ "$feature_validation_failed" = true ]; then
                echo ""
                echo "${RED}❌ FEATURE VALIDATION FAILED - Commit blocked!${NC}"
                echo ""
                echo "${YELLOW}🛠️  To fix feature validation errors:${NC}"
                echo "   1. Run: ${BLUE}sc feature validate [feature-id]${NC} to see all errors"
                echo "   2. Run: ${BLUE}sc feature validate [feature-id] --fix${NC} to auto-fix"
                echo "   3. Stage changes and retry commit"
                echo ""
                echo "${YELLOW}Common issues:${NC}"
                echo "   • Phase in frontmatter doesn't match required directories"
                echo "   • Branch in frontmatter doesn't match current git branch"
                echo "   • Feature ID doesn't match folder name"
                echo "   • Missing required directories for phase (e.g., design/, planning/, requirements/)"
                echo ""
                echo "${YELLOW}⚠️  To bypass (not recommended):${NC}"
                echo "   SC_SKIP_FEATURE_VALIDATION=true git commit ..."
                echo ""
                echo "${YELLOW}💡 This ensures feature structure consistency${NC}"
                exit 1
            else
                echo "${GREEN}✅ Feature validation passed${NC}"
            fi
        else
            echo "${YELLOW}⚠️  sc command not found, skipping feature validation${NC}"
            echo "   Install with: npm install -g supernal-code"
        fi
    else
        echo "${GREEN}✅ No feature files to validate${NC}"
    fi
fi

# Documentation organization validation
if [ -z "$SC_SKIP_DOC_VALIDATION" ]; then
    echo "${BLUE}📁 Validating documentation organization...${NC}"
    
    # Check if we have documentation files in staging
    DOC_FILES=$(echo "$STAGED_FILES" | grep -E '\.(md|mdx|rst)$' || true)
    
    if [ -n "$DOC_FILES" ]; then
        if command -v sc > /dev/null 2>&1; then
            # Run template validation (blocking)
            if ! sc docs validate --template > "$LOG_FILE.docs" 2>&1; then
                echo ""
                echo "${RED}❌ DOCUMENTATION ORGANIZATION FAILED - Commit blocked!${NC}"
                echo ""
                echo "${YELLOW}📋 Documentation files in non-standard locations:${NC}"
                tail -15 "$LOG_FILE.docs" | sed 's/^/   /'
                echo ""
                echo "${YELLOW}🛠️  To fix documentation organization:${NC}"
                echo "   1. Move files to docs/ or other whitelisted directories"
                echo "   2. Add frontmatter: sc-allow-non-appropriate-position: true"
                echo "   3. Run: sc docs validate --template --fix"
                echo "   4. Stage changes and retry commit"
                echo ""
                echo "${YELLOW}⚠️  To bypass (not recommended):${NC}"
                echo "   SC_SKIP_DOC_VALIDATION=true git commit ..."
                echo "${YELLOW}💡 This ensures proper documentation organization${NC}"
                exit 1
            else
                echo "${GREEN}✅ Documentation template validation passed${NC}"
                rm "$LOG_FILE.docs" 2>/dev/null || true
            fi

            # Run cleanup dry-run (informational only, non-blocking)
            echo "${BLUE}🧹 Checking documentation structure (dry-run)...${NC}"
            if ! sc docs cleanup --dry-run > "$LOG_FILE.docs.cleanup" 2>&1; then
                # Show issues but don't block
                echo "${YELLOW}⚠️  Documentation structure issues detected (informational):${NC}"
                tail -10 "$LOG_FILE.docs.cleanup" | sed 's/^/   /'
                echo ""
                echo "${YELLOW}💡 To fix these issues:${NC}"
                echo "   sc docs cleanup --auto-fix"
                echo ""
                rm "$LOG_FILE.docs.cleanup" 2>/dev/null || true
            else
                echo "${GREEN}✅ Documentation structure looks good${NC}"
                rm "$LOG_FILE.docs.cleanup" 2>/dev/null || true
            fi
        else
            echo "${YELLOW}⚠️  sc command not found, skipping documentation validation${NC}"
            echo "   Install with: npm install -g supernal-code"
        fi
    else
        echo "${GREEN}✅ No documentation files to validate${NC}"
    fi
fi

echo "${GREEN}✅ Pre-commit validation complete${NC}"
echo "${BLUE}💡 Remember: Full validation runs on pre-push${NC}"
echo ""

