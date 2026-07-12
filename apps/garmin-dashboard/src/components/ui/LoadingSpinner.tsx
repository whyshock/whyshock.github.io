/**
 * A simple loading spinner displayed as a Suspense fallback
 * while lazy-loaded route components are being fetched.
 */
export function LoadingSpinner() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-bg-primary"
      role="status"
      aria-label="Loading"
    >
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-border-primary border-t-accent-primary" />
    </div>
  );
}
