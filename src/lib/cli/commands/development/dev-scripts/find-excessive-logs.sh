#!/bin/bash

# Script to find files with excessive console logs relative to their size
# Usage: ./scripts/find-excessive-logs.sh [max_ratio] [output_file]

MAX_RATIO=${1:-0.05}  # Default max ratio: 5% of lines can contain console logs
OUTPUT_FILE=${2:-"logs/excessive-console-logs.txt"}

echo "Finding files with console.* ratio higher than $MAX_RATIO..."
echo "Results will be saved to: $OUTPUT_FILE"

# Create logs directory if it doesn't exist
mkdir -p "$(dirname "$OUTPUT_FILE")" 2>/dev/null

# Clear the output file
> "$OUTPUT_FILE"

echo "=== EXCESSIVE CONSOLE LOGS REPORT ===" >> "$OUTPUT_FILE"
echo "Generated: $(date)" >> "$OUTPUT_FILE"
echo "Max console logs ratio: $MAX_RATIO (${MAX_RATIO}%)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Temporary file for processing
TEMP_FILE=$(mktemp)

# Find all TypeScript/JavaScript files and analyze them
find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | \
  grep -v node_modules | \
  grep -v .git | \
  grep -v dist | \
  grep -v build | \
  grep -v .next | \
  grep -v .turbo | \
  grep -v coverage | \
  grep -v logs | \
  grep -v .build_output | \
  grep -v archive | \
  grep -v temp | \
  grep -v vendor | \
  grep -v Pods | \
  while read -r file; do
    if [[ -f "$file" ]]; then
      # Count total lines
      total_lines=$(wc -l < "$file" 2>/dev/null || echo "0")
      
      # Count console.* lines
      console_lines=$(grep -c "console\." "$file" 2>/dev/null || echo "0")
      
      # Skip files with no lines or no console logs
      if [[ $total_lines -gt 0 && $console_lines -gt 0 ]]; then
        # Calculate ratio using awk for floating point arithmetic
        ratio=$(awk "BEGIN {printf \"%.4f\", $console_lines / $total_lines}")
        
        # Check if ratio exceeds threshold
        if (( $(awk "BEGIN {print ($ratio > $MAX_RATIO)}") )); then
          echo "$file:$total_lines:$console_lines:$ratio" >> "$TEMP_FILE"
        fi
      fi
    fi
  done 2>/dev/null

# Sort by ratio (highest first)
sort -t: -k4 -nr "$TEMP_FILE" > "${TEMP_FILE}.sorted" 2>/dev/null

echo "=== FILES WITH EXCESSIVE CONSOLE LOG RATIOS ===" >> "$OUTPUT_FILE"
echo "Format: file:total_lines:console_lines:ratio" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Add results to output file
cat "${TEMP_FILE}.sorted" >> "$OUTPUT_FILE" 2>/dev/null

# Count total findings
TOTAL_COUNT=$(wc -l < "${TEMP_FILE}.sorted" 2>/dev/null || echo "0")

echo "" >> "$OUTPUT_FILE"
echo "=== SUMMARY ===" >> "$OUTPUT_FILE"
echo "Total files with excessive console logs: $TOTAL_COUNT" >> "$OUTPUT_FILE"

# Find worst offenders
echo "" >> "$OUTPUT_FILE"
echo "=== TOP 10 WORST OFFENDERS ===" >> "$OUTPUT_FILE"
head -10 "${TEMP_FILE}.sorted" | while IFS=: read -r file total console ratio; do
  percentage=$(awk "BEGIN {printf \"%.1f\", $ratio * 100}")
  echo "$file - $console console logs in $total lines ($percentage%)" >> "$OUTPUT_FILE"
done 2>/dev/null

# Clean up temp files
rm -f "$TEMP_FILE" "${TEMP_FILE}.sorted" 2>/dev/null

# Display results
FINAL_COUNT=$(grep -c "^\./" "$OUTPUT_FILE" 2>/dev/null || echo "0")
echo ""
echo "Found $FINAL_COUNT files with excessive console logs"
echo "Report saved to: $OUTPUT_FILE"

# Show top 5 quietly
echo ""
echo "Top 5 offending files:"
grep "^\./" "$OUTPUT_FILE" 2>/dev/null | head -5 | while IFS=: read -r file total console ratio; do
  percentage=$(awk "BEGIN {printf \"%.1f\", $ratio * 100}" 2>/dev/null)
  echo "  $(basename "$file") - $percentage% console logs ($console/$total lines)"
done 2>/dev/null

echo ""
echo "Use 'cat $OUTPUT_FILE' to view the full report" 