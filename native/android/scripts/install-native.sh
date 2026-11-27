#!/usr/bin/env bash
# Copies the native VPN sources into the generated Capacitor Android project.
# Usage: install-native.sh [--stub]
#   default : uses the libbox engine if android/app/libs/libbox.aar exists, else the stub
#   --stub  : forces the stub (used when the libbox variant did not compile)
set -euo pipefail

SRC="native/android"
PKG="android/app/src/main/java/com/asisvpn/client"
VARIANT="engine-libbox"
if [ "${1:-}" = "--stub" ] || [ ! -f android/app/libs/libbox.aar ]; then
  VARIANT="engine-stub"
fi

rm -rf "$PKG/vpn"
mkdir -p "$PKG/vpn"
cp "$SRC/src/com/asisvpn/client/MainActivity.java" "$PKG/MainActivity.java"
cp "$SRC"/src/com/asisvpn/client/vpn/*.java "$PKG/vpn/"
cp "$SRC/$VARIANT"/com/asisvpn/client/vpn/*.java "$PKG/vpn/"

# Notification icon (white on transparent, one PNG per density)
mkdir -p android/app/src/main/res
cp -r "$SRC/res/." android/app/src/main/res/

if [ "$VARIANT" = "engine-stub" ]; then
  rm -f android/app/libs/libbox.aar
  python3 "$SRC/scripts/patch_android.py" --stub
else
  python3 "$SRC/scripts/patch_android.py"
fi
echo "Installed native sources: $VARIANT"
