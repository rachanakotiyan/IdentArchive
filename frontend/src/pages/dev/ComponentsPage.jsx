import { useEffect, useMemo, useState } from 'react';
import { Bell, Moon, ShieldCheck, Sun, Zap } from 'lucide-react';
import { useTheme } from '../../context/useTheme.js';
import { useToast } from '../../context/useToast.js';
import Button from '../../components/ui/Button.jsx';
import StatusStamp from '../../components/ui/StatusStamp.jsx';
import CaseIcon from '../../components/ui/CaseIcon.jsx';
import Card from '../../components/ui/Card.jsx';
import FileTabHeading from '../../components/ui/FileTabHeading.jsx';
import InternalPanel from '../../components/ui/InternalPanel.jsx';
import { TextField, TextArea, SelectField, DateField, Checkbox, RadioGroup } from '../../components/ui/Fields.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Banner from '../../components/ui/Banner.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import Stepper from '../../components/ui/Stepper.jsx';
import { Table, Pagination } from '../../components/ui/Table.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { EmptyState, ErrorState } from '../../components/ui/States.jsx';
import Logo from '../../components/ui/Logo.jsx';

const demoRows = [
  ['CASE-2401', 'Open', 'A. Patel', '2 hours ago'],
  ['CASE-2402', 'Under Review', 'M. Khan', '5 hours ago'],
  ['CASE-2403', 'Resolved', 'S. Gomez', '1 day ago'],
  ['CASE-2404', 'Open', 'J. Singh', '1 day ago'],
  ['CASE-2405', 'High', 'R. Lee', '2 days ago'],
  ['CASE-2406', 'Closed', 'P. Nair', '3 days ago'],
  ['CASE-2407', 'Under Review', 'L. Wu', '4 days ago'],
  ['CASE-2408', 'Open', 'A. Shah', '5 days ago'],
  ['CASE-2409', 'Resolved', 'N. Stone', '6 days ago'],
  ['CASE-2410', 'Pending', 'I. Dorsey', '1 week ago'],
  ['CASE-2411', 'Open', 'B. Morris', '1 week ago'],
  ['CASE-2412', 'Closed', 'K. Osei', '1 week ago'],
];

const tabItems = [
  { id: 'overview', label: 'Overview', panel: <div>Overview panel with key policy and triage summary.</div> },
  { id: 'notes', label: 'Notes', panel: <div>Investigator notes and timeline updates.</div> },
  { id: 'risk', label: 'Risk', panel: <div>Risk scoring and watchlist summary.</div> },
];

const steps = [
  { id: 'received', label: 'Received' },
  { id: 'review', label: 'Review' },
  { id: 'action', label: 'Action' },
  { id: 'close', label: 'Close' },
];

const sectionStyle = { marginTop: '32px' };

export default function ComponentsPage() {
  const { effectiveTheme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [modalOpen, setModalOpen] = useState(false);
  const [preferredContact, setPreferredContact] = useState('email');

  useEffect(() => {
    document.title = 'IdentArchive Component Gallery';
  }, []);

  const paginatedRows = useMemo(() => {
    const sliceStart = (page - 1) * pageSize;
    return demoRows.slice(sliceStart, sliceStart + pageSize);
  }, [page, pageSize]);

  const triggerToast = (type, message) => {
    toast({ type, message, duration: 2200 });
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px 80px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Logo size={36} showWordmark />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button variant="outline" size="sm" onClick={() => triggerToast('info', 'System running normally')}>
            <Bell size={14} style={{ marginRight: '8px' }} /> Alerts
          </Button>
          <Button variant="text" size="sm" onClick={toggleTheme}>
            {effectiveTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span style={{ marginLeft: '8px' }}>{effectiveTheme === 'dark' ? 'Light' : 'Dark'} mode</span>
          </Button>
        </div>
      </header>

      <Card raised style={{ padding: '20px 20px 12px' }}>
        <FileTabHeading active icon={<ShieldCheck size={18} />}>UI component gallery</FileTabHeading>
        <p style={{ margin: '12px 0 0', color: 'var(--muted)' }}>
          Mirrors the design tokens and component states used across the app.
        </p>
      </Card>

      <section style={sectionStyle}>
        <FileTabHeading active as="h3">Buttons</FileTabHeading>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginTop: '12px' }}>
          <Button variant="solid">Solid</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="text">Text</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="solid" loading>Loading</Button>
          <Button variant="outline" disabled>Disabled</Button>
          <Button variant="solid" as="a" href="#demo">Link button</Button>
        </div>
      </section>

      <section style={sectionStyle}>
        <FileTabHeading active as="h3">Status stamps</FileTabHeading>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '12px' }}>
          <StatusStamp kind="report" status="submitted" />
          <StatusStamp kind="report" status="under_review" />
          <StatusStamp kind="report" status="info_requested" />
          <StatusStamp kind="priority" status="urgent" />
          <StatusStamp kind="match" status="confirmed" />
          <StatusStamp kind="case" status="resolved" />
        </div>
      </section>

      <section style={sectionStyle}>
        <FileTabHeading active as="h3">Case icons</FileTabHeading>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px', marginTop: '12px', alignItems: 'center' }}>
          <CaseIcon crimeType="missing_person" size="lg" />
          <CaseIcon crimeType="abduction" size="lg" />
          <CaseIcon crimeType="runaway" size="lg" />
          <CaseIcon crimeType="domestic_violence" size="lg" />
          <CaseIcon crimeType="other" size="lg" />
          <CaseIcon crimeType="unknown" size="lg" />
        </div>
      </section>

      <section style={sectionStyle}>
        <FileTabHeading active as="h3">Cards and headings</FileTabHeading>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginTop: '12px' }}>
          <Card raised interactive style={{ padding: '18px' }}>
            <FileTabHeading active>{'Case overview'}</FileTabHeading>
            <p style={{ margin: '12px 0 0', color: 'var(--muted)' }}>Interactive card with raised styling.</p>
          </Card>
          <Card style={{ padding: '18px' }}>
            <FileTabHeading active={false}>{'Archived file'}</FileTabHeading>
            <p style={{ margin: '12px 0 0', color: 'var(--muted)' }}>Inactive filing tab.</p>
          </Card>
        </div>
      </section>

      <section style={sectionStyle}>
        <FileTabHeading active as="h3">Fields</FileTabHeading>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px', marginTop: '12px' }}>
          <TextField label="Full name" placeholder="Enter full name" />
          <TextField label="Email" type="email" error="Please use a valid email" />
          <TextArea label="Case notes" rows={4} placeholder="Enter observations" />
          <SelectField label="Priority" defaultValue="high">
            <option value="low">Low</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </SelectField>
          <DateField label="Incident date" />
          <Checkbox label="Consent to follow-up" defaultChecked />
        </div>
        <div style={{ marginTop: '18px' }}>
          <RadioGroup
            label="Preferred contact"
            name="contact-method"
            value={preferredContact}
            onChange={setPreferredContact}
            options={[
              { value: 'email', label: 'Email', hint: 'Recommended for updates' },
              { value: 'sms', label: 'SMS', hint: 'Fastest for time-sensitive alerts' },
              { value: 'call', label: 'Call', hint: 'For urgent follow-up' },
            ]}
          />
        </div>
      </section>

      <section style={sectionStyle}>
        <FileTabHeading active as="h3">Modal, banners, and toasts</FileTabHeading>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '12px' }}>
          <Button variant="solid" onClick={() => setModalOpen(true)}>Open modal</Button>
          <Button variant="outline" onClick={() => triggerToast('success', 'Saved successfully')}>Success toast</Button>
          <Button variant="outline" onClick={() => triggerToast('error', 'Could not sync records')}>Error toast</Button>
        </div>

        <div style={{ marginTop: '16px' }}>
          <Banner type="info" title="Information">
            <span>Public-facing notice for investigators and claimant updates.</span>
          </Banner>
          <div style={{ marginTop: '12px' }}>
            <Banner type="warning" title="Action required">
              <span>One record is awaiting additional verification before closure.</span>
            </Banner>
          </div>
        </div>

        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Confirm action"
          footer={(
            <>
              <Button variant="text" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button variant="solid" onClick={() => { setModalOpen(false); triggerToast('info', 'Action confirmed'); }}>
                Confirm
              </Button>
            </>
          )}
        >
          <p style={{ margin: 0, color: 'var(--muted)' }}>
            This action updates the selected case record and notifies relevant officers.
          </p>
        </Modal>
      </section>

      <section style={sectionStyle}>
        <FileTabHeading active as="h3">Tabs and stepper</FileTabHeading>
        <div style={{ marginTop: '12px' }}>
          <Tabs tabs={tabItems} defaultTab="overview" />
        </div>
        <div style={{ marginTop: '20px' }}>
          <Stepper steps={steps} currentStep={2} />
        </div>
      </section>

      <section style={sectionStyle}>
        <FileTabHeading active as="h3">Table and pagination</FileTabHeading>
        <div style={{ marginTop: '12px' }}>
          <Table
            columns={['Case', 'Status', 'Officer', 'Updated']}
            rows={paginatedRows.map((row) => [
              row[0],
              <StatusStamp key={`${row[0]}-status`} kind="report" status={row[1].toLowerCase().replace(/\s+/g, '_')} />,
              row[2],
              row[3],
            ])}
            caption="Recent case table preview"
          />
          <div style={{ marginTop: '16px' }}>
            <Pagination
              page={page}
              total={demoRows.length}
              pageSize={pageSize}
              onPage={setPage}
              onPageSize={(nextSize) => {
                setPageSize(nextSize);
                setPage(1);
              }}
            />
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <FileTabHeading active as="h3">Loading, empty, and error states</FileTabHeading>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginTop: '12px' }}>
          <Card style={{ padding: '18px' }}>
            <Skeleton width="100%" height="16px" style={{ marginBottom: '8px' }} />
            <Skeleton width="72%" height="12px" />
          </Card>
          <Card style={{ padding: '18px' }}>
            <Spinner size={28} label="Loading results" />
          </Card>
          <Card style={{ padding: '18px' }}>
            <EmptyState title="No matches found" description="Try widening the search or check a different record range." actionLabel="Refresh" onAction={() => triggerToast('info', 'Search refreshed')} />
          </Card>
          <Card style={{ padding: '18px' }}>
            <ErrorState title="Sync failed" description="The latest records could not be loaded." error="Network timeout after 8s" onRetry={() => triggerToast('info', 'Retry started')} />
          </Card>
        </div>
      </section>

      <section style={sectionStyle}>
        <FileTabHeading active as="h3">Internal panel</FileTabHeading>
        <div style={{ marginTop: '12px' }}>
          <InternalPanel>
            <div style={{ padding: '18px', display: 'grid', gap: '10px' }}>
              <strong>Restricted field note</strong>
              <p style={{ margin: 0, color: 'var(--muted)' }}>This panel is limited to staff-only workflows and sensitive case notes.</p>
            </div>
          </InternalPanel>
        </div>
      </section>

      <section style={sectionStyle}>
        <FileTabHeading active as="h3">Visual symbols</FileTabHeading>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px', alignItems: 'center', marginTop: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={18} />
            <span>Utility action</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={18} />
            <span>Notification</span>
          </div>
        </div>
      </section>
    </div>
  );
}
