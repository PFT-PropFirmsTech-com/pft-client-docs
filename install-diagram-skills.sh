#!/bin/bash

# Install Flowchart and Diagram Skills for Claude Code
# This script installs skills globally to ~/.claude/ for all AI agents
# Skills are installed with symlinks to enable automatic updates

set -e  # Exit on error

echo "🎨 Installing Flowchart and Diagram Skills for Claude Code..."
echo "=================================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to install a skill
install_skill() {
    local repo=$1
    local skill=$2
    local full_path="${repo}/${skill}"

    echo -e "${BLUE}Installing:${NC} ${full_path}"

    if claude-code skill install "${full_path}" --global --symlink 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Installed: ${skill}"
    elif claude-code skill install "${full_path}" --global 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Installed: ${skill} (without symlink support)"
    elif claude-code skill install "${full_path}" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Installed: ${skill} (global by default)"
    else
        echo "⚠️  Failed to install: ${skill}"
    fi
    echo ""
}

echo "📊 Installing Flowchart Skills (9 total)..."
echo "-------------------------------------------"

# Flowchart Skills (sorted by popularity)
install_skill "teachingai/full-stack-skills" "drawio-flowchart"
install_skill "mhattingpete/claude-skills-marketplace" "flowchart-creator"
install_skill "dkyazzentwatwa/chatgpt-skills" "flowchart-generator"
install_skill "yzlnew/infra-skills" "tikz-flowchart"
install_skill "jeremylongshore/claude-code-plugins-plus-skills" "mermaid-flowchart-generator"
install_skill "partme-ai/full-stack-skills" "drawio-flowchart"
install_skill "prof-ramos/.codex" "flowchart-creator"
install_skill "teachingai/agent-skills" "drawio-flowchart"
install_skill "josephkkmok/markdown-flowchart-creator" "markdown-flowchart-creator"

echo ""
echo "🎨 Installing Diagram Skills (5 total)..."
echo "-------------------------------------------"

# Diagram Skills (sorted by popularity)
install_skill "softaworks/agent-toolkit" "mermaid-diagrams"
install_skill "axtonliu/axton-obsidian-visual-skills" "excalidraw-diagram"
install_skill "eraserlabs/eraser-io" "eraser-diagrams"
install_skill "davila7/claude-code-templates" "mermaid-diagram-specialist"
install_skill "davila7/claude-code-templates" "mermaid-diagrams"

echo ""
echo "=================================================="
echo "✅ Installation Complete!"
echo ""
echo "📍 Skills installed to: ~/.claude/plugins/marketplaces/"
echo "🔗 Skills are available globally for all AI agents"
echo ""
echo "To verify installation, run:"
echo "  claude-code skill list"
echo ""
echo "Note: Some skills have duplicate names from different repos."
echo "      You may want to uninstall duplicates if conflicts occur."
echo ""
