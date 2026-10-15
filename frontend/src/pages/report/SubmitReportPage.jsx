import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../../components/ui/Button.jsx';
import { DateField, SelectField, TextArea, TextField } from '../../components/ui/Fields.jsx';
import Stepper from '../../components/ui/Stepper.jsx';
import { useAuth } from '../../context/useAuth.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import * as publicService from '../../services/publicService.js';
import * as reportService from '../../services/reportService.js';
import { PublicLayout } from '../../components/layout/PublicLayout.jsx';
import './ReportPages.css';

const STEPS = [
  { id: 'reporter', label: 'Who is reporting' },
  { id: 'person', label: 'Person' },
  { id: 'location', label: 'Where & when' },
  { id: 'description', label: 'Description' },
  { id: 'review', label: 'Review' },
];

function localToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function createInitialValues(user) {
  return {
    reporter: {
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
    },
    person: {
      name: '',
      age: '',
      gender: '',
      heightCm: '',
      physicalFeatures: '',
      identifyingMarks: '',
      date: localToday(),
    },
    location: {
      address: '',
      pincode: '',
      city: '',
      district: '',
      state: '',
    },
    description: '',
  };
}

function readDraft(key, fallback) {
  try {
    const stored = sessionStorage.getItem(key);
    if (!stored) return { values: fallback, step: 0, error: '' };
    const draft = JSON.parse(stored);
    const draftValues = draft.values || draft;
    return {
      values: {
        ...fallback,
        ...draftValues,
        reporter: { ...fallback.reporter, ...draftValues.reporter },
        person: { ...fallback.person, ...draftValues.person },
        location: { ...fallback.location, ...draftValues.location },
      },
      step: Number.isInteger(draft.currentStep) && draft.currentStep >= 0 && draft.currentStep <= 4
        ? draft.currentStep
        : 0,
      error: '',
    };
  } catch {
    return { values: fallback, step: 0, error: 'The saved draft could not be read. A new draft will be started.' };
  }
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateStep(step, values, reportType, pinLookup) {
  const errors = {};
  if (step === 0) {
    if (!values.reporter.name.trim()) errors.name = 'Enter the reporter name.';
    if (!validateEmail(values.reporter.email.trim())) errors.email = 'Enter a valid email address.';
    const phoneDigits = values.reporter.phone.replace(/\D/g, '');
    if (phoneDigits.length < 8 || phoneDigits.length > 15) {
      errors.phone = 'Enter a phone number with 8 to 15 digits.';
    }
  }

  if (step === 1) {
    if (reportType === 'missing' && !values.person.name.trim()) {
      errors.name = 'Enter the missing person’s name.';
    }
    if (values.person.age !== '') {
      const age = Number(values.person.age);
      if (!Number.isInteger(age) || age < 0 || age > 120) errors.age = 'Age must be from 0 to 120 years.';
    }
    if (values.person.gender === '') errors.gender = 'Select a gender.';
    if (values.person.heightCm !== '') {
      const height = Number(values.person.heightCm);
      if (!Number.isFinite(height) || height < 30 || height > 260) {
        errors.heightCm = 'Height must be from 30 to 260 cm.';
      }
    }
  }

  if (step === 2) {
    if (!values.location.address.trim()) errors.address = 'Enter the location or address.';
    if (!values.person.date) errors.date = 'Enter the date the person was last seen or found.';
    else if (values.person.date > localToday()) errors.date = 'The date cannot be in the future.';
    if (!/^\d{6}$/.test(values.location.pincode)) errors.pincode = 'Pincode must be 6 digits.';
    else if (pinLookup.status === 'error') errors.pincode = pinLookup.error;
    else if (pinLookup.status !== 'success' || pinLookup.pincode !== values.location.pincode) {
      errors.pincode = 'Wait for the pincode lookup to finish.';
    }
  }

  if (step === 3 && !values.description.trim()) {
    errors.description = 'Describe what happened.';
  }
  return errors;
}

function displayDate(date) {
  if (!date) return 'Not provided';
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString();
}

function ReviewSection({ title, step, onEdit, children }) {
  return (
    <section className="report-review__section">
      <div className="report-review__section-heading">
        <h3>{title}</h3>
        <button type="button" className="report-review__edit" onClick={() => onEdit(step)}>Edit</button>
      </div>
      <dl className="report-review__details">{children}</dl>
    </section>
  );
}

function ReviewItem({ label, value }) {
  return (
    <div className="report-review__item">
      <dt>{label}</dt>
      <dd>{value || 'Not provided'}</dd>
    </div>
  );
}

export default function SubmitReportPage() {
  useDocumentTitle('Submit a report');
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const reportType = searchParams.get('type') === 'found' ? 'found' : 'missing';
  const draftKey = `ia-report-draft-${user?.userId || user?.email || 'user'}-${reportType}`;
  const defaults = createInitialValues(user);
  const [initialDraft] = useState(() => readDraft(draftKey, defaults));
  const [values, setValues] = useState(initialDraft.values);
  const [currentStep, setCurrentStep] = useState(initialDraft.step);
  const [touched, setTouched] = useState({});
  const [pinLookup, setPinLookup] = useState({ pincode: '', status: 'idle', error: '' });
  const [storageError, setStorageError] = useState(initialDraft.error);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(initialDraft.values !== defaults);
  const dirtyRef = useRef(dirty);
  const editingReview = useRef(false);

  const stepLabels = STEPS.map((step) => (
    step.id === 'person'
      ? { ...step, label: reportType === 'found' ? 'Who was found' : 'Who is missing' }
      : step
  ));

  useEffect(() => {
    const pincode = values.location.pincode;
    if (!/^\d{6}$/.test(pincode)) {
      return undefined;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setPinLookup({ pincode, status: 'loading', error: '' });
      try {
        const info = await publicService.getPinInfo(pincode);
        if (!active) return;
        setValues((current) => (
          current.location.pincode === pincode
            ? { ...current, location: { ...current.location, ...info } }
            : current
        ));
        setPinLookup({ pincode, status: 'success', error: '' });
      } catch (error) {
        if (!active) return;
        setPinLookup({
          pincode,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unable to look up this pincode.',
        });
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [values.location.pincode]);

  useEffect(() => {
    let active = true;
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({ values, currentStep }));
      queueMicrotask(() => {
        if (active) setStorageError('');
      });
    } catch {
      queueMicrotask(() => {
        if (active) setStorageError('Draft storage is unavailable. Keep this page open until you submit.');
      });
    }
    return () => { active = false; };
  }, [currentStep, draftKey, values]);

  useEffect(() => {
    const warnBeforeUnload = (event) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const warnBeforeInternalNavigation = (event) => {
      if (!dirtyRef.current || !(event.target instanceof Element)) return;
      const anchor = event.target.closest('a[href]');
      if (!anchor || anchor.target === '_blank' || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (!window.confirm('You have an unsaved report draft. Leave this page?')) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      dirtyRef.current = false;
      setDirty(false);
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    document.addEventListener('click', warnBeforeInternalNavigation, true);
    return () => {
      window.removeEventListener('beforeunload', warnBeforeUnload);
      document.removeEventListener('click', warnBeforeInternalNavigation, true);
    };
  }, []);

  const setChanged = (section, field, value) => {
    dirtyRef.current = true;
    setDirty(true);
    setSubmitError('');
    setValues((current) => {
      if (section === 'location' && field === 'pincode') {
        setPinLookup({ pincode: value, status: 'idle', error: '' });
        return {
          ...current,
          location: { ...current.location, pincode: value, city: '', district: '', state: '' },
        };
      }
      if (section === 'description') return { ...current, description: value };
      return {
        ...current,
        [section]: { ...current[section], [field]: value },
      };
    });
    setTouched((current) => ({ ...current, [`${section}.${field}`]: true }));
  };

  const currentErrors = validateStep(currentStep, values, reportType, pinLookup);
  const markStepTouched = (step) => {
    const fieldsByStep = [
      ['reporter.name', 'reporter.email', 'reporter.phone'],
      ['person.name', 'person.age', 'person.gender', 'person.heightCm'],
      ['location.address', 'location.pincode', 'person.date'],
      ['description'],
    ];
    setTouched((current) => ({
      ...current,
      ...Object.fromEntries(fieldsByStep[step].map((key) => [key, true])),
    }));
  };

  const canContinue = Object.keys(currentErrors).length === 0;

  const submitReport = async () => {
    setSubmitError('');
    setSubmitting(true);
    try {
      const result = await reportService.submitReport({
        reportType,
        reporter: values.reporter,
        person: {
          ...values.person,
          age: values.person.age === '' ? null : Number(values.person.age),
          heightCm: values.person.heightCm === '' ? null : Number(values.person.heightCm),
        },
        location: values.location,
        description: values.description.trim(),
      });
      try {
        sessionStorage.removeItem(draftKey);
      } catch {
        setStorageError('Report submitted, but this browser could not clear the saved draft.');
      }
      dirtyRef.current = false;
      setDirty(false);
      navigate(`/report/confirmation/${encodeURIComponent(result.referenceNo)}`, { replace: true });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to submit the report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const goNext = () => {
    markStepTouched(currentStep);
    if (!canContinue) return;
    if (currentStep === 4) {
      submitReport();
      return;
    }
    if (editingReview.current) {
      editingReview.current = false;
      setCurrentStep(4);
      return;
    }
    setCurrentStep((step) => Math.min(step + 1, 4));
  };

  const editSection = (step) => {
    editingReview.current = true;
    setCurrentStep(step);
  };

  const errorFor = (key, field) => (touched[`${key}.${field}`] ? currentErrors[field] : '');

  return (
    <PublicLayout>
      <div className="report-page">
        <header className="report-page__header">
          <p className="report-page__eyebrow">New report · {reportType}</p>
          <h1>{reportType === 'found' ? 'Report a person found' : 'Report a missing person'}</h1>
          <p>Your information will be reviewed by IdentArchive staff. It is not shown publicly.</p>
        </header>

        <Stepper steps={stepLabels} currentStep={currentStep} />

        {storageError && <p className="report-message report-message--warning" role="status">{storageError}</p>}
        {submitError && (
          <div className="report-message report-message--error" role="alert">
            <p>{submitError}</p>
            <Button type="button" variant="outline" loading={submitting} onClick={submitReport}>
              Retry submission
            </Button>
          </div>
        )}

        <section className="report-panel" aria-labelledby="report-step-title">
          {currentStep === 0 && (
            <>
              <h2 id="report-step-title">Who is reporting?</h2>
              <p className="report-panel__intro">Confirm your contact details. Your phone number can be updated for this report.</p>
              <div className="report-form-grid">
                <TextField
                  id="reporter-name"
                  label="Your name"
                  autoComplete="name"
                  value={values.reporter.name}
                  readOnly
                  required
                />
                <TextField
                  id="reporter-email"
                  label="Email"
                  type="email"
                  autoComplete="email"
                  value={values.reporter.email}
                  readOnly
                  required
                />
                <TextField
                  id="reporter-phone"
                  label="Phone"
                  type="tel"
                  autoComplete="tel"
                  value={values.reporter.phone}
                  onChange={(event) => setChanged('reporter', 'phone', event.target.value)}
                  onBlur={() => setTouched((current) => ({ ...current, 'reporter.phone': true }))}
                  error={errorFor('reporter', 'phone')}
                  required
                />
              </div>
            </>
          )}

          {currentStep === 1 && (
            <>
              <h2 id="report-step-title">{reportType === 'found' ? 'Who was found?' : 'Who is missing?'}</h2>
              <p className="report-panel__intro">
                {reportType === 'found'
                  ? 'Add details that may help identify the person. Name and age are optional.'
                  : 'Add the person’s details as accurately as you can.'}
              </p>
              <div className="report-form-grid">
                <TextField
                  id="person-name"
                  label={reportType === 'found' ? 'Name (if known)' : 'Name'}
                  value={values.person.name}
                  onChange={(event) => setChanged('person', 'name', event.target.value)}
                  onBlur={() => setTouched((current) => ({ ...current, 'person.name': true }))}
                  error={errorFor('person', 'name')}
                  required={reportType === 'missing'}
                />
                <TextField
                  id="person-age"
                  label="Age"
                  type="number"
                  min="0"
                  max="120"
                  value={values.person.age}
                  onChange={(event) => setChanged('person', 'age', event.target.value)}
                  onBlur={() => setTouched((current) => ({ ...current, 'person.age': true }))}
                  error={errorFor('person', 'age')}
                  hint="Enter a number from 0 to 120, if known."
                />
                <SelectField
                  id="person-gender"
                  label="Gender"
                  value={values.person.gender}
                  onChange={(event) => setChanged('person', 'gender', event.target.value)}
                  onBlur={() => setTouched((current) => ({ ...current, 'person.gender': true }))}
                  error={errorFor('person', 'gender')}
                  required
                >
                  <option value="">Select gender</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="non_binary">Non-binary</option>
                  <option value="unknown">Unknown</option>
                </SelectField>
                <TextField
                  id="person-height"
                  label="Height (cm)"
                  type="number"
                  min="30"
                  max="260"
                  value={values.person.heightCm}
                  onChange={(event) => setChanged('person', 'heightCm', event.target.value)}
                  onBlur={() => setTouched((current) => ({ ...current, 'person.heightCm': true }))}
                  error={errorFor('person', 'heightCm')}
                  hint="Optional; enter a value from 30 to 260 cm."
                />
                <TextField
                  id="person-features"
                  label="Physical features"
                  value={values.person.physicalFeatures}
                  onChange={(event) => setChanged('person', 'physicalFeatures', event.target.value)}
                  hint="Optional"
                />
                <TextField
                  id="person-marks"
                  label="Identifying marks"
                  value={values.person.identifyingMarks}
                  onChange={(event) => setChanged('person', 'identifyingMarks', event.target.value)}
                  hint="Optional"
                />
              </div>
            </>
          )}

          {currentStep === 2 && (
            <>
              <h2 id="report-step-title">Where and when?</h2>
              <p className="report-panel__intro">Enter the location. A six-digit pincode fills in the city, district and state.</p>
              <div className="report-form-grid report-form-grid--location">
                <TextField
                  id="report-address"
                  label="Address or location"
                  value={values.location.address}
                  onChange={(event) => setChanged('location', 'address', event.target.value)}
                  onBlur={() => setTouched((current) => ({ ...current, 'location.address': true }))}
                  error={errorFor('location', 'address')}
                  required
                />
                <TextField
                  id="report-pincode"
                  label="Pincode"
                  inputMode="numeric"
                  maxLength={6}
                  value={values.location.pincode}
                  onChange={(event) => setChanged('location', 'pincode', event.target.value.replace(/\D/g, '').slice(0, 6))}
                  onBlur={() => setTouched((current) => ({ ...current, 'location.pincode': true }))}
                  error={errorFor('location', 'pincode')}
                  hint={pinLookup.status === 'loading' ? 'Looking up pincode…' : 'Enter 6 digits.'}
                  required
                />
                <TextField id="report-city" label="City" value={values.location.city} disabled />
                <TextField id="report-district" label="District" value={values.location.district} disabled />
                <TextField id="report-state" label="State" value={values.location.state} disabled />
                <DateField
                  id="person-date"
                  label={reportType === 'found' ? 'Date found' : 'Date last seen'}
                  max={localToday()}
                  value={values.person.date}
                  onChange={(event) => setChanged('person', 'date', event.target.value)}
                  onBlur={() => setTouched((current) => ({ ...current, 'person.date': true }))}
                  error={touched['person.date'] ? currentErrors.date : ''}
                  required
                />
              </div>
            </>
          )}

          {currentStep === 3 && (
            <>
              <h2 id="report-step-title">Description</h2>
              <p className="report-panel__intro">Share the relevant details in clear, factual language.</p>
              <TextArea
                id="report-description"
                label="What happened?"
                rows={7}
                value={values.description}
                onChange={(event) => setChanged('description', 'description', event.target.value)}
                onBlur={() => setTouched((current) => ({ ...current, 'description.description': true }))}
                error={touched['description.description'] ? currentErrors.description : ''}
                required
              />
            </>
          )}

          {currentStep === 4 && (
            <div className="report-review">
              <div>
                <h2 id="report-step-title">Review your report</h2>
                <p className="report-panel__intro">Check each section before you submit.</p>
              </div>
              <ReviewSection title="Who is reporting" step={0} onEdit={editSection}>
                <ReviewItem label="Name" value={values.reporter.name} />
                <ReviewItem label="Email" value={values.reporter.email} />
                <ReviewItem label="Phone" value={values.reporter.phone} />
              </ReviewSection>
              <ReviewSection title={reportType === 'found' ? 'Found person' : 'Missing person'} step={1} onEdit={editSection}>
                <ReviewItem label="Name" value={values.person.name} />
                <ReviewItem label="Age" value={values.person.age} />
                <ReviewItem label="Gender" value={values.person.gender.replace('_', ' ')} />
                <ReviewItem label="Height (cm)" value={values.person.heightCm} />
                <ReviewItem label="Physical features" value={values.person.physicalFeatures} />
                <ReviewItem label="Identifying marks" value={values.person.identifyingMarks} />
              </ReviewSection>
              <ReviewSection title="Where and when" step={2} onEdit={editSection}>
                <ReviewItem label="Address" value={values.location.address} />
                <ReviewItem label={reportType === 'found' ? 'Date found' : 'Date last seen'} value={displayDate(values.person.date)} />
                <ReviewItem label="Pincode" value={values.location.pincode} />
                <ReviewItem label="City" value={values.location.city} />
                <ReviewItem label="District" value={values.location.district} />
                <ReviewItem label="State" value={values.location.state} />
              </ReviewSection>
              <ReviewSection title="Description" step={3} onEdit={editSection}>
                <ReviewItem label="What happened?" value={values.description} />
              </ReviewSection>
              <p className="report-review__privacy">
                Reporter and case details are submitted for review and are not displayed on public pages.
              </p>
            </div>
          )}

          <div className="report-form__actions">
            {currentStep > 0 ? (
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => setCurrentStep((step) => step - 1)}
              >
                Previous
              </Button>
            ) : <span />}
            {currentStep < 4 ? (
              <Button type="button" disabled={!canContinue} onClick={goNext}>
                Next
              </Button>
            ) : (
              <Button type="button" loading={submitting} onClick={submitReport}>
                {submitting ? 'Submitting report…' : 'Submit report'}
              </Button>
            )}
          </div>
          <p className="report-form__save-note">
            Draft saved in this browser session. <Link to="/track">Track an existing report</Link>
          </p>
        </section>
      </div>
    </PublicLayout>
  );
}
