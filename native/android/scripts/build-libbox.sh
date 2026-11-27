#!/usr/bin/env bash
# Builds libbox.aar (the sing-box core for Android) and copies it to android/app/libs/.
# Needs: Go, JDK, Android SDK + NDK (all present on GitHub's ubuntu-latest once setup-go ran).
set -euo pipefail

SING_BOX_REF="${SING_BOX_REF:-v1.11.15}"
OUT_DIR="$(pwd)/android/app/libs"

if [ -z "${ANDROID_NDK_HOME:-}" ]; then
  ANDROID_NDK_HOME="$(ls -d "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/usr/local/lib/android/sdk}}"/ndk/* 2>/dev/null | sort -V | tail -n1 || true)"
  export ANDROID_NDK_HOME
fi
echo "sing-box ref: $SING_BOX_REF"
echo "NDK: ${ANDROID_NDK_HOME:-<not found>}"
[ -n "${ANDROID_NDK_HOME:-}" ] || { echo "Android NDK not found"; exit 1; }

WORK="$(mktemp -d)"
git clone --depth 1 --branch "$SING_BOX_REF" https://github.com/SagerNet/sing-box.git "$WORK/sing-box"
cd "$WORK/sing-box"

if grep -rq "with_clash_api" cmd/internal/build_libbox 2>/dev/null; then
  echo "libbox build tags include with_clash_api (tunnel latency / auto-switch readings available)"
else
  echo "WARNING: with_clash_api not found in build_libbox tags; the app still connects (it retries without the controller) but shows no tunnel latency"
fi

export PATH="$PATH:$(go env GOPATH)/bin"
go run ./cmd/internal/build_libbox -target android

AAR="$(ls -1 libbox*.aar | head -n1)"
mkdir -p "$OUT_DIR"
cp "$AAR" "$OUT_DIR/libbox.aar"
echo "Built $(du -h "$OUT_DIR/libbox.aar" | cut -f1) libbox.aar"
