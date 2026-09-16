import { useCallback, useEffect, useState } from 'react';
import {
  AgeGroupSchema,
  type AgeGroup,
  type Domain,
  type SubdomainSummary,
} from '@kga/contracts';
import { engineRegistry } from '../../shared/engine';
import { subdomainPreviewUrl } from '../../shared/webApp';
import { contentApi } from './api';
import { SubdomainEditor } from './SubdomainEditor';

const AGE_GROUPS = AgeGroupSchema.options;
const AGE_LABEL: Record<AgeGroup, string> = {
  AGE_3_4: 'גיל 3–4',
  AGE_4_5: 'גיל 4–5',
  AGE_5_6: 'גיל 5–6',
};

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

  async function addDomain() {
    const name = window.prompt('שם התחום החדש');
    if (!name) return;
    try {
      // The slug is derived server-side from the name when omitted.
      await contentApi.createDomain({ name, orderIndex: domains?.length ?? 0 });
      loadDomains();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה');
    }
  }

  async function renameDomain(d: Domain) {
    const name = window.prompt('שם חדש לתחום', d.name);
    if (!name || name === d.name) return;
    try {
      await contentApi.updateDomain(d.id, { name });
      loadDomains();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה');
    }
  }

  async function deleteDomain(d: Domain) {
    if (!window.confirm(`למחוק את "${d.name}"?`)) return;
    try {
      await contentApi.deleteDomain(d.id);
      if (openDomain?.id === d.id) setOpenDomain(null);
      loadDomains();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה');
    }
  }

  async function deleteSubdomain(s: SubdomainSummary) {
    if (!window.confirm(`למחוק את "${s.name}"?`)) return;
    try {
      await contentApi.deleteSubdomain(s.id);
      if (openDomain) loadSubdomains(openDomain);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה');
    }
  }

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
    <div className="browser">
      <div className="tabs">
        {AGE_GROUPS.map((ag) => (
          <button
            key={ag}
            type="button"
            className={`tab ${ag === ageGroup ? 'tab-active' : ''}`}
            onClick={() => {
              setAgeGroup(ag);
              setOpenDomain(null);
            }}
          >
            {AGE_LABEL[ag]}
          </button>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="browser-cols">
        <section className="col">
          <div className="col-head">
            <h2>תחומים</h2>
            <button type="button" className="btn-ghost" onClick={addDomain}>
              + תחום
            </button>
          </div>
          {!domains && <p className="muted">טוען…</p>}
          <ul className="list">
            {domains?.map((d, i) => (
              <li key={d.id} className={openDomain?.id === d.id ? 'active' : ''}>
                <div className="reorder">
                  <button
                    type="button"
                    className="link"
                    disabled={i === 0}
                    onClick={() => moveDomain(d, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="link"
                    disabled={i === domains.length - 1}
                    onClick={() => moveDomain(d, 1)}
                  >
                    ↓
                  </button>
                </div>
                <button type="button" className="list-main" onClick={() => loadSubdomains(d)}>
                  {d.name}
                </button>
                <button type="button" className="link" onClick={() => renameDomain(d)}>
                  שנה שם
                </button>
                <button type="button" className="link danger" onClick={() => deleteDomain(d)}>
                  מחק
                </button>
              </li>
            ))}
            {domains?.length === 0 && <li className="muted">אין תחומים עדיין.</li>}
          </ul>
        </section>

        <section className="col">
          <div className="col-head">
            <h2>{openDomain ? `תת-תחומים · ${openDomain.name}` : 'תת-תחומים'}</h2>
            {openDomain && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setEditing({ domainId: openDomain.id, subdomainId: null })}
              >
                + תת-תחום
              </button>
            )}
          </div>
          {!openDomain && <p className="muted">בחר תחום כדי לראות את תתי-התחומים שלו.</p>}
          {openDomain && !subdomains && <p className="muted">טוען…</p>}
          <ul className="list">
            {subdomains?.map((s, i) => (
              <li key={s.id}>
                <div className="reorder">
                  <button
                    type="button"
                    className="link"
                    disabled={i === 0}
                    onClick={() => moveSubdomain(s, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="link"
                    disabled={i === subdomains.length - 1}
                    onClick={() => moveSubdomain(s, 1)}
                  >
                    ↓
                  </button>
                </div>
                <button
                  type="button"
                  className="list-main"
                  onClick={() => setEditing({ domainId: s.domainId, subdomainId: s.id })}
                >
                  {s.name}
                  <span className="badge">{engineRegistry.get(s.gameType).meta.label}</span>
                  <span className="badge">רמה {s.level}</span>
                  {!s.playable && <span className="badge">טרם פורסם</span>}
                </button>
                {s.playable && (
                  <a
                    className="link"
                    href={subdomainPreviewUrl(s.id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    שחק
                  </a>
                )}
                <button type="button" className="link" onClick={() => duplicateSubdomain(s)}>
                  שכפל
                </button>
                <button type="button" className="link danger" onClick={() => deleteSubdomain(s)}>
                  מחק
                </button>
              </li>
            ))}
            {openDomain && subdomains?.length === 0 && (
              <li className="muted">אין תת-תחומים לקבוצת הגיל הזו.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
