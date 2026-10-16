import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  History,
  Plus,
  Sparkles,
  User,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { StaffLayout } from '../../components/layout/StaffLayout.jsx';
import Button from '../../components/ui/Button.jsx';
import CaseIcon from '../../components/ui/CaseIcon.jsx';
import FileTabHeading from '../../components/ui/FileTabHeading.jsx';
import InternalPanel from '../../components/ui/InternalPanel.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { EmptyState, ErrorState } from '../../components/ui/States.jsx';
import StatusStamp from '../../components/ui/StatusStamp.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import { useAuth } from '../../context/useAuth.js';
import { useToast } from '../../context/useToast.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import {
  addCaseNote,
  assignCaseOfficer,
  closeCase,
  getCaseDetail,
  listOfficers,
} from '../../services/staffService.js';
import './StaffCaseDetailPage.css';

export default function StaffCaseDetailPage() {
  const { caseId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const [caseItem, setCaseItem] = useState(null);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Close case modal state
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closeNote, setCloseNote] = useState('');
  const [closeNoteError, setCloseNoteError] = useState('');

  // Assign officer state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedOfficerId, setSelectedOfficerId] = useState('');

  // Internal note form state
  const [newNote, setNewNote] = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  useDocumentTitle(caseItem ? `Case ${caseItem.caseNumber}` : 'Case Dossier');

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const [caseData, officersData] = await Promise.all([
          getCaseDetail(caseId),
          listOfficers().catch(() => ({ items: [] })),
        ]);
        if (!ignore) {
          setCaseItem(caseData);
          setOfficers(officersData.items);
          setSelectedOfficerId(caseData.assignedOfficer?.officerId || '');
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Could not load case dossier.');
          setLoading(false);
        }
      }
    }
    loadData();
    return () => {
      ignore = true;
    };
  }, [caseId]);

  // Handle closing case with required note
  const handleConfirmClose = async () => {
    if (!closeNote.trim()) {
      setCloseNoteError('A case closure justification note is required.');
      return;
    }
    setActionLoading(true);
    try {
      const updated = await closeCase(caseItem.caseId, closeNote.trim());
      setCaseItem((prev) => ({
        ...prev,
        caseStatus: 'closed',
        updates: updated.updates,
      }));
      setCloseModalOpen(false);
      toast({ message: `Case ${caseItem.caseNumber} has been closed.`, type: 'info' });
    } catch (err) {
      toast({
        message: err instanceof Error ? err.message : 'Failed to close case.',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle officer assignment
  const handleConfirmAssign = async () => {
    if (!selectedOfficerId) return;
    setActionLoading(true);
    try {
      const updated = await assignCaseOfficer(caseItem.caseId, selectedOfficerId);
      const officer = officers.find((o) => o.officerId === selectedOfficerId);
      setCaseItem((prev) => ({
        ...prev,
        assignedOfficer: updated.assignedOfficer,
        updates: updated.updates,
      }));
      setAssignModalOpen(false);
      toast({
        message: `Case reassigned to ${officer?.name || 'officer'}.`,
        type: 'success',
      });
    } catch (err) {
      toast({
        message: err instanceof Error ? err.message : 'Failed to assign officer.',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle adding internal note
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setNoteSubmitting(true);
    try {
      const updated = await addCaseNote(caseItem.caseId, newNote.trim());
      setCaseItem((prev) => ({
        ...prev,
        internalNotes: updated.internalNotes,
      }));
      setNewNote('');
      toast({ message: 'Internal note saved to case dossier.', type: 'success' });
    } catch (err) {
      toast({
        message: err instanceof Error ? err.message : 'Failed to save note.',
        type: 'error',
      });
    } finally {
      setNoteSubmitting(false);
    }
  };

  if (loading) {
    return (
      <StaffLayout>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-12)' }}>
          <Spinner size={32} label="Loading case dossier..." />
        </div>
      </StaffLayout>
    );
  }

  if (error || !caseItem) {
    return (
      <StaffLayout>
        <div className="staff-case-detail-page">
          <Link to="/staff/cases" className="case-detail-back">
            <ArrowLeft size={16} /> Back to Cases
          </Link>
          <ErrorState
            title="Case Dossier Not Found"
            description="The requested case record does not exist or access is restricted."
            error={error}
          />
        </div>
      </StaffLayout>
    );
  }

  // Officer assignment permissions: admins and the currently assigned officer
  const canAssignOfficer =
    user?.role === 'admin' ||
    user?.officerId === caseItem.assignedOfficer?.officerId;

  // Overview Tab Panel
  const overviewPanel = (
    <div className="case-tab-pane">
      <div className="facts-grid">
        <div className="fact-item">
          <span className="fact-item__label">Subject Name</span>
          <span className="fact-item__value">{caseItem.personName || 'Unidentified individual'}</span>
        </div>
        <div className="fact-item">
          <span className="fact-item__label">Age</span>
          <span className="fact-item__value">
            {caseItem.age ? `${caseItem.age} years` : caseItem.estimatedAge ? `Est. ${caseItem.estimatedAge}` : 'Unknown'}
          </span>
        </div>
        <div className="fact-item">
          <span className="fact-item__label">Gender</span>
          <span className="fact-item__value" style={{ textTransform: 'capitalize' }}>
            {caseItem.gender || 'Unknown'}
          </span>
        </div>
        <div className="fact-item">
          <span className="fact-item__label">Height</span>
          <span className="fact-item__value">
            {caseItem.heightCm ? `${caseItem.heightCm} cm` : 'Not recorded'}
          </span>
        </div>
        <div className="fact-item">
          <span className="fact-item__label">Incident Date</span>
          <span className="fact-item__value" style={{ fontFamily: 'var(--font-mono)' }}>
            {caseItem.date}
          </span>
        </div>
        <div className="fact-item">
          <span className="fact-item__label">Location</span>
          <span className="fact-item__value">
            {caseItem.city ? `${caseItem.city}, ${caseItem.district || caseItem.state}` : '-'}
          </span>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 'var(--sp-2)' }}>
          Detailed Case Circumstances
        </h3>
        <div className="case-narrative-box">
          {caseItem.description || caseItem.shortDescription || 'No detailed narrative recorded.'}
        </div>
      </div>

      {(caseItem.physicalFeatures || caseItem.identifyingMarks) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--sp-4)' }}>
          {caseItem.physicalFeatures && (
            <div className="fact-item">
              <span className="fact-item__label">Physical Features</span>
              <span className="fact-item__value">{caseItem.physicalFeatures}</span>
            </div>
          )}
          {caseItem.identifyingMarks && (
            <div className="fact-item">
              <span className="fact-item__label">Identifying Marks</span>
              <span className="fact-item__value">{caseItem.identifyingMarks}</span>
            </div>
          )}
        </div>
      )}

      {/* Public Updates Timeline */}
      <div>
        <FileTabHeading as="h4" icon={<History size={16} />}>
          Public Updates Timeline
        </FileTabHeading>
        <div className="history-timeline" style={{ marginTop: 'var(--sp-3)' }}>
          {(caseItem.updates || []).map((u, i) => (
            <div key={i} className="history-item">
              <span className="history-item__dot" />
              <span className="history-item__event">{u.note}</span>
              <span className="history-item__date">{u.date}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Matches Tab Panel
  const matchesPanel = (
    <div className="case-tab-pane">
      <FileTabHeading as="h3" icon={<Sparkles size={16} />}>
        Potential Candidate Matches ({caseItem.matches?.length || 0})
      </FileTabHeading>

      {!caseItem.matches || caseItem.matches.length === 0 ? (
        <EmptyState
          title="No Potential Matches"
          description="There are currently no biometric or feature matches linked with this case."
          icon={<Sparkles size={40} />}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {caseItem.matches.map((m) => (
            <div
              key={m.matchId}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--sp-4)',
                background: 'var(--surface-2)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-md)',
                flexWrap: 'wrap',
                gap: 'var(--sp-3)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)' }}>
                    {m.matchId}
                  </span>
                  <StatusStamp kind="match" status={m.status} />
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-xs)',
                      background: 'var(--accent-subtle)',
                      color: 'var(--accent)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 700,
                    }}
                  >
                    {Math.round(m.similarityScore * 100)}% match
                  </span>
                </div>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)' }}>
                  Missing: {m.missing?.personName || m.missing?.caseNumber} ↔ Found: {m.found?.caseNumber} ({m.found?.city})
                </span>
              </div>
              <Button as={Link} to={`/staff/matches/${m.matchId}`} size="sm" variant="solid">
                Review Match
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Verification History Tab Panel
  const verifications = (caseItem.matches || []).flatMap((m) =>
    (m.verifications || []).map((v) => ({ ...v, matchId: m.matchId }))
  );

  const verificationPanel = (
    <div className="case-tab-pane">
      <FileTabHeading as="h3" icon={<History size={16} />}>
        Formal Match Verifications
      </FileTabHeading>

      {verifications.length === 0 ? (
        <EmptyState
          title="No Verifications Recorded"
          description="No formal match verification decisions have been submitted for this case."
          icon={<History size={40} />}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {verifications.map((v, i) => (
            <div
              key={i}
              style={{
                padding: 'var(--sp-4)',
                background: 'var(--surface-2)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserCheck size={16} style={{ color: 'var(--accent)' }} />
                  <strong style={{ fontSize: 'var(--text-sm)' }}>{v.officerName}</strong>
                  <StatusStamp kind="match" status={v.decision} />
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                  {new Date(v.verificationDate).toLocaleString()}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--ink)' }}>
                {v.remarks}
              </p>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                Record: {v.matchId}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Internal Notes Tab Panel (InternalPanel)
  const internalNotesPanel = (
    <div className="case-tab-pane">
      <InternalPanel>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
              Case Internal Notes
            </h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', margin: 0 }}>
              Classified remarks for authorized officers and administrators only.
            </p>
          </div>
        </div>

        {/* Notes List */}
        <div className="internal-notes-list">
          {(caseItem.internalNotes || []).map((n) => (
            <div key={n.id} className="internal-note-item">
              <div className="internal-note-item__header">
                <strong>{n.author}</strong>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  {new Date(n.date).toLocaleString()}
                </span>
              </div>
              <div className="internal-note-item__body">{n.note}</div>
            </div>
          ))}
        </div>

        {/* Add Note Form */}
        <form onSubmit={handleAddNote} className="add-note-form">
          <label htmlFor="new-internal-note" style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--ink)' }}>
            Add Internal Note
          </label>
          <textarea
            id="new-internal-note"
            rows={3}
            placeholder="Document investigative progress, witness contact, or cross-jurisdiction findings..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="modal-textarea"
            style={{ fontSize: 'var(--text-sm)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--sp-2)' }}>
            <Button type="submit" size="sm" variant="solid" loading={noteSubmitting} disabled={!newNote.trim()}>
              <Plus size={14} style={{ marginRight: '4px' }} />
              Add Note
            </Button>
          </div>
        </form>
      </InternalPanel>
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'Overview', panel: overviewPanel },
    { id: 'matches', label: `Matches (${caseItem.matches?.length || 0})`, panel: matchesPanel },
    { id: 'verifications', label: `Verifications (${verifications.length})`, panel: verificationPanel },
    { id: 'internal', label: 'Internal Notes', panel: internalNotesPanel },
  ];

  return (
    <StaffLayout>
      <div className="staff-case-detail-page">
        <Link to="/staff/cases" className="case-detail-back">
          <ArrowLeft size={16} /> Back to Cases List
        </Link>

        <div className="case-dossier-card">
          <header className="case-dossier-header">
            <div className="case-dossier-header__left">
              <div className="case-dossier-header__meta">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CaseIcon crimeType={caseItem.crimeType} size={18} />
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-xs)',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      color: caseItem.kind === 'missing' ? 'var(--accent)' : 'var(--success)',
                    }}
                  >
                    {caseItem.kind}
                  </span>
                </div>
                <StatusStamp kind="case" status={caseItem.caseStatus} />
              </div>
              <h1 className="case-dossier-title">{caseItem.caseNumber}</h1>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span><strong>Title:</strong> {caseItem.title}</span>
                <span>•</span>
                <span><strong>Assigned Officer:</strong> {caseItem.assignedOfficer?.name || 'Unassigned'}</span>
              </div>
            </div>

            <div className="case-dossier-actions">
              {canAssignOfficer && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAssignModalOpen(true)}
                  disabled={caseItem.caseStatus === 'closed'}
                >
                  <User size={15} style={{ marginRight: '6px' }} />
                  Assign Officer
                </Button>
              )}

              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  setCloseNote('');
                  setCloseNoteError('');
                  setCloseModalOpen(true);
                }}
                disabled={caseItem.caseStatus === 'closed'}
              >
                <XCircle size={15} style={{ marginRight: '6px' }} />
                {caseItem.caseStatus === 'closed' ? 'Case Closed' : 'Close Case'}
              </Button>
            </div>
          </header>

          {/* Dossier Tabs */}
          <Tabs tabs={tabs} defaultTab="overview" />
        </div>

        {/* Modal: Close Case (destructive, requires justification note) */}
        <Modal
          open={closeModalOpen}
          onClose={() => setCloseModalOpen(false)}
          title="Close Case File"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--sp-2)' }}>
              <Button variant="outline" onClick={() => setCloseModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleConfirmClose} loading={actionLoading}>
                Confirm Close Case
              </Button>
            </div>
          }
        >
          <div className="modal-form">
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)', margin: 0 }}>
              Closing this case marks it inactive. A documented rationale is required for the permanent public and administrative record.
            </p>
            <div>
              <label
                htmlFor="close-note"
                style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--ink)', marginBottom: 'var(--sp-1)' }}
              >
                Closure Note / Resolution Reason <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <textarea
                id="close-note"
                rows={4}
                value={closeNote}
                onChange={(e) => {
                  setCloseNote(e.target.value);
                  if (closeNoteError) setCloseNoteError('');
                }}
                placeholder="State the resolution details (e.g. person reunited with family, complaint withdrawn, or transfer of jurisdiction)..."
                className={`modal-textarea ${closeNoteError ? 'modal-textarea--error' : ''}`}
              />
              {closeNoteError && <p className="modal-error-text">{closeNoteError}</p>}
            </div>
          </div>
        </Modal>

        {/* Modal: Assign Officer */}
        <Modal
          open={assignModalOpen}
          onClose={() => setAssignModalOpen(false)}
          title="Assign Case Officer"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--sp-2)' }}>
              <Button variant="outline" onClick={() => setAssignModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="solid" onClick={handleConfirmAssign} loading={actionLoading}>
                Save Assignment
              </Button>
            </div>
          }
        >
          <div className="modal-form">
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)', margin: 0 }}>
              Select the designated lead officer responsible for this active dossier.
            </p>
            <div>
              <label
                htmlFor="assign-case-officer"
                style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--ink)', marginBottom: 'var(--sp-1)' }}
              >
                Lead Officer
              </label>
              <select
                id="assign-case-officer"
                value={selectedOfficerId}
                onChange={(e) => setSelectedOfficerId(e.target.value)}
                className="filter-select"
                style={{ width: '100%' }}
              >
                <option value="">Select an officer...</option>
                {officers.map((o) => (
                  <option key={o.officerId} value={o.officerId}>
                    {o.name} ({o.badge} - {o.district})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Modal>
      </div>
    </StaffLayout>
  );
}
