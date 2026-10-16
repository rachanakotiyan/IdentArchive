import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  History,
  MapPin,
  Send,
  User,
} from 'lucide-react';
import { StaffLayout } from '../../components/layout/StaffLayout.jsx';
import Button from '../../components/ui/Button.jsx';
import FileTabHeading from '../../components/ui/FileTabHeading.jsx';
import InternalPanel from '../../components/ui/InternalPanel.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { ErrorState } from '../../components/ui/States.jsx';
import StatusStamp from '../../components/ui/StatusStamp.jsx';
import { useToast } from '../../context/useToast.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import {
  assignOfficer,
  decideReport,
  getReport,
  listOfficers,
  setPriority,
} from '../../services/staffService.js';
import './StaffReportDetailPage.css';

export default function StaffReportDetailPage() {
  const { reportId } = useParams();
  const { toast } = useToast();

  const [report, setReport] = useState(null);
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Modal states
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectReasonError, setRejectReasonError] = useState('');

  const [requestInfoModalOpen, setRequestInfoModalOpen] = useState(false);
  const [requestInfoNote, setRequestInfoNote] = useState('');
  const [requestInfoNoteError, setRequestInfoNoteError] = useState('');

  // Dropdown states
  const [selectedOfficerId, setSelectedOfficerId] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useDocumentTitle(report ? `Report ${report.referenceNo}` : 'Report Detail');

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    let ignore = false;
    async function fetchDetail() {
      try {
        const [reportData, officersData] = await Promise.all([
          getReport(reportId),
          listOfficers().catch(() => ({ items: [] })),
        ]);
        if (!ignore) {
          setReport(reportData);
          setOfficers(officersData.items);
          setSelectedOfficerId(reportData.assignedOfficer?.officerId || '');
          setSelectedPriority(reportData.priority || 'normal');
          setError(null);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Could not load report details.');
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    fetchDetail();
    return () => {
      ignore = true;
    };
  }, [reloadKey, reportId]);

  // 1. Approve action (creates a case in the mock)
  const handleApprove = async () => {
    setActionLoading(true);
    try {
      const updated = await decideReport(report.reportId, { action: 'approve' });
      setReport({ ...updated });
      toast({
        message: `Report approved. Case ${updated.caseNumber || 'record'} has been opened.`,
        type: 'success',
      });
    } catch (err) {
      toast({
        message: err instanceof Error ? err.message : 'Failed to approve report.',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Reject action (modal, reason required)
  const handleOpenRejectModal = () => {
    setRejectReason('');
    setRejectReasonError('');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectReason.trim()) {
      setRejectReasonError('A reason for rejection is required.');
      return;
    }
    setActionLoading(true);
    try {
      const updated = await decideReport(report.reportId, {
        action: 'reject',
        note: rejectReason.trim(),
      });
      setReport({ ...updated });
      setRejectModalOpen(false);
      toast({
        message: 'Report rejected. The reason has been recorded.',
        type: 'info',
      });
    } catch (err) {
      toast({
        message: err instanceof Error ? err.message : 'Failed to reject report.',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Request more information (modal, note required)
  const handleOpenRequestInfoModal = () => {
    setRequestInfoNote('');
    setRequestInfoNoteError('');
    setRequestInfoModalOpen(true);
  };

  const handleConfirmRequestInfo = async () => {
    if (!requestInfoNote.trim()) {
      setRequestInfoNoteError('Please describe the additional information needed.');
      return;
    }
    setActionLoading(true);
    try {
      const updated = await decideReport(report.reportId, {
        action: 'requestInfo',
        note: requestInfoNote.trim(),
      });
      setReport({ ...updated });
      setRequestInfoModalOpen(false);
      toast({
        message: 'Information request recorded. Reporter will be notified.',
        type: 'info',
      });
    } catch (err) {
      toast({
        message: err instanceof Error ? err.message : 'Failed to request information.',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Assign officer
  const handleAssignOfficer = async () => {
    if (!selectedOfficerId) return;
    setActionLoading(true);
    try {
      const updated = await assignOfficer(report.reportId, selectedOfficerId);
      setReport({ ...updated });
      const officer = officers.find((o) => o.officerId === selectedOfficerId);
      toast({
        message: `Assigned to ${officer?.name || 'officer'}.`,
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

  // 5. Escalate / update priority
  const handleUpdatePriority = async () => {
    if (!selectedPriority || selectedPriority === report.priority) return;
    setActionLoading(true);
    try {
      const updated = await setPriority(report.reportId, selectedPriority);
      setReport({ ...updated });
      toast({
        message: `Priority escalated to ${selectedPriority.toUpperCase()}.`,
        type: 'success',
      });
    } catch (err) {
      toast({
        message: err instanceof Error ? err.message : 'Failed to update priority.',
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
          <Spinner size={32} label="Loading report dossier..." />
        </div>
      </StaffLayout>
    );
  }

  if (error || !report) {
    return (
      <StaffLayout>
        <div className="report-detail-page">
          <Link to="/staff/reports" className="report-detail-page__back">
            <ArrowLeft size={16} /> Back to Reports
          </Link>
          <ErrorState
            title="Report Not Found"
            description="The requested report record could not be loaded or access was restricted."
            error={error}
            onRetry={loadData}
          />
        </div>
      </StaffLayout>
    );
  }

  const person = report.person || {};
  const location = report.location || {};
  const reporter = report.reporter || {};
  const history = report.history || [];

  return (
    <StaffLayout>
      <div className="report-detail-page">
        <Link to="/staff/reports" className="report-detail-page__back">
          <ArrowLeft size={16} /> Back to Reports Intake
        </Link>

        <div className="report-detail-layout">
          {/* Main Column: Full Dossier Detail */}
          <div className="report-dossier">
            <div className="dossier-card">
              <header className="dossier-header">
                <div className="dossier-header__left">
                  <div className="dossier-header__badges">
                    <span className={`dossier-type-tag dossier-type-tag--${report.reportType}`}>
                      {report.reportType === 'missing' ? 'Missing Person Report' : 'Found Person Report'}
                    </span>
                    <StatusStamp kind="report" status={report.status} />
                    <StatusStamp kind="priority" status={report.priority} />
                  </div>
                  <h1 className="dossier-ref">{report.referenceNo}</h1>
                  <div className="dossier-date-meta">
                    <span>Submitted on {report.dateReported || report.createdDate?.slice(0, 10)}</span>
                    {report.assignedOfficer && (
                      <span> • Assigned to {report.assignedOfficer.name}</span>
                    )}
                  </div>
                </div>
              </header>

              {/* Case Created Banner if Approved */}
              {report.caseNumber && (
                <div className="linked-case-banner" role="status">
                  <div className="linked-case-banner__left">
                    <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
                    <span>Public Case Created:</span>
                    <span className="linked-case-banner__ref">{report.caseNumber}</span>
                  </div>
                  {report.caseId && (
                    <Link
                      to={`/cases/${report.caseId}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 'var(--text-xs)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      View Public Case <ExternalLink size={12} />
                    </Link>
                  )}
                </div>
              )}

              {/* Review Note / Reason Banner if exists */}
              {report.reviewNote && (
                <div
                  style={{
                    padding: 'var(--sp-3) var(--sp-4)',
                    background: report.status === 'rejected' ? 'var(--danger-subtle)' : 'var(--warning-subtle)',
                    border: `1px solid ${report.status === 'rejected' ? 'var(--danger)' : 'var(--warning)'}`,
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  <strong style={{ display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: 'var(--text-xs)' }}>
                    {report.status === 'rejected' ? 'Rejection Reason Recorded:' : 'Officer Review Note:'}
                  </strong>
                  <span>{report.reviewNote}</span>
                </div>
              )}

              {/* Incident Narrative / Description */}
              <div className="dossier-section">
                <h2 className="dossier-section__title">Reported Description & Circumstances</h2>
                <div className="dossier-narrative">{report.description || 'No description provided.'}</div>
              </div>

              {/* Subject Person Details */}
              <div className="dossier-section">
                <FileTabHeading as="h3" icon={<User size={16} />}>
                  Subject Information
                </FileTabHeading>
                <div className="facts-grid">
                  <div className="fact-item">
                    <span className="fact-item__label">Full Name</span>
                    <span className="fact-item__value">{person.name || 'Unidentified'}</span>
                  </div>
                  <div className="fact-item">
                    <span className="fact-item__label">Age</span>
                    <span className="fact-item__value">
                      {person.age ? `${person.age} years` : person.estimatedAge ? `Est. ${person.estimatedAge}` : 'Unknown'}
                    </span>
                  </div>
                  <div className="fact-item">
                    <span className="fact-item__label">Gender</span>
                    <span className="fact-item__value" style={{ textTransform: 'capitalize' }}>
                      {person.gender || 'Unknown'}
                    </span>
                  </div>
                  <div className="fact-item">
                    <span className="fact-item__label">Height</span>
                    <span className="fact-item__value">
                      {person.heightCm ? `${person.heightCm} cm` : 'Not specified'}
                    </span>
                  </div>
                  <div className="fact-item">
                    <span className="fact-item__label">Date of Event</span>
                    <span className="fact-item__value" style={{ fontFamily: 'var(--font-mono)' }}>
                      {person.date || report.dateReported || 'Unknown'}
                    </span>
                  </div>
                </div>

                {(person.physicalFeatures || person.identifyingMarks) && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--sp-4)', marginTop: 'var(--sp-2)' }}>
                    {person.physicalFeatures && (
                      <div className="fact-item">
                        <span className="fact-item__label">Physical Features</span>
                        <span className="fact-item__value">{person.physicalFeatures}</span>
                      </div>
                    )}
                    {person.identifyingMarks && (
                      <div className="fact-item">
                        <span className="fact-item__label">Identifying Marks</span>
                        <span className="fact-item__value">{person.identifyingMarks}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Incident Location Details */}
              <div className="dossier-section">
                <FileTabHeading as="h3" icon={<MapPin size={16} />}>
                  Incident Location
                </FileTabHeading>
                <div className="facts-grid">
                  <div className="fact-item">
                    <span className="fact-item__label">Address</span>
                    <span className="fact-item__value">{location.address || 'Not specified'}</span>
                  </div>
                  <div className="fact-item">
                    <span className="fact-item__label">City</span>
                    <span className="fact-item__value">{location.city || '-'}</span>
                  </div>
                  <div className="fact-item">
                    <span className="fact-item__label">District</span>
                    <span className="fact-item__value">{location.district || '-'}</span>
                  </div>
                  <div className="fact-item">
                    <span className="fact-item__label">State</span>
                    <span className="fact-item__value">{location.state || '-'}</span>
                  </div>
                  <div className="fact-item">
                    <span className="fact-item__label">Pincode</span>
                    <span className="fact-item__value" style={{ fontFamily: 'var(--font-mono)' }}>
                      {location.pincode || '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Event & Audit History Timeline */}
              <div className="dossier-section">
                <FileTabHeading as="h3" icon={<History size={16} />}>
                  Event & Audit History
                </FileTabHeading>
                <div className="history-timeline">
                  {history.map((entry, idx) => (
                    <div key={idx} className="history-item">
                      <span className="history-item__dot" />
                      <span className="history-item__event">{entry.event}</span>
                      <span className="history-item__date">
                        {entry.date ? new Date(entry.date).toLocaleString() : 'Date recorded'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar: Actions & Internal Reporter Details */}
          <aside className="report-sidebar" aria-label="Casework actions and internal details">
            {/* Casework Actions Card */}
            <div className="actions-card">
              <h2 className="actions-card__title">Casework Actions</h2>

              <div className="action-buttons-stack">
                {/* Approve Button */}
                <Button
                  variant="solid"
                  onClick={handleApprove}
                  loading={actionLoading}
                  disabled={report.status === 'approved' || report.status === 'closed'}
                  style={{
                    backgroundColor: report.status === 'approved' ? 'var(--surface-2)' : 'var(--success)',
                    borderColor: report.status === 'approved' ? 'var(--line)' : 'var(--success)',
                    color: report.status === 'approved' ? 'var(--muted)' : '#ffffff',
                  }}
                >
                  <CheckCircle2 size={16} style={{ marginRight: '6px' }} />
                  {report.status === 'approved' ? 'Report Approved' : 'Approve Report'}
                </Button>

                {/* Request More Information Button */}
                <Button
                  variant="outline"
                  onClick={handleOpenRequestInfoModal}
                  disabled={actionLoading || report.status === 'rejected' || report.status === 'closed'}
                >
                  <Send size={15} style={{ marginRight: '6px' }} />
                  Request More Info
                </Button>

                {/* Reject Button (Destructive -> Confirmation Modal) */}
                <Button
                  variant="danger"
                  onClick={handleOpenRejectModal}
                  disabled={actionLoading || report.status === 'rejected' || report.status === 'closed'}
                >
                  <AlertTriangle size={15} style={{ marginRight: '6px' }} />
                  Reject Report
                </Button>
              </div>

              {/* Assign Officer Dropdown */}
              <div className="assignment-block">
                <label htmlFor="assign-officer-select">Assign Officer</label>
                <div className="assignment-select-row">
                  <select
                    id="assign-officer-select"
                    value={selectedOfficerId}
                    onChange={(e) => setSelectedOfficerId(e.target.value)}
                    className="assignment-select"
                  >
                    <option value="">Choose officer...</option>
                    {officers.map((o) => (
                      <option key={o.officerId} value={o.officerId}>
                        {o.name} ({o.badge})
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAssignOfficer}
                    disabled={actionLoading || !selectedOfficerId || selectedOfficerId === report.assignedOfficer?.officerId}
                  >
                    Assign
                  </Button>
                </div>
              </div>

              {/* Escalate Priority */}
              <div className="assignment-block">
                <label htmlFor="set-priority-select">Escalate Priority</label>
                <div className="priority-select-row">
                  <select
                    id="set-priority-select"
                    value={selectedPriority}
                    onChange={(e) => setSelectedPriority(e.target.value)}
                    className="priority-select"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleUpdatePriority}
                    disabled={actionLoading || selectedPriority === report.priority}
                  >
                    Update
                  </Button>
                </div>
              </div>
            </div>

            {/* Reporter Details inside InternalPanel */}
            <InternalPanel>
              <h3 style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 var(--sp-2)' }}>
                Reporter Identity
              </h3>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', margin: 0 }}>
                Strict privacy rule: reporter contact details are never exposed publicly.
              </p>

              <div className="reporter-info-list">
                <div className="reporter-info-item">
                  <span className="reporter-info-label">Name</span>
                  <span className="reporter-info-val">{reporter.name || 'Not provided'}</span>
                </div>
                <div className="reporter-info-item">
                  <span className="reporter-info-label">Phone</span>
                  <span className="reporter-info-val reporter-info-val--mono">
                    {reporter.phone || 'Not provided'}
                  </span>
                </div>
                <div className="reporter-info-item">
                  <span className="reporter-info-label">Email</span>
                  <span className="reporter-info-val reporter-info-val--mono">
                    {reporter.email || 'Not provided'}
                  </span>
                </div>
              </div>
            </InternalPanel>
          </aside>
        </div>

        {/* Destructive Action Modal: Reject Report with required reason */}
        <Modal
          open={rejectModalOpen}
          onClose={() => setRejectModalOpen(false)}
          title="Reject Report"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--sp-2)' }}>
              <Button variant="outline" onClick={() => setRejectModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleConfirmReject} loading={actionLoading}>
                Confirm Rejection
              </Button>
            </div>
          }
        >
          <div className="modal-form">
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)', margin: 0 }}>
              Rejecting this report will prevent case creation. The report will not be published publicly.
              A specific justification is required for the permanent audit log.
            </p>
            <div>
              <label
                htmlFor="reject-reason"
                style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--ink)', marginBottom: 'var(--sp-1)' }}
              >
                Rejection Reason <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <textarea
                id="reject-reason"
                rows={4}
                value={rejectReason}
                onChange={(e) => {
                  setRejectReason(e.target.value);
                  if (rejectReasonError) setRejectReasonError('');
                }}
                placeholder="State why this report cannot be accepted (e.g. duplicate, insufficient details, civil matter)..."
                className={`modal-textarea ${rejectReasonError ? 'modal-textarea--error' : ''}`}
              />
              {rejectReasonError && <p className="modal-error-text">{rejectReasonError}</p>}
            </div>
          </div>
        </Modal>

        {/* Modal: Request More Information with required note */}
        <Modal
          open={requestInfoModalOpen}
          onClose={() => setRequestInfoModalOpen(false)}
          title="Request More Information"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--sp-2)' }}>
              <Button variant="outline" onClick={() => setRequestInfoModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="solid" onClick={handleConfirmRequestInfo} loading={actionLoading}>
                Send Request
              </Button>
            </div>
          }
        >
          <div className="modal-form">
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink)', margin: 0 }}>
              Specify the clarification or documents needed from the reporter.
              Status will transition to <strong>Info Needed</strong>.
            </p>
            <div>
              <label
                htmlFor="request-info-note"
                style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--ink)', marginBottom: 'var(--sp-1)' }}
              >
                Inquiry / Required Information <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <textarea
                id="request-info-note"
                rows={4}
                value={requestInfoNote}
                onChange={(e) => {
                  setRequestInfoNote(e.target.value);
                  if (requestInfoNoteError) setRequestInfoNoteError('');
                }}
                placeholder="e.g. Please provide last known clothing details, recent photograph, or verification of relationship..."
                className={`modal-textarea ${requestInfoNoteError ? 'modal-textarea--error' : ''}`}
              />
              {requestInfoNoteError && <p className="modal-error-text">{requestInfoNoteError}</p>}
            </div>
          </div>
        </Modal>
      </div>
    </StaffLayout>
  );
}
