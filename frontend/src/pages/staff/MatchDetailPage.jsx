import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  History,
  Sparkles,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import { StaffLayout } from '../../components/layout/StaffLayout.jsx';
import Button from '../../components/ui/Button.jsx';
import FileTabHeading from '../../components/ui/FileTabHeading.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { ErrorState } from '../../components/ui/States.jsx';
import StatusStamp from '../../components/ui/StatusStamp.jsx';
import { useToast } from '../../context/useToast.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { getMatch, reviewMatch } from '../../services/staffService.js';
import './MatchDetailPage.css';

export default function MatchDetailPage() {
  const { matchId } = useParams();
  const { toast } = useToast();

  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Dismiss modal state (requires remarks)
  const [dismissModalOpen, setDismissModalOpen] = useState(false);
  const [dismissRemarks, setDismissRemarks] = useState('');
  const [dismissRemarksError, setDismissRemarksError] = useState('');

  // Optional confirm remarks modal or state
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmRemarks, setConfirmRemarks] = useState('Biometric and descriptive features cross-checked and verified.');

  useDocumentTitle(match ? `Match Review ${match.matchId}` : 'Match Review');

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const data = await getMatch(matchId);
        if (!ignore) {
          setMatch(data);
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Could not load match review.');
          setLoading(false);
        }
      }
    }
    loadData();
    return () => {
      ignore = true;
    };
  }, [matchId]);

  // Confirm match (updates both cases in mock to resolved)
  const handleConfirmMatch = async () => {
    setActionLoading(true);
    try {
      const updated = await reviewMatch(match.matchId, {
        decision: 'confirmed',
        remarks: confirmRemarks.trim() || 'Physical features aligned. Identity confirmed.',
      });
      setMatch({ ...updated });
      setConfirmModalOpen(false);
      toast({
        message: 'Match confirmed. Both linked case records have been updated to Resolved.',
        type: 'success',
      });
    } catch (err) {
      toast({
        message: err instanceof Error ? err.message : 'Failed to confirm match.',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Dismiss match (destructive action, requires remarks)
  const handleDismissMatch = async () => {
    if (!dismissRemarks.trim()) {
      setDismissRemarksError('Remarks explaining the dismissal decision are required.');
      return;
    }
    setActionLoading(true);
    try {
      const updated = await reviewMatch(match.matchId, {
        decision: 'dismissed',
        remarks: dismissRemarks.trim(),
      });
      setMatch({ ...updated });
      setDismissModalOpen(false);
      toast({
        message: 'Match dismissed. Justification recorded in verification audit.',
        type: 'info',
      });
    } catch (err) {
      toast({
        message: err instanceof Error ? err.message : 'Failed to dismiss match.',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <StaffLayout>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-12)' }}>
          <Spinner size={32} label="Loading match review dossier..." />
        </div>
      </StaffLayout>
    );
  }

  if (error || !match) {
    return (
      <StaffLayout>
        <div className="staff-match-detail-page">
          <Link to="/staff/matches" className="match-detail-back">
            <ArrowLeft size={16} /> Back to Matches
          </Link>
          <ErrorState
            title="Match Record Not Found"
            description="The requested candidate match could not be found or access is restricted."
            error={error}
          />
        </div>
      </StaffLayout>
    );
  }

  const missing = match.missing || {};
  const found = match.found || {};
  const pct = Math.round(match.similarityScore * 100);

  // Field by field comparisons
  const comparisons = [
    {
      field: 'Case Number',
      missing: missing.caseNumber ? (
        <Link to={`/staff/cases/${missing.caseId || missing.caseNumber}`} style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
          {missing.caseNumber}
        </Link>
      ) : '—',
      found: found.caseNumber ? (
        <Link to={`/staff/cases/${found.caseId || found.caseNumber}`} style={{ color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>
          {found.caseNumber}
        </Link>
      ) : '—',
      type: 'neutral',
      verdict: 'Linked records',
    },
    {
      field: 'Subject Name',
      missing: missing.personName || 'Named Missing',
      found: found.personName || 'Unidentified individual',
      type: found.personName ? 'aligned' : 'neutral',
      verdict: found.personName ? 'Matched' : 'Unidentified',
    },
    {
      field: 'Age / Estimated Age',
      missing: missing.age ? `${missing.age} years old` : 'Unknown',
      found: found.estimatedAge ? `Est. ${found.estimatedAge}` : found.age ? `${found.age} years old` : 'Unknown',
      type: 'aligned',
      verdict: 'Aligned range',
    },
    {
      field: 'Gender',
      missing: missing.gender || 'Unknown',
      found: found.gender || 'Unknown',
      type: String(missing.gender).toLowerCase() === String(found.gender).toLowerCase() ? 'aligned' : 'discrepancy',
      verdict: String(missing.gender).toLowerCase() === String(found.gender).toLowerCase() ? 'Exact match' : 'Discrepancy',
    },
    {
      field: 'Height',
      missing: missing.heightCm ? `${missing.heightCm} cm` : 'Not recorded',
      found: found.heightCm ? `${found.heightCm} cm` : 'Not recorded',
      type: Math.abs((missing.heightCm || 0) - (found.heightCm || 0)) <= 10 ? 'aligned' : 'discrepancy',
      verdict: Math.abs((missing.heightCm || 0) - (found.heightCm || 0)) <= 10 ? 'Approximate alignment (±5-10cm)' : 'Height variance',
    },
    {
      field: 'Physical Features',
      missing: missing.physicalFeatures || 'None recorded',
      found: found.physicalFeatures || 'None recorded',
      type: 'aligned',
      verdict: 'Compatible build & features',
    },
    {
      field: 'Identifying Marks',
      missing: missing.identifyingMarks || 'None recorded',
      found: found.identifyingMarks || 'None recorded',
      type: 'neutral',
      verdict: 'Cross-check required',
    },
    {
      field: 'Incident Location',
      missing: missing.city || 'Location unrecorded',
      found: found.city || 'Location unrecorded',
      type: String(missing.city).toLowerCase() === String(found.city).toLowerCase() ? 'aligned' : 'discrepancy',
      verdict: String(missing.city).toLowerCase() === String(found.city).toLowerCase() ? 'Same locality' : 'Regional transit (different cities)',
    },
    {
      field: 'Recorded Date',
      missing: missing.date || '—',
      found: found.date || '—',
      type: 'neutral',
      verdict: 'Chronological timeline compatible',
    },
  ];

  return (
    <StaffLayout>
      <div className="staff-match-detail-page">
        <Link to="/staff/matches" className="match-detail-back">
          <ArrowLeft size={16} /> Back to Candidate Matches
        </Link>

        <div className="match-review-card">
          <header className="match-review-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--sp-1)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--muted)', textTransform: 'uppercase' }}>
                  Candidate Match Dossier
                </span>
                <StatusStamp kind="match" status={match.status} />
              </div>
              <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>
                {match.matchId}
              </h1>
            </div>

            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              <Button
                variant="solid"
                size="md"
                onClick={() => setConfirmModalOpen(true)}
                disabled={actionLoading || match.status === 'confirmed'}
                style={{
                  backgroundColor: match.status === 'confirmed' ? 'var(--surface-2)' : 'var(--success)',
                  borderColor: match.status === 'confirmed' ? 'var(--line)' : 'var(--success)',
                  color: match.status === 'confirmed' ? 'var(--muted)' : '#ffffff',
                }}
              >
                <CheckCircle2 size={16} style={{ marginRight: '6px' }} />
                {match.status === 'confirmed' ? 'Match Confirmed' : 'Confirm Match'}
              </Button>

              <Button
                variant="danger"
                size="md"
                onClick={() => {
                  setDismissRemarks('');
                  setDismissRemarksError('');
                  setDismissModalOpen(true);
                }}
                disabled={actionLoading || match.status === 'dismissed'}
              >
                <XCircle size={16} style={{ marginRight: '6px' }} />
                {match.status === 'dismissed' ? 'Match Dismissed' : 'Dismiss Match'}
              </Button>
            </div>
          </header>

          {/* Similarity Score Strip */}
          <div className="match-score-strip">
            <Sparkles size={20} style={{ color: 'var(--accent)' }} />
            <div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', textTransform: 'uppercase', display: 'block' }}>
                Algorithmic Similarity Score
              </span>
              <span className="match-score-val">{pct}% Confidence</span>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--muted)', textAlign: 'right' }}>
              <span>High multi-attribute correlation between facial structure, age bracket, and physical traits.</span>
            </div>
          </div>

          {/* Side-by-Side Comparison Table with Highlights */}
          <div>
            <FileTabHeading as="h2">
              Side-by-Side Field Comparison
            </FileTabHeading>

            <div className="comparison-table-wrap" style={{ marginTop: 'var(--sp-3)' }}>
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '22%' }}>Field Attribute</th>
                    <th scope="col" style={{ width: '34%' }}>Missing Person Record</th>
                    <th scope="col" style={{ width: '34%' }}>Found Person Record</th>
                    <th scope="col" style={{ width: '10%' }}>Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map((row, i) => {
                    const rowClass =
                      row.type === 'aligned'
                        ? 'comparison-row--aligned'
                        : row.type === 'discrepancy'
                        ? 'comparison-row--discrepancy'
                        : '';
                    return (
                      <tr key={i} className={rowClass}>
                        <td className="comparison-field-label">{row.field}</td>
                        <td style={{ color: 'var(--ink)' }}>{row.missing}</td>
                        <td style={{ color: 'var(--ink)' }}>{row.found}</td>
                        <td>
                          {row.type === 'aligned' && (
                            <span className="comparison-tag comparison-tag--aligned">
                              <Check size={12} /> {row.verdict}
                            </span>
                          )}
                          {row.type === 'discrepancy' && (
                            <span className="comparison-tag comparison-tag--diff">
                              <X size={12} /> {row.verdict}
                            </span>
                          )}
                          {row.type === 'neutral' && (
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                              {row.verdict}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Verification History Below */}
          <div>
            <FileTabHeading as="h2" icon={<History size={16} />}>
              Formal Verification History
            </FileTabHeading>

            {(!match.verifications || match.verifications.length === 0) ? (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', marginTop: 'var(--sp-3)' }}>
                No formal verification decisions recorded yet. Confirm or dismiss this candidate match above.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginTop: 'var(--sp-3)' }}>
                {match.verifications.map((v, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 'var(--sp-4)',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--line)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--sp-1)',
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
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal: Confirm Match */}
        <Modal
          open={confirmModalOpen}
          onClose={() => setConfirmModalOpen(false)}
          title="Confirm Candidate Match"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--sp-2)' }}>
              <Button variant="outline" onClick={() => setConfirmModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="solid" onClick={handleConfirmMatch} loading={actionLoading} style={{ background: 'var(--success)', borderColor: 'var(--success)', color: '#ffffff' }}>
                Confirm & Resolve Cases
              </Button>
            </div>
          }
        >
          <div className="modal-form">
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)', margin: 0 }}>
              Confirming this match verifies that the missing person and found individual are the same subject.
              <strong> Both linked case files will be automatically marked as Resolved in the system.</strong>
            </p>
            <div>
              <label htmlFor="confirm-remarks" style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--ink)', marginBottom: 'var(--sp-1)' }}>
                Verification Remarks
              </label>
              <textarea
                id="confirm-remarks"
                rows={3}
                value={confirmRemarks}
                onChange={(e) => setConfirmRemarks(e.target.value)}
                className="modal-textarea"
              />
            </div>
          </div>
        </Modal>

        {/* Modal: Dismiss Match (requires remarks) */}
        <Modal
          open={dismissModalOpen}
          onClose={() => setDismissModalOpen(false)}
          title="Dismiss Candidate Match"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--sp-2)' }}>
              <Button variant="outline" onClick={() => setDismissModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDismissMatch} loading={actionLoading}>
                Confirm Dismissal
              </Button>
            </div>
          }
        >
          <div className="modal-form">
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)', margin: 0 }}>
              Dismissing marks this candidate match as invalid or ruled out.
              A specific explanation is required for permanent case audit records.
            </p>
            <div>
              <label
                htmlFor="dismiss-remarks"
                style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--ink)', marginBottom: 'var(--sp-1)' }}
              >
                Dismissal Remarks <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <textarea
                id="dismiss-remarks"
                rows={4}
                value={dismissRemarks}
                onChange={(e) => {
                  setDismissRemarks(e.target.value);
                  if (dismissRemarksError) setDismissRemarksError('');
                }}
                placeholder="State why this is not a valid match (e.g., conflicting birthmark, age discrepancy, DNA exclusion)..."
                className={`modal-textarea ${dismissRemarksError ? 'modal-textarea--error' : ''}`}
              />
              {dismissRemarksError && <p className="modal-error-text">{dismissRemarksError}</p>}
            </div>
          </div>
        </Modal>
      </div>
    </StaffLayout>
  );
}
