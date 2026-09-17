import { useEffect, useRef, useState } from 'react';
import type { MediaAsset } from '@kga/contracts';
import { Button, buttonClass, Dialog, EmptyState, ErrorState, Input, SearchInput } from '@kga/ui';
import { resolveAssetUrl } from '../../shared/webApp';
import { mediaLibraryApi } from './api';

/** Seed-only placeholder audio (no recording exists yet) — apps/web synthesises
 * a tone for this at play time; there's no real file an <audio> tag can load. */
const isToneUrl = (url: string): boolean => url.startsWith('tone:');

/**
 * Inline asset control used everywhere a game config needs an image/audio URL
 * (SchemaForm's generated fields, HotspotEditor). Lets a non-technical editor
 * browse the media library or upload a new file, instead of hand-typing a
 * bucket URL. The raw text input stays as an escape hatch for a URL that
 * already lives outside the library.
 */
export function AssetPicker({
  kind,
  value,
  onChange,
}: {
  kind: 'image' | 'audio';
  value: string;
  onChange: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-2">
      {value ? (
        <div>
          {kind === 'audio' && isToneUrl(value) ? (
            <p className="text-sm text-muted-foreground">
              🔊 צליל placeholder (אין הקלטה אמיתית עדיין) — "{decodeURIComponent(value.slice('tone:'.length))}"
            </p>
          ) : kind === 'image' ? (
            <img
              src={resolveAssetUrl(value)}
              alt=""
              className="max-h-[90px] max-w-[120px] rounded-md bg-muted object-contain"
            />
          ) : (
            <audio src={resolveAssetUrl(value)} controls className="w-[220px]" />
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">אין נכס נבחר</p>
      )}
      <div className="flex items-center gap-2">
        <Input
          value={value}
          placeholder="כתובת קובץ, או בחר מהספרייה"
          onChange={(e) => onChange(e.target.value)}
        />
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          {kind === 'image' ? 'בחר תמונה' : 'בחר קול'}
        </Button>
      </div>
      <AssetPickerModal
        open={open}
        kind={kind}
        onPick={(url) => {
          onChange(url);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}

function AssetPickerModal({
  open,
  kind,
  onPick,
  onClose,
}: {
  open: boolean;
  kind: 'image' | 'audio';
  onPick: (url: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<MediaAsset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function load() {
    setItems(null);
    setError(null);
    mediaLibraryApi
      .list({ kind, search: search || undefined, page: 1, pageSize: 60 })
      .then((res) => setItems(res.items))
      .catch((e) => setError(e instanceof Error ? e.message : 'שגיאה'));
  }

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, search]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const res = await mediaLibraryApi.upload(file);
      onPick(res.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'העלאה נכשלה');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={kind === 'image' ? 'בחירת תמונה מהספרייה' : 'בחירת קול מהספרייה'}
      size="lg"
    >
      <div className="grid gap-3">
        <div className="flex items-center gap-2">
          <SearchInput
            className="flex-1"
            placeholder="חיפוש לפי שם קובץ"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className={buttonClass('secondary', 'md', 'cursor-pointer')}>
            {uploading ? 'מעלה…' : '+ העלאה חדשה'}
            <input
              ref={fileInput}
              type="file"
              accept={
                kind === 'image'
                  ? 'image/png,image/jpeg,image/webp,image/svg+xml'
                  : 'audio/mpeg,audio/wav,audio/ogg'
              }
              onChange={onUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>

        {error && <ErrorState message={error} onRetry={load} />}
        {!items && !error && <p className="text-sm text-muted-foreground">טוען…</p>}

        {items?.length === 0 && (
          <EmptyState title="אין נכסים תואמים" description="אפשר להעלות קובץ חדש למעלה." />
        )}

        <div className="grid max-h-[50vh] grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 overflow-y-auto">
          {items?.map((a) => (
            <button
              type="button"
              key={a.id}
              onClick={() => onPick(a.url)}
              className="grid gap-1.5 rounded-lg border border-border p-2 text-start transition-colors hover:border-primary hover:bg-accent"
            >
              {a.kind === 'image' ? (
                <img
                  src={a.url}
                  alt={a.originalName ?? a.key}
                  loading="lazy"
                  className="aspect-square rounded-md bg-muted object-contain"
                />
              ) : (
                <audio src={a.url} controls onClick={(e) => e.stopPropagation()} className="w-full" />
              )}
              <p className="truncate text-xs text-muted-foreground" title={a.originalName ?? a.key}>
                {a.originalName ?? a.key}
              </p>
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
