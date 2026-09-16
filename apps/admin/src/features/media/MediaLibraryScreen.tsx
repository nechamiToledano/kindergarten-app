import { useEffect, useRef, useState } from 'react';
import type { MediaAsset } from '@kga/contracts';
import { mediaLibraryApi } from './api';

const PAGE_SIZE = 40;

/**
 * The asset library (M11 — real management, §14.3 extended).
 *
 * Every upload made through any subdomain editor is catalogued here, so a
 * teacher-facing image or sound can be found and reused instead of uploaded
 * again from disk each time. Removing an asset only drops it from this
 * picker — a subdomain that already references its URL keeps working.
 */
export function MediaLibraryScreen() {
  const [kind, setKind] = useState<'' | 'image' | 'audio'>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<MediaAsset[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function load() {
    setItems(null);
    mediaLibraryApi
      .list({ kind: kind || undefined, search: search || undefined, page, pageSize: PAGE_SIZE })
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((e) => setError(errMsg(e)));
  }

  useEffect(load, [kind, search, page]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await mediaLibraryApi.upload(file);
      setPage(1);
      load();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function remove(asset: MediaAsset) {
    if (!window.confirm(`להסיר את "${asset.originalName ?? asset.key}" מהספרייה?`)) return;
    try {
      await mediaLibraryApi.remove(asset.id);
      load();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('העתק את הקישור:', url);
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="browser">
      <div className="row audit-filters">
        <div className="tabs" style={{ border: 'none', margin: 0 }}>
          {(['', 'image', 'audio'] as const).map((k) => (
            <button
              key={k}
              type="button"
              className={`tab ${kind === k ? 'tab-active' : ''}`}
              onClick={() => {
                setKind(k);
                setPage(1);
              }}
            >
              {k === '' ? 'הכל' : k === 'image' ? 'תמונות' : 'קול'}
            </button>
          ))}
        </div>
        <input
          placeholder="חיפוש לפי שם קובץ"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <label className="btn-primary" style={{ marginInlineStart: 'auto' }}>
          {uploading ? 'מעלה…' : '+ העלאת נכס'}
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,audio/mpeg,audio/wav,audio/ogg"
            onChange={onUpload}
            disabled={uploading}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {error && <p className="error-text">{error}</p>}
      {!items && <p className="muted">טוען…</p>}

      <div className="media-grid">
        {items?.map((a) => (
          <div key={a.id} className="media-card">
            {a.kind === 'image' ? (
              <img src={a.url} alt={a.originalName ?? a.key} loading="lazy" />
            ) : (
              <audio src={a.url} controls />
            )}
            <p className="muted media-name" title={a.originalName ?? a.key}>
              {a.originalName ?? a.key}
            </p>
            <p className="muted">{(a.sizeBytes / 1024).toFixed(0)} KB</p>
            <div className="row">
              <button type="button" className="link" onClick={() => copyUrl(a.url)}>
                העתק קישור
              </button>
              <button type="button" className="link danger" onClick={() => remove(a)}>
                הסר
              </button>
            </div>
          </div>
        ))}
        {items?.length === 0 && <p className="muted">אין נכסים תואמים.</p>}
      </div>

      <div className="row pager">
        <button type="button" className="btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          הקודם
        </button>
        <span className="muted">
          עמוד {page} מתוך {pageCount}
        </span>
        <button
          type="button"
          className="btn-ghost"
          disabled={page >= pageCount}
          onClick={() => setPage((p) => p + 1)}
        >
          הבא
        </button>
      </div>
    </div>
  );
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'שגיאה';
}
