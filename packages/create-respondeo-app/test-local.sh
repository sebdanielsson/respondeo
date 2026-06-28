#!/usr/bin/env bash
# Local testing script for create-respondeo-app
# This copies the template locally since we can't use giget before pushing to GitHub

set -e

if [ -z "$1" ]; then
  echo "Usage: ./test-local.sh <project-name>"
  exit 1
fi

PROJECT_NAME="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="$SCRIPT_DIR/../../examples/respondeo"
TARGET_DIR="$PWD/$PROJECT_NAME"

echo "🧪 Testing create-respondeo-app locally..."
echo "📂 Template: $TEMPLATE_DIR"
echo "📁 Target: $TARGET_DIR"

# Check if template exists
if [ ! -d "$TEMPLATE_DIR" ]; then
  echo "❌ Template directory not found: $TEMPLATE_DIR"
  exit 1
fi

# Check if target directory exists
if [ -d "$TARGET_DIR" ]; then
  echo "⚠️  Directory $PROJECT_NAME already exists"
  read -p "Overwrite? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
  fi
  rm -rf "$TARGET_DIR"
fi

# Copy template
echo "📥 Copying template..."
cp -r "$TEMPLATE_DIR" "$TARGET_DIR"

# Copy .env.example to .env.local
if [ -f "$TARGET_DIR/.env.example" ]; then
  echo "📝 Creating .env.local..."
  cp "$TARGET_DIR/.env.example" "$TARGET_DIR/.env.local"
fi

# Install dependencies
echo "📦 Installing dependencies..."
cd "$TARGET_DIR"
pnpm install

echo ""
echo "✅ Your Respondeo app is ready!"
echo ""
echo "Next steps:"
echo "  1. cd $PROJECT_NAME"
echo "  2. Edit .env.local with your configuration"
echo "  3. Run database migrations: pnpm db:migrate"
echo "  4. Start development server: pnpm dev"
