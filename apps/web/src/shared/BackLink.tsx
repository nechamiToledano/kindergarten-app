import { useLocation, useNavigate } from 'react-router';
import { ChevronNext, cn } from '@kga/ui';

/**
 * "Back to where I was".
 *
 * When this screen was reached from inside the app, it pops the history stack,
 * which restores the previous screen exactly as it was left — its URL carries the
 * filters, page and tab (see `useUrlState`). Only when there is nothing to go
 * back to (a deep link, a reload into the page) does it fall back to `fallback`,
 * so the button always does something sensible.
 */
export function useGoBack(fallback: string) {
  const navigate = useNavigate();
  const location = useLocation();
  // 'default' is the key of the first entry in this tab's history.
  return () => (location.key !== 'default' ? navigate(-1) : navigate(fallback));
}

export function BackLink({
  fallback,
  children = 'חזרה',
  className,
}: {
  fallback: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const goBack = useGoBack(fallback);

  return (
    <button
      type="button"
      onClick={goBack}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-sm text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      <ChevronNext className="size-3.5 rotate-180" />
      {children}
    </button>
  );
}
