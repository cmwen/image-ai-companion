#!/usr/bin/env bash
set -euo pipefail
: "${RELEASE_TAG:?Set RELEASE_TAG to the version tag}"
[[ "$RELEASE_TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.-]+)?$ ]] || exit 1
bundle_dir="src-tauri/target/universal-apple-darwin/release/bundle"
app_path="$bundle_dir/macos/Image AI Companion.app"
[[ -d "$app_path" ]]
codesign --verify --deep --strict --verbose=2 "$app_path"
signature_details="$(codesign --display --verbose=4 "$app_path" 2>&1)"
printf '%s\n' "$signature_details"
printf '%s\n' "$signature_details" | grep -Fx 'Signature=adhoc'
lipo "$app_path/Contents/MacOS/image-ai-companion" -verify_arch arm64 x86_64
shopt -s nullglob
dmgs=("$bundle_dir"/dmg/*.dmg)
[[ ${#dmgs[@]} -eq 1 ]]
hdiutil verify "${dmgs[0]}"
# Check the application actually carried by the distributable image as well.
mount_path="$(mktemp -d)"
cleanup() { hdiutil detach "$mount_path" -quiet || true; rmdir "$mount_path" || true; }
trap cleanup EXIT
hdiutil attach "${dmgs[0]}" -mountpoint "$mount_path" -nobrowse -readonly -quiet
codesign --verify --deep --strict --verbose=2 "$mount_path/Image AI Companion.app"
codesign --display --verbose=4 "$mount_path/Image AI Companion.app" 2>&1 | grep -Fx 'Signature=adhoc'
lipo "$mount_path/Image AI Companion.app/Contents/MacOS/image-ai-companion" -verify_arch arm64 x86_64
mkdir -p release-assets
cp "${dmgs[0]}" "release-assets/Image-AI-Companion_${RELEASE_TAG}_universal.dmg"
tar -czf "release-assets/Image-AI-Companion_${RELEASE_TAG}_universal.app.tar.gz" -C "$bundle_dir/macos" 'Image AI Companion.app'
(cd release-assets && shasum -a 256 ./*.dmg ./*.tar.gz > SHA256SUMS && shasum -a 256 -c SHA256SUMS)
