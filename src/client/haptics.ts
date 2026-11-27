/**
 * Light haptic tick for native-feel taps. Uses the Vibration API, which is a
 * no-op where unsupported (desktop browsers, iOS Safari). On Android the CI
 * build adds the VIBRATE permission to the manifest.
 */
export function tapHaptic(ms = 8): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms);
    }
  } catch {
    // Ignore: haptics are best-effort only.
  }
}
