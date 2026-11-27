#!/usr/bin/env bash
# Finds Java problems that do NOT depend on the Android SDK: syntax errors, duplicate names, bad types.
# It has no Android/Capacitor/libbox jars, so "cannot find symbol" and "package ... does not exist"
# are expected and hidden. Needs a JDK (java 11+ with the compiler module). Usage: bash native/android/scripts/syntax-check.sh
set -euo pipefail
cd "$(dirname "$0")/../../.."
# engine-stub and engine-libbox are alternatives (install-native.sh picks one): check libbox only.
FILES=$(find native/android/src native/android/engine-libbox -name '*.java')
OUT=$(java native/android/scripts/JavaSyntaxCheck.java $FILES 2>&1 || true)
REAL=$(echo "$OUT" | grep -E '^(ERROR|WARNING)' | grep -vE 'cannot find symbol|does not exist|cannot be resolved' || true)
if [ -n "$REAL" ]; then echo "$REAL"; echo "PROBLEMS FOUND"; exit 1; fi
echo "Java syntax check OK ($(echo "$FILES" | wc -l | tr -d ' ') files; Android-SDK-dependent errors not checked)"
