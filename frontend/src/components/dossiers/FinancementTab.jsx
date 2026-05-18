import React, { useEffect, useState, useCallback } from 'react';
import api from '../../utils/api';
import useAuthStore from '../../store/authStore';
import Modal from '../ui/Modal';

const TYPE_LABELS = {
  CPF:           'CPF / Mon Compte Formation',
  FRANCE_TRAVAIL:'France Travail',
  OPCO:          'OPCO',
  PERSONNEL:     'Financement personnel',
};

const STATUT_LABELS = {
  a_facturer: 'À facturer',
  facture:    'Facturé',
  paye:       'Payé',
  litige:     'Litige',
  rembourse:  'Remboursé',
  annule:     'Annulé',
};

const STATUT_COLORS = {
  a_facturer: '#6b7280',
  facture:    '#3b82f6',
  paye:       '#16a34a',
  litige:     '#f97316',
  rembourse:  '#7c3aed',
  annule:     '#ef4444',
};

// Transitions autorisées (miroir du backend)
const TRANSITIONS = {
  a_facturer: ['facture', 'annule'],
  facture:    ['paye', 'litige', 'annule'],
  litige:     ['facture', 'paye', 'rembourse', 'annule'],
  paye:       ['rembourse', 'annule'],
};

function fmtCurrency(v) {
  if (v == null || v === '') return '—';
  return Number(v).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR');
}

const emptyForm = {
  type_financement:       'CPF',
  identifiant_financeur:  '',
  nom_organisme:          '',
  date_accord:            '',
  notes_financeur:        '',
  montant_total:          '',
  montant_pris_en_charge: '0',
  notes_comptables:       '',
};

export default function FinancementTab({ dossierId }) {
  const user     = useAuthStore((s) => s.user);
  const role     = user?.role_nom || user?.role || '';
  const isAdmin  = ['super_admin', 'role_admin'].includes(role);
  const canWrite = ['super_admin', 'role_admin', 'gestionnaire'].includes(role);

  const [financement, setFinancement] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [err, setErr]                 = useState('');

  // Formulaire création/édition
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState(emptyForm);
  const [saving, setSaving]         = useState(false);
  const [formErr, setFormErr]       = useState('');

  // Modal changement de statut
  const [showStatut, setShowStatut]           = useState(false);
  const [statutForm, setStatutForm]           = useState({ nouveau_statut: '', date_effective: new Date().toISOString().split('T')[0], commentaire: '', montant_avoir: '', motif_avoir: '' });
  const [savingStatut, setSavingStatut]       = useState(false);
  const [statutErr, setStatutErr]             = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/dossiers/${dossierId}/financement`);
      setFinancement(data.data);
    } catch { setErr('Erreur chargement financement'); }
    finally { setLoading(false); }
  }, [dossierId]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setForm(emptyForm);
    setFormErr('');
    setShowForm(true);
  }

  function openEdit() {
    if (!financement) return;
    setForm({
      type_financement:       financement.type_financement       || 'CPF',
      identifiant_financeur:  financement.identifiant_financeur  || '',
      nom_organisme:          financement.nom_organisme           || '',
      date_accord:            financement.date_accord?.split('T')[0] || '',
      notes_financeur:        financement.notes_financeur         || '',
      montant_total:          String(financement.montant_total    || ''),
      montant_pris_en_charge: String(financement.montant_pris_en_charge || '0'),
      notes_comptables:       financement.notes_comptables        || '',
    });
    setFormErr('');
    setShowForm(true);
  }

  async function saveForm() {
    setSaving(true); setFormErr('');
    try {
      if (!financement) {
        await api.post(`/dossiers/${dossierId}/financement`, form);
      } else {
        await api.patch(`/dossiers/${dossierId}/financement`, form);
      }
      setShowForm(false);
      load();
    } catch (e) {
      setFormErr(e.response?.data?.message || 'Erreur enregistrement');
    } finally { setSaving(false); }
  }

  async function validerBloc() {
    if (!window.confirm('Valider le bloc financier ? Le statut sera initialisé à "À facturer".')) return;
    try {
      await api.post(`/dossiers/${dossierId}/financement/valider`);
      load();
    } catch (e) { alert(e.response?.data?.message || 'Erreur validation'); }
  }

  function openStatut() {
    const transitions = TRANSITIONS[financement?.statut_facturation] || [];
    setStatutForm({ nouveau_statut: transitions[0] || '', date_effective: new Date().toISOString().split('T')[0], commentaire: '', montant_avoir: '', motif_avoir: '' });
    setStatutErr('');
    setShowStatut(true);
  }

  async function saveStatut() {
    setSavingStatut(true); setStatutErr('');
    try {
      await api.post(`/dossiers/${dossierId}/financement/statut`, statutForm);
      setShowStatut(false);
      load();
    } catch (e) {
      setStatutErr(e.response?.data?.message || 'Erreur changement de statut');
    } finally { setSavingStatut(false); }
  }

  const reste = financement
    ? (parseFloat(financement.montant_total || 0) - parseFloat(financement.montant_pris_en_charge || 0))
    : null;

  if (loading) return <div className="loading-state">Chargement financement…</div>;
  if (err)     return <div className="empty-state" style={{ color: 'var(--red)' }}>{err}</div>;

  return (
    <div style={{ padding: '0 0 24px' }}>

      {/* ── Pas de financement créé ── */}
      {!financement && canWrite && (
        <div className="empty-state">
          <p>Aucun financement saisi pour ce dossier.</p>
          <button className="btn btn-primary" onClick={openCreate}>Saisir le financement</button>
        </div>
      )}
      {!financement && !canWrite && (
        <div className="empty-state">Aucun financement saisi.</div>
      )}

      {/* ── Financement existant ── */}
      {financement && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Bloc Identifiant Financeur */}
          <section className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ margin: 0 }}>Identifiant Financeur</h4>
              {canWrite && (
                financement.validated_at && !isAdmin
                  ? <span className="badge" style={{ background: '#f3f4f6', color: '#6b7280' }}>Verrouillé</span>
                  : <button className="btn btn-sm btn-secondary" onClick={openEdit}>Modifier</button>
              )}
            </div>
            <dl className="detail-grid" style={{ margin: 0 }}>
              <dt>Type</dt><dd><strong>{TYPE_LABELS[financement.type_financement] || financement.type_financement}</strong></dd>
              {financement.type_financement !== 'PERSONNEL' && (
                <><dt>Identifiant financeur</dt><dd>{financement.identifiant_financeur || '—'}</dd></>
              )}
              {financement.type_financement === 'OPCO' && (
                <><dt>Organisme</dt><dd>{financement.nom_organisme || '—'}</dd></>
              )}
              {financement.date_accord && <><dt>Date accord</dt><dd>{fmtDate(financement.date_accord)}</dd></>}
              {financement.validated_at && (
                <><dt>Validé le</dt><dd>{fmtDate(financement.validated_at)} {financement.validated_by_nom && `par ${financement.validated_by_nom}`}</dd></>
              )}
            </dl>
            {isAdmin && !financement.validated_at && (
              <div style={{ marginTop: 12 }}>
                <button className="btn btn-primary btn-sm" onClick={validerBloc}>Valider le financement</button>
              </div>
            )}
          </section>

          {/* Bloc Montants */}
          <section className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ margin: 0 }}>Montants & Facturation</h4>
              {financement.statut_facturation && TRANSITIONS[financement.statut_facturation]?.length > 0 && canWrite && (
                <button className="btn btn-sm btn-secondary" onClick={openStatut}>Mettre à jour le statut</button>
              )}
            </div>

            {financement.statut_facturation && (
              <div style={{ marginBottom: 12 }}>
                <span
                  className="badge"
                  style={{ background: STATUT_COLORS[financement.statut_facturation] + '22', color: STATUT_COLORS[financement.statut_facturation], fontWeight: 600, padding: '4px 10px' }}
                >
                  {STATUT_LABELS[financement.statut_facturation] || financement.statut_facturation}
                </span>
                {!financement.validated_at && (
                  <span style={{ marginLeft: 8, color: '#9ca3af', fontSize: '0.85em' }}>Bloc non encore validé</span>
                )}
              </div>
            )}

            <dl className="detail-grid" style={{ margin: 0 }}>
              <dt>Montant total</dt><dd><strong>{fmtCurrency(financement.montant_total)}</strong></dd>
              {financement.type_financement !== 'PERSONNEL' && (
                <><dt>Pris en charge</dt><dd>{fmtCurrency(financement.montant_pris_en_charge)}</dd></>
              )}
              {reste !== null && reste > 0 && financement.type_financement !== 'PERSONNEL' && (
                <><dt>Reste à charge</dt><dd><span className="badge badge-orange">{fmtCurrency(reste)}</span></dd></>
              )}
              {financement.date_facturation && <><dt>Date facturation</dt><dd>{fmtDate(financement.date_facturation)}</dd></>}
              {financement.reference_facture && <><dt>Réf. facture</dt><dd>{financement.reference_facture}</dd></>}
              {financement.date_paiement && <><dt>Date paiement</dt><dd>{fmtDate(financement.date_paiement)}</dd></>}
              {financement.statut_facturation === 'rembourse' && (
                <>
                  <dt>Avoir</dt><dd>{fmtCurrency(financement.montant_avoir)}</dd>
                  <dt>Motif avoir</dt><dd>{financement.motif_avoir}</dd>
                </>
              )}
            </dl>
          </section>

        </div>
      )}

      {/* ── Modal Création / Édition ── */}
      <Modal
        open={showForm}
        title={financement ? 'Modifier le financement' : 'Saisir le financement'}
        onClose={() => setShowForm(false)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {formErr && <div className="alert alert-error">{formErr}</div>}

          <label>Type de financement *
            <select value={form.type_financement} onChange={(e) => setForm(f => ({ ...f, type_financement: e.target.value, identifiant_financeur: '' }))}>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>

          {form.type_financement !== 'PERSONNEL' && (
            <label>Identifiant financeur {form.type_financement === 'CPF' ? '(EDOF, 6–50 car.)' : ''}
              <input type="text" value={form.identifiant_financeur} onChange={(e) => setForm(f => ({ ...f, identifiant_financeur: e.target.value }))} maxLength={50} />
            </label>
          )}

          {form.type_financement === 'OPCO' && (
            <label>Nom de l'organisme (OPCO) *
              <input type="text" value={form.nom_organisme} onChange={(e) => setForm(f => ({ ...f, nom_organisme: e.target.value }))} maxLength={100} />
            </label>
          )}

          <label>Date d'accord de financement
            <input type="date" value={form.date_accord} onChange={(e) => setForm(f => ({ ...f, date_accord: e.target.value }))} />
          </label>

          <label>Montant total (€) *
            <input type="number" min="0.01" step="0.01" value={form.montant_total} onChange={(e) => setForm(f => ({ ...f, montant_total: e.target.value }))} />
          </label>

          {form.type_financement !== 'PERSONNEL' && (
            <label>Montant pris en charge (€)
              <input type="number" min="0" step="0.01" value={form.montant_pris_en_charge} onChange={(e) => setForm(f => ({ ...f, montant_pris_en_charge: e.target.value }))} />
            </label>
          )}

          {form.montant_total && form.montant_pris_en_charge && (
            <div style={{ color: '#6b7280', fontSize: '0.9em' }}>
              Reste à charge : {fmtCurrency(Math.max(0, parseFloat(form.montant_total) - parseFloat(form.montant_pris_en_charge)))}
            </div>
          )}

          <label>Notes financeur
            <textarea rows={2} value={form.notes_financeur} onChange={(e) => setForm(f => ({ ...f, notes_financeur: e.target.value }))} maxLength={500} />
          </label>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)} disabled={saving}>Annuler</button>
            <button className="btn btn-primary" onClick={saveForm} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Changement de statut ── */}
      <Modal
        open={showStatut}
        title="Mettre à jour le statut de facturation"
        onClose={() => setShowStatut(false)}
      >
        {financement && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {statutErr && <div className="alert alert-error">{statutErr}</div>}

            <div>
              Statut actuel : <span className="badge" style={{ background: STATUT_COLORS[financement.statut_facturation] + '22', color: STATUT_COLORS[financement.statut_facturation] }}>
                {STATUT_LABELS[financement.statut_facturation]}
              </span>
            </div>

            <label>Nouveau statut *
              <select value={statutForm.nouveau_statut} onChange={(e) => setStatutForm(f => ({ ...f, nouveau_statut: e.target.value }))}>
                {(TRANSITIONS[financement.statut_facturation] || []).map(s => (
                  <option key={s} value={s}>{STATUT_LABELS[s]}</option>
                ))}
              </select>
            </label>

            <label>Date effective
              <input type="date" value={statutForm.date_effective} onChange={(e) => setStatutForm(f => ({ ...f, date_effective: e.target.value }))} />
            </label>

            {statutForm.nouveau_statut === 'rembourse' && (
              <>
                <label>Montant de l'avoir (€) *
                  <input type="number" min="0.01" step="0.01" value={statutForm.montant_avoir} onChange={(e) => setStatutForm(f => ({ ...f, montant_avoir: e.target.value }))} />
                </label>
                <label>Motif de l'avoir *
                  <textarea rows={2} value={statutForm.motif_avoir} onChange={(e) => setStatutForm(f => ({ ...f, motif_avoir: e.target.value }))} maxLength={500} />
                </label>
              </>
            )}

            {['litige', 'annule'].includes(statutForm.nouveau_statut) && (
              <label>Commentaire *
                <textarea rows={2} value={statutForm.commentaire} onChange={(e) => setStatutForm(f => ({ ...f, commentaire: e.target.value }))} />
              </label>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-secondary" onClick={() => setShowStatut(false)} disabled={savingStatut}>Annuler</button>
              <button className="btn btn-primary" onClick={saveStatut} disabled={savingStatut}>{savingStatut ? 'Enregistrement…' : 'Confirmer'}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
