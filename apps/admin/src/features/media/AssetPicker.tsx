import { useEffect, useRef, useState } from 'react';
import type { MediaAsset } from '@kga/contracts';
import { mediaLibraryApi } from './api';

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
    <div className="asset-picker">
      {value ? (
        <div className="asset-picker-preview">
          {kind === 'image' ? (
            <img src={value} alt="" />
          ) : (
            <audio src={value} controls />
          )}
        </div>
      ) : (
        <p className="muted">אין נכס נבחר</p>
      )}
      <div className="row">
        <input
          value={value}
          placeholder="כתובת קובץ, או בחר מהספרייה"
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>
          {kind === 'image' ? 'בחר תמונה' : 'בחר קול'}
        </button>
      </div>
      {open && (
        <AssetPickerModal
          kind={kind}
          onPick={(url) => {
            onChange(url);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function AssetPickerModal({
  kind,
  onPick,
  onClose,
}: {
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
    mediaLibraryApi
      .list({ kind, search: search || undefined, page: 1, pageSize: 60 })
      .then((res) => setItems(res.items))
      .catch((e) => setError(e instanceof Error ? e.message : 'שגיאה'));
  }

  useEffect(load, [search]);

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="row modal-head">
          <h3>{kind === 'image' ? 'בחירת תמונה מהספרייה' : 'בחירת קול מהספרייה'}</h3>
          <button type="button" className="link" onClick={onClose}>
            סגור
          </button>
        </div>
        <div className="row">
          <input
            placeholder="חיפוש לפי שם קובץ"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="btn-primary" style={{ marginInlineStart: 'auto' }}>
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
              style={{ display: 'none' }}
            />
          </label>
        </div>
        {error && <p className="error-text">{error}</p>}
        {!items && <p className="muted">טוען…</p>}
        <div className="media-grid modal-grid">
          {items?.map((a) => (
            <button
              type="button"
              key={a.id}
              className="media-card asset-pick"
              onClick={() => onPick(a.url)}
            >
              {a.kind === 'image' ? (
                <img src={a.url} alt={a.originalName ?? a.key} loading="lazy" />
              ) : (
                <audio src={a.url} controls onClick={(e) => e.stopPropagation()} />
              )}
              <p className="muted media-name" title={a.originalName ?? a.key}>
                {a.originalName ?? a.key}
              </p>
            </button>
          ))}
          {items?.length === 0 && <p className="muted">אין נכסים תואמים. אפשר להעלות חדש למעלה.</p>}
        </div>
      </div>
    </div>
  );
}
