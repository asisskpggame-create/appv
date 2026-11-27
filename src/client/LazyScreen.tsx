import React, { Suspense } from 'react';

/** Shown while a screen's code is loading. No text, so it needs no translation. */
function ScreenLoading() {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="flex justify-center py-24">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent opacity-40" />
    </div>
  );
}

interface BoundaryState {
  failed: boolean;
}

/**
 * Catches a failed screen-code download (offline, interrupted) so the whole app does not turn into a
 * blank page; the person can reload. Resets when `resetKey` (the screen name) changes.
 */
class LoadFailureBoundary extends React.Component<{ resetKey: string; children: React.ReactNode }, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="mx-auto max-w-md space-y-3 py-20 text-center">
        <p className="text-sm font-medium">Could not load this screen. Check the connection and try again.</p>
        <p className="text-sm font-medium" dir="rtl">
          بارگذاری این صفحه انجام نشد. اتصال را بررسی کنید و دوباره تلاش کنید.
        </p>
        <button type="button" className="rounded-xl border px-4 py-2 text-sm" onClick={() => window.location.reload()}>
          Reload / بارگذاری مجدد
        </button>
      </div>
    );
  }
}

export function LazyScreen({ screen, children }: { screen: string; children: React.ReactNode }) {
  return (
    <LoadFailureBoundary resetKey={screen}>
      <Suspense fallback={<ScreenLoading />}>{children}</Suspense>
    </LoadFailureBoundary>
  );
}
