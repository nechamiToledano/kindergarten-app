import { useRef, useState } from 'react';
import type { Child, ChildListItem } from '@kga/contracts';
import { Avatar, Button, Dialog, ErrorState, Field, Input, Switch } from '@kga/ui';
import { uploadPhoto } from '../../shared/api/endpoints';
import { useCreateChild, useDeleteChild, useUpdateChild } from '../../shared/api/queries';

/**
 * Add or edit a child.
 *
 * The photo uploads through the same media endpoint the content pipeline uses,
 * and only the returned URL is stored — the file itself never sits in component
 * state waiting to be lost on a re-render.
 */
export function ChildDialog({
  child,
  onClose,
  onSaved,
}: {
  child: Child | ChildListItem | null;
  onClose: () => void;
  onSaved: (name: string, created: boolean) => void;
}) {
  const editing = child !== null;
  const [displayName, setDisplayName] = useState(child?.displayName ?? '');
  const [birthDate, setBirthDate] = useState(child?.birthDate ?? '');
  const [photoUrl, setPhotoUrl] = useState<string | null>(child?.photoUrl ?? null);
  const [watch, setWatch] = useState(child?.watch ?? false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const createChild = useCreateChild();
  const updateChild = useUpdateChild();
  const deleteChild = useDeleteChild();

  const valid = displayName.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(birthDate);
  const saving = createChild.isPending || updateChild.isPending;

  const handlePhoto = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const { url } = await uploadPhoto(file);
      setPhotoUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'העלאת התמונה נכשלה');
    } finally {
      setUploading(false);
    }
  };

  const submit = () => {
    if (!valid) return;
    setError(null);
    const body = { displayName: displayName.trim(), birthDate, photoUrl, watch };
    const onError = (err: unknown) =>
      setError(err instanceof Error ? err.message : 'השמירה נכשלה');

    if (editing) {
      updateChild.mutate(
        { id: child.id, body },
        { onSuccess: () => onSaved(body.displayName, false), onError },
      );
    } else {
      createChild.mutate(body, {
        onSuccess: () => onSaved(body.displayName, true),
        onError,
      });
    }
  };

  if (confirmDelete && editing) {
    return (
      <Dialog
        open
        onClose={() => setConfirmDelete(false)}
        title={`הסרת ${child.displayName}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              ביטול
            </Button>
            <Button
              variant="danger"
              loading={deleteChild.isPending}
              onClick={() =>
                deleteChild.mutate(child.id, {
                  onSuccess: () => onSaved(child.displayName, false),
                  onError: (err) =>
                    setError(err instanceof Error ? err.message : 'ההסרה נכשלה'),
                })
              }
            >
              הסרה
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          הרשומה אינה נמחקת לצמיתות — האבחונים וההיסטוריה נשמרים, והילד/ה מוסר/ת מהרשימה
          הפעילה. שחזור אפשרי דרך צוות התמיכה.
        </p>
        {error && <ErrorState className="mt-3" message={error} />}
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={editing ? 'עריכת פרופיל' : 'הוספת ילד/ה'}
      footer={
        <>
          {editing && (
            <Button
              variant="ghost"
              className="me-auto text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              הסרה מהגן
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            ביטול
          </Button>
          <Button onClick={submit} loading={saving} disabled={!valid}>
            שמירה
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={displayName || '—'} photoUrl={photoUrl} size={56} />
          <div className="flex flex-col gap-1">
            <Button
              size="sm"
              variant="outline"
              loading={uploading}
              onClick={() => fileInput.current?.click()}
            >
              {photoUrl ? 'החלפת תמונה' : 'הוספת תמונה'}
            </Button>
            {photoUrl && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-destructive"
                onClick={() => setPhotoUrl(null)}
              >
                הסרת התמונה
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handlePhoto(file);
              event.target.value = '';
            }}
          />
        </div>

        <Field label="שם" htmlFor="child-name">
          <Input
            id="child-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="שם מלא"
            autoComplete="off"
          />
        </Field>

        <Field
          label="תאריך לידה"
          htmlFor="child-birth"
          hint="קובע את קבוצת הגיל ואת התוכן שיוצע באבחון."
        >
          <Input
            id="child-birth"
            type="date"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
            max={new Date().toISOString().slice(0, 10)}
          />
        </Field>

        <Switch checked={watch} onChange={setWatch} label="סימון למעקב מיוחד" />

        {error && <ErrorState message={error} />}
      </div>
    </Dialog>
  );
}
