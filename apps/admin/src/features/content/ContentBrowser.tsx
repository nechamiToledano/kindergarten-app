import { useCallback, useEffect, useState } from 'react';
import { AgeGroupSchema, type AgeGroup, type Domain, type Subdomain } from '@kga/contracts';
import { engineRegistry } from '../../shared/engine';
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
  const [subdomains, setSubdomains] = useState<Subdomain[] | null>(null);
  const [editing, setEditing] = useState<{ domainId: string; subdomain: Subdomain | null } | null>(
    null,
  );

  const loadDomains = useCallback(() => {
    setDomains(null);
    contentApi
      .listDomains(ageGroup)
      .then(setDomains)
      .catch((e) => setError(e instanceof Error ? e.message : 'שגיאה'));
  }, [ageGroup]);

  useEffect(loadDomains, [loadDomains]);

  const loadSubdomains = useCallback((domain: Domain) => {
    setOpenDomain(domain);
    setSubdomains(null);
    contentApi
      .listSubdomains(domain.id)
      .then(setSubdomains)
      .catch((e) => setError(e instanceof Error ? e.message : 'שגיאה'));
  }, []);

  async function addDomain() {
    const name = window.prompt('שם התחום החדש');
    if (!name) return;
    try {
      await contentApi.createDomain({ ageGroup, name, orderIndex: domains?.length ?? 0 });
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

  async function deleteSubdomain(s: Subdomain) {
    if (!window.confirm(`למחוק את "${s.name}"?`)) return;
    try {
      await contentApi.deleteSubdomain(s.id);
      if (openDomain) loadSubdomains(openDomain);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה');
    }
  }

  if (editing) {
    return (
      <SubdomainEditor
        domainId={editing.domainId}
        existing={editing.subdomain}
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
            {domains?.map((d) => (
              <li key={d.id} className={openDomain?.id === d.id ? 'active' : ''}>
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
            {domains?.length === 0 && <li className="muted">אין תחומים בגיל זה.</li>}
          </ul>
        </section>

        <section className="col">
          <div className="col-head">
            <h2>{openDomain ? `תת-תחומים · ${openDomain.name}` : 'תת-תחומים'}</h2>
            {openDomain && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setEditing({ domainId: openDomain.id, subdomain: null })}
              >
                + תת-תחום
              </button>
            )}
          </div>
          {!openDomain && <p className="muted">בחר תחום כדי לראות את תתי-התחומים שלו.</p>}
          {openDomain && !subdomains && <p className="muted">טוען…</p>}
          <ul className="list">
            {subdomains?.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="list-main"
                  onClick={() => setEditing({ domainId: s.domainId, subdomain: s })}
                >
                  {s.name}
                  <span className="badge">{engineRegistry.get(s.gameType).meta.label}</span>
                </button>
                <button type="button" className="link danger" onClick={() => deleteSubdomain(s)}>
                  מחק
                </button>
              </li>
            ))}
            {openDomain && subdomains?.length === 0 && (
              <li className="muted">אין תת-תחומים.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
