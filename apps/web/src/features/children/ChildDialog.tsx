import { useState } from 'react';
import type { Child } from '@kga/contracts';
import { Avatar } from '@kga/ui';
import { createChild, updateChild, uploadPhoto } from '../sessions/api';

/** Spec §9 bands, mirrored client-side just to show the derived group live (§3.2). */
function ageGroupLabel(birthDate: string): string {
  if (!birthDate) return '';
  const age = Math.floor(
    (Date.now() - new Date(birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25),
  );
  if (age <= 3) return 'קבוצת גיל: 3-4';
  if (age === 4) return 'קבוצת גיל: 4-5';
  return 'קבוצת גיל: 5-6';
}

/** M7 §3.2 — add/edit a child in a dialog rather than a separate page. */
export function ChildDialog({
  child,
  onClose,
  onSaved,
}: {
  child: Child | null;
  onClose: () => void;
  onSaved: (child: Child) => void;
}) {
  const [displayName, setDisplayName] = useState(child?.displayName ?? '');
  const [birthDate, setBirthDate] = useState(child?.birthDate ?? '');
  const [photoUrl, setPhotoUrl] = useState<string | null>(child?.photoUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePhoto = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const result = await uploadPhoto(file);
      setPhotoUrl(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'העלאת התמונה נכשלה');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!displayName.trim() || !birthDate) return;
    setSaving(true);
    setError(null);
    try {
      const body = { displayName: displayName.trim(), birthDate, photoUrl };
      const saved = child ? await updateChild(child.id, body) : await createChild(body);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'השמירה נכשלה');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <h2>{child ? 'עריכת ילד/ה' : 'הוספת ילד/ה'}</h2>

        <div className="photo-picker">
          <Avatar name={displayName || '?'} photoUrl={photoUrl} size={72} />
          <label className="btn-ghost" style={{ cursor: 'pointer' }}>
            {uploading ? 'מעלה…' : photoUrl ? 'החלפת תמונה' : 'הוספת תמונה'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              disabled={uploading}
              onChange={(e) => void handlePhoto(e.target.files?.[0])}
            />
          </label>
        </div>

        <label>
          שם
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="שם הילד/ה"
          />
        </label>

        <label>
          תאריך לידה
          <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </label>
        {birthDate && <p className="muted">{ageGroupLabel(birthDate)}</p>}

        {error && <p className="error-text">{error}</p>}

        <div className="row">
          <button
            type="button"
            className="btn-primary"
            disabled={saving || uploading || !displayName.trim() || !birthDate}
            onClick={() => void submit()}
          >
            {saving ? 'שומר…' : 'שמירה'}
          </button>
          <button type="button" className="btn-ghost" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
