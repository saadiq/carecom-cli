#!/bin/bash
set -euo pipefail

REPO="saadiq/carecom-cli"
BINARY="carecom-darwin-arm64"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"

# Validate platform
if [ "$(uname -s)" != "Darwin" ]; then
  echo "Error: This tool only supports macOS." >&2
  exit 1
fi
if [ "$(uname -m)" != "arm64" ]; then
  echo "Error: This tool only supports Apple Silicon (arm64)." >&2
  exit 1
fi

# Fetch latest release tag
echo "Fetching latest release..."
TAG=$(curl -sL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/')
if [ -z "$TAG" ]; then
  echo "Error: Could not determine latest release." >&2
  exit 1
fi
echo "Latest release: ${TAG}"

# Download binary
URL="https://github.com/${REPO}/releases/download/${TAG}/${BINARY}"
echo "Downloading ${BINARY}..."
mkdir -p "$INSTALL_DIR"
curl -sL -o "${INSTALL_DIR}/carecom" "$URL"
chmod +x "${INSTALL_DIR}/carecom"

echo "Installed carecom ${TAG} to ${INSTALL_DIR}/carecom"

# Check PATH
if [[ ":$PATH:" != *":${INSTALL_DIR}:"* ]]; then
  echo ""
  echo "Warning: ${INSTALL_DIR} is not in your PATH."
  echo "Add it with:"
  echo "  echo 'export PATH=\"${INSTALL_DIR}:\$PATH\"' >> ~/.zshrc"
fi
