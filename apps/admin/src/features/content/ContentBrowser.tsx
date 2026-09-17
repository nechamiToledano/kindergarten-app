import { useCallback, useEffect, useState } from 'react';
import {
  AgeGroupSchema,
  type AgeGroup,
  type Domain,
  type SubdomainSummary,
} from '@kga/contracts';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Dialog,
  ErrorState,
  Field,
  Input,
  Tabs,
} from '@kga/ui';
import { engineRegistry } from '../../shared/engine';
import { subdomainPreviewUrl } from '../../shared/webApp';
import { contentApi } from './api';
import { GAME_TYPE_LABELS } from './fieldLabels';
import { SubdomainEditor } from './SubdomainEditor';

const AGE_GROUPS = AgeGroupSchema.options;
const AGE_LABEL: Record<AgeGroup, string> = {
  AGE_3_4: 'גיל 3–4',
  AGE_4_5: 'גיל 4–5',
  AGE_5_6: 'גיל 5–6',
};

/** A single text-field prompt (add / rename), replacing `window.prompt`. */
function NameDialog({
  open,
  title,
  fieldLabel,
  initialValue,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  fieldLabel: string;
  initialValue: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initialValue);
      setError(null);
    }
  }, [open, initialValue]);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(name.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel}>
            ביטול
          </Button>
          <Button type="button" loading={busy} disabled={!name.trim()} onClick={submit}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label={fieldLabel}>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </Field>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </Dialog>
  );
}

/** A delete confirmation, replacing `window.confirm`. */
function DeleteDialog({
  open,
  itemName,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  itemName: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה');
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title="מחיקה"
      description={`למחוק את "${itemName}"? לא ניתן לשחזר פעולה זו.`}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel}>
            ביטול
          </Button>
          <Button type="button" variant="danger" loading={busy} onClick={submit}>
            מחק
          </Button>
        </>
      }
    >
      {error && <p className="text-sm text-destructive">{error}</p>}
    </Dialog>
  );
}

type DomainDialogState =
  | { kind: 'add' }
  | { kind: 'rename'; domain: Domain }
  | { kind: 'delete'; domain: Domain }
  | null;

type SubdomainDialogState = { kind: 'delete'; subdomain: SubdomainSummary } | null;

export function ContentBrowser() {
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('AGE_4_5');
  const [domains, setDomains] = useState<Domain[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [openDomain, setOpenDomain] = useState<Domain | null>(null);
  const [subdomains, setSubdomains] = useState<SubdomainSummary[] | null>(null);
  // The editor is addressed by id, not by the row object: a list row is a
  // summary without its gameConfig, and handing that to the editor as if it were
  // a full subdomain is how an edit silently blanks a config.
  const [editing, setEditing] = useState<{ domainId: string; subdomainId: string | null } | null>(
    null,
  );

  const [domainDialog, setDomainDialog] = useState<DomainDialogState>(null);
  const [subdomainDialog, setSubdomainDialog] = useState<SubdomainDialogState>(null);

  // M10 §1 — domains no longer belong to an age band, so the whole list loads
  // once. The age selector below filters the *subdomains* under a domain, which
  // is where age actually varies.
  const loadDomains = useCallback(() => {
    setDomains(null);
    contentApi
      .listDomains()
      .then(setDomains)
      .catch((e) => setError(e instanceof Error ? e.message : 'שגיאה'));
  }, []);

  useEffect(loadDomains, [loadDomains]);

  const loadSubdomains = useCallback(
    (domain: Domain) => {
      setOpenDomain(domain);
      setSubdomains(null);
      contentApi
        .listSubdomains({ domainId: domain.id, ageGroup })
        .then(setSubdomains)
        .catch((e) => setError(e instanceof Error ? e.message : 'שגיאה'));
    },
    [ageGroup],
  );

  async function duplicateSubdomain(s: SubdomainSummary) {
    try {
      // The list row is a summary without gameConfig/demoConfig — load the full
      // record first so the copy actually carries the config, not a blank one.
      const full = await contentApi.getSubdomain(s.id);
      await contentApi.createSubdomain({
        domainId: full.domainId,
        name: `${full.name} (עותק)`,
        orderIndex: (subdomains?.length ?? 0) + 1,
        ageGroups: full.ageGroups,
        level: full.level,
        teacherInstruction: full.teacherInstruction,
        childInstruction: full.childInstruction,
        gameType: full.gameType,
        gameConfig: full.gameConfig,
        demoConfig: full.demoConfig,
      });
      if (openDomain) loadSubdomains(openDomain);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה');
    }
  }

  async function moveDomain(d: Domain, dir: -1 | 1) {
    if (!domains) return;
    const idx = domains.findIndex((x) => x.id === d.id);
    const other = domains[idx + dir];
    if (!other) return;
    try {
      await Promise.all([
        contentApi.updateDomain(d.id, { orderIndex: other.orderIndex }),
        contentApi.updateDomain(other.id, { orderIndex: d.orderIndex }),
      ]);
      loadDomains();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה');
    }
  }

  async function moveSubdomain(s: SubdomainSummary, dir: -1 | 1) {
    if (!subdomains) return;
    const idx = subdomains.findIndex((x) => x.id === s.id);
    const other = subdomains[idx + dir];
    if (!other || !openDomain) return;
    try {
      await Promise.all([
        contentApi.updateSubdomain(s.id, { orderIndex: other.orderIndex }),
        contentApi.updateSubdomain(other.id, { orderIndex: s.orderIndex }),
      ]);
      loadSubdomains(openDomain);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה');
    }
  }

  if (editing) {
    return (
      <SubdomainEditor
        domainId={editing.domainId}
        subdomainId={editing.subdomainId}
        defaultAgeGroup={ageGroup}
        onCancel={() => setEditing(null)}
        onDone={() => {
          setEditing(null);
          if (openDomain) loadSubdomains(openDomain);
        }}
      />
    );
  }

  return (
    <div className="grid gap-4">
      <Tabs
        tabs={AGE_GROUPS.map((ag) => ({ value: ag, label: AGE_LABEL[ag] }))}
        value={ageGroup}
        onChange={(ag) => {
          setAgeGroup(ag);
          setOpenDomain(null);
        }}
      />

      {error && <ErrorState message={error} onRetry={loadDomains} />}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader
            title="תחומים"
            actions={
              <Button type="button" size="sm" variant="outline" onClick={() => setDomainDialog({ kind: 'add' })}>
                + תחום
              </Button>
            }
          />
          <CardBody>
            {!domains && <p className="text-sm text-muted-foreground">טוען…</p>}
            <ul className="grid divide-y divide-border overflow-hidden rounded-lg border border-border">
              {domains?.map((d, i) => (
                <li
                  key={d.id}
                  className={`flex items-center gap-2 px-3 py-2 ${openDomain?.id === d.id ? 'bg-accent' : ''}`}
                >
                  <div className="grid text-xs leading-none text-muted-foreground">
                    <button type="button" disabled={i === 0} onClick={() => moveDomain(d, -1)} className="disabled:opacity-30">
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={i === domains.length - 1}
                      onClick={() => moveDomain(d, 1)}
                      className="disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </div>
                  <button
                    type="button"
                    className="flex-1 text-start text-sm"
                    onClick={() => loadSubdomains(d)}
                  >
                    {d.name}
                  </button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setDomainDialog({ kind: 'rename', domain: d })}>
                    שנה שם
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDomainDialog({ kind: 'delete', domain: d })}
                  >
                    מחק
                  </Button>
                </li>
              ))}
              {domains?.length === 0 && (
                <li className="px-3 py-2 text-sm text-muted-foreground">אין תחומים עדיין.</li>
              )}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={openDomain ? `תת-תחומים · ${openDomain.name}` : 'תת-תחומים'}
            actions={
              openDomain && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing({ domainId: openDomain.id, subdomainId: null })}
                >
                  + תת-תחום
                </Button>
              )
            }
          />
          <CardBody>
            {!openDomain && <p className="text-sm text-muted-foreground">בחר תחום כדי לראות את תתי-התחומים שלו.</p>}
            {openDomain && !subdomains && <p className="text-sm text-muted-foreground">טוען…</p>}
            <ul className="grid divide-y divide-border overflow-hidden rounded-lg border border-border">
              {subdomains?.map((s, i) => (
                <li key={s.id} className="flex items-center gap-2 px-3 py-2">
                  <div className="grid text-xs leading-none text-muted-foreground">
                    <button type="button" disabled={i === 0} onClick={() => moveSubdomain(s, -1)} className="disabled:opacity-30">
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={i === subdomains.length - 1}
                      onClick={() => moveSubdomain(s, 1)}
                      className="disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </div>
                  <button
                    type="button"
                    className="flex flex-1 flex-wrap items-center gap-2 text-start text-sm"
                    onClick={() => setEditing({ domainId: s.domainId, subdomainId: s.id })}
                  >
                    {s.name}
                    <Badge>{GAME_TYPE_LABELS[s.gameType] ?? engineRegistry.get(s.gameType).meta.label}</Badge>
                    <Badge tone="neutral">רמה {s.level}</Badge>
                    {!s.playable && <Badge tone="partial">טרם פורסם</Badge>}
                  </button>
                  {s.playable && (
                    <a
                      className="text-sm font-semibold text-primary"
                      href={subdomainPreviewUrl(s.id)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      שחק
                    </a>
                  )}
                  <Button type="button" size="sm" variant="ghost" onClick={() => duplicateSubdomain(s)}>
                    שכפל
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setSubdomainDialog({ kind: 'delete', subdomain: s })}
                  >
                    מחק
                  </Button>
                </li>
              ))}
              {openDomain && subdomains?.length === 0 && (
                <li className="px-3 py-2 text-sm text-muted-foreground">אין תת-תחומים לקבוצת הגיל הזו.</li>
              )}
            </ul>
          </CardBody>
        </Card>
      </div>

      <NameDialog
        open={domainDialog?.kind === 'add'}
        title="תחום חדש"
        fieldLabel="שם התחום"
        initialValue=""
        confirmLabel="צור"
        onCancel={() => setDomainDialog(null)}
        onConfirm={async (name) => {
          await contentApi.createDomain({ name, orderIndex: domains?.length ?? 0 });
          setDomainDialog(null);
          loadDomains();
        }}
      />

      <NameDialog
        open={domainDialog?.kind === 'rename'}
        title="שינוי שם תחום"
        fieldLabel="שם חדש"
        initialValue={domainDialog?.kind === 'rename' ? domainDialog.domain.name : ''}
        confirmLabel="שמור"
        onCancel={() => setDomainDialog(null)}
        onConfirm={async (name) => {
          if (domainDialog?.kind !== 'rename') return;
          await contentApi.updateDomain(domainDialog.domain.id, { name });
          setDomainDialog(null);
          loadDomains();
        }}
      />

      <DeleteDialog
        open={domainDialog?.kind === 'delete'}
        itemName={domainDialog?.kind === 'delete' ? domainDialog.domain.name : ''}
        onCancel={() => setDomainDialog(null)}
        onConfirm={async () => {
          if (domainDialog?.kind !== 'delete') return;
          await contentApi.deleteDomain(domainDialog.domain.id);
          if (openDomain?.id === domainDialog.domain.id) setOpenDomain(null);
          setDomainDialog(null);
          loadDomains();
        }}
      />

      <DeleteDialog
        open={subdomainDialog?.kind === 'delete'}
        itemName={subdomainDialog?.kind === 'delete' ? subdomainDialog.subdomain.name : ''}
        onCancel={() => setSubdomainDialog(null)}
        onConfirm={async () => {
          if (subdomainDialog?.kind !== 'delete') return;
          await contentApi.deleteSubdomain(subdomainDialog.subdomain.id);
          setSubdomainDialog(null);
          if (openDomain) loadSubdomains(openDomain);
        }}
      />
    </div>
  );
}
