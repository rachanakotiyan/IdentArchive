import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import './SafetyPage.css';

/* ── Static content ─────────────────────────────────────── */
const IMMEDIATE_STEPS = [
  'Call 112 immediately if you believe the person is in immediate danger.',
  'File a First Information Report (FIR) at your nearest police station. There is no mandatory waiting period.',
  'Submit a report on IdentArchive to create a formal digital record and allow officer matching.',
  'Notify the person\'s workplace, school, or college so they can assist.',
  'Collect recent photographs and, if possible, a physical description including height, weight, any distinguishing marks, and clothing last worn.',
  'Keep a log of all contacts, times, and any information you receive.',
];

const SAFETY_TIPS = [
  {
    title: 'Act without delay',
    body: 'There is no minimum waiting period before reporting a missing person. If something feels wrong, trust your instinct and act. Early reporting significantly improves outcomes.',
  },
  {
    title: 'Keep accurate records',
    body: 'Record the FIR number from the police station, the reference number from this system, and the name of the investigating officer. Store these in more than one place.',
  },
  {
    title: 'Coordinate with investigators',
    body: 'Avoid publishing information publicly without guidance from the investigating officer. Incorrect or premature disclosures can alert abductors or complicate the search.',
  },
  {
    title: 'Be alert to scams',
    body: 'Fraudsters target families in distress. Be suspicious of anyone demanding money for information. Report any such contact to the police immediately and do not pay.',
  },
  {
    title: 'Secure the person\'s accounts',
    body: 'Inform the person\'s bank of the situation so unusual transactions can be flagged. Ask mobile operators to assist with last-known location data through the police.',
  },
  {
    title: 'Involve trusted family and community',
    body: 'Inform close relatives and trusted neighbours. Ask them to keep watch and contact you if they see or hear anything. A wider, coordinated effort helps.',
  },
  {
    title: 'Look after your own wellbeing',
    body: 'The period of uncertainty is extremely stressful. Where possible, ensure someone is with you. Use the helplines below if you need emotional support — your ability to assist the investigation depends on your own stability.',
  },
  {
    title: 'Reporting a found person',
    body: 'If you have found someone who is unable to identify themselves, contact the police immediately and submit a found-person report here. Provide as much physical detail as possible. Do not remove the person from a public area unless there is an immediate safety risk.',
  },
];

const EMERGENCY_CONTACTS = [
  {
    number: '112',
    service: 'National Emergency Helpline',
    availability: '24 hours, 7 days',
    notes: 'Police, ambulance and fire services. Use this number in any immediate emergency.',
  },
  {
    number: '1098',
    service: 'Childline India',
    availability: '24 hours, 7 days',
    notes: 'For children in distress, at risk or in need of care and protection.',
  },
  {
    number: '181',
    service: 'Women Helpline (Shakti Shalini)',
    availability: '24 hours, 7 days',
    notes: 'For women facing violence, harassment or distress.',
  },
  {
    number: '1930',
    service: 'Cybercrime Helpline',
    availability: 'Business hours (varies by state)',
    notes: 'Report online crimes, digital fraud, exploitation, and trafficking facilitated online.',
  },
  {
    number: '100',
    service: 'Police Emergency',
    availability: '24 hours, 7 days',
    notes: 'Connects directly to the local police control room.',
  },
  {
    number: '14567',
    service: 'Elder Helpline',
    availability: 'Varies by state',
    notes: 'Support for senior citizens in distress or at risk.',
  },
];

const FAQ_ITEMS = [
  {
    q: 'I reported a missing person to the police. Should I also use IdentArchive?',
    a: 'Yes. A police FIR and a report on this system serve complementary purposes. The FIR triggers the legal investigation. IdentArchive creates a digital record that can be matched against found-person reports from across the country, and it allows you to track the status of your case without repeated phone calls.',
  },
  {
    q: 'How long does it take for a submitted report to be reviewed by an officer?',
    a: 'Officers aim to review new submissions within 24 to 48 hours. Reports involving children, suspected abduction, or trafficking are treated as urgent and reviewed as a priority. You will be contacted via email if an officer needs more information from you.',
  },
  {
    q: 'What information do I need to report a found person?',
    a: 'You do not need to know the person\'s name or any personal details. Provide a physical description (approximate age, height, build, distinguishing marks, clothing), the exact location and time you found them, and your own contact details. Officers will use this to cross-reference missing person records.',
  },
  {
    q: 'Who can see my personal details (name, phone, email) after I submit a report?',
    a: 'Your contact information is visible only to the officer assigned to your report and to administrators. It is never displayed on any public page and is used solely for case correspondence.',
  },
  {
    q: 'My report status says "Information Requested." What does that mean?',
    a: 'An officer has reviewed your submission and needs additional details before the report can be formally approved. Check the email address you registered with — an officer will have sent guidance on what is required. You can also call the helpline on 112 for assistance.',
  },
  {
    q: 'Can I check the status of my report without logging in?',
    a: 'Yes. Go to the Track Report page. Enter the reference number issued when you submitted your report, and the email address you used to register. You do not need to log in. Note that the tracking page shows only a status — it does not show internal review notes.',
  },
  {
    q: 'What happens when a potential match is found?',
    a: 'Our system compares missing and found person records automatically. When a potential match is identified, a trained officer reviews it carefully before any action is taken. If a match is confirmed, both the reporter of the missing person and the reporter of the found person are notified through their registered contact details.',
  },
  {
    q: 'I have information about a case but I did not submit the original report. How do I help?',
    a: 'Contact the police on 112 or visit your local police station. Do not attempt to intervene directly, especially in cases involving suspected abduction or trafficking. If you have information about an active case listed publicly on this system, you may also call the national emergency number and reference the case number.',
  },
  {
    q: 'How do I withdraw a report if the person has been found?',
    a: 'Log in and go to your My Reports page. Select the relevant report and use the Update Status option to indicate the person has been found. You may also contact the assigned officer directly — their details are available in the report view. The case will be reviewed and closed by an officer.',
  },
  {
    q: 'Is this system available in my language?',
    a: 'IdentArchive currently operates in English only. Multi-language support is planned for a future phase. If you need assistance in another language, please call 112 where operator assistance may be available.',
  },
];

/* ── FAQ accordion item ──────────────────────────────────── */
function SafetyFaqItem({ q, a, id }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="safety-faq__item">
      <button
        type="button"
        id={`sfaq-trigger-${id}`}
        className="safety-faq__trigger"
        aria-expanded={open}
        aria-controls={`sfaq-panel-${id}`}
        onClick={() => setOpen(v => !v)}
      >
        {q}
        <ChevronDown size={18} className="safety-faq__chevron" aria-hidden="true" />
      </button>
      {open && (
        <div
          id={`sfaq-panel-${id}`}
          role="region"
          aria-labelledby={`sfaq-trigger-${id}`}
          className="safety-faq__panel"
        >
          {a}
        </div>
      )}
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────── */
export default function SafetyPage() {
  useDocumentTitle('Safety & FAQ');

  return (
    <PublicLayout>
      <div className="safety-page">

        {/* Page header */}
        <div className="safety-header">
          <p className="safety-header__eyebrow" aria-hidden="true">Safety &amp; guidance</p>
          <h1 className="safety-header__title">Safety, FAQ and Emergency Contacts</h1>
          <p className="safety-header__lead">
            If someone you know is missing, please read this page carefully.
            It contains practical guidance, emergency numbers, and answers to the most
            common questions about using this system. This information is intended for
            families, carers, and members of the public.
          </p>
        </div>

        {/* Immediate steps — urgent callout */}
        <section aria-labelledby="immediate-heading">
          <h2 id="immediate-heading" className="safety-section__title">
            If someone is missing right now
          </h2>
          <div className="safety-urgent" role="note" aria-label="Urgent guidance">
            <p className="safety-urgent__title">Take these steps immediately</p>
            <ul className="safety-urgent__list">
              {IMMEDIATE_STEPS.map((step, i) => (
                <li key={i} className="safety-urgent__item">
                  <span className="safety-urgent__bullet" aria-hidden="true" />
                  {step}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Safety tips */}
        <section aria-labelledby="safety-tips-heading">
          <h2 id="safety-tips-heading" className="safety-section__title">
            Safety guidance for families and reporters
          </h2>
          <div className="safety-tips-grid">
            {SAFETY_TIPS.map((tip, i) => (
              <div key={i} className="safety-tip-card">
                <div className="safety-tip-card__header">
                  <div className="safety-tip-card__num" aria-hidden="true">{i + 1}</div>
                  <h3 className="safety-tip-card__title">{tip.title}</h3>
                </div>
                <p className="safety-tip-card__body">{tip.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Emergency contacts */}
        <section aria-labelledby="emergency-heading">
          <h2 id="emergency-heading" className="safety-section__title">
            Emergency helplines and contacts
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', marginBottom: 'var(--sp-4)', lineHeight: 'var(--leading-loose)' }}>
            These numbers are free to call and operational around the clock unless otherwise noted.
            Always call <strong style={{ color: 'var(--ink)' }}>112</strong> first if someone
            is in immediate danger.
          </p>
          <div className="safety-table-wrap">
            <table className="safety-table" aria-label="Emergency contact numbers">
              <thead>
                <tr>
                  <th scope="col">Number</th>
                  <th scope="col">Service</th>
                  <th scope="col">Availability</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                {EMERGENCY_CONTACTS.map((c) => (
                  <tr key={c.number}>
                    <td>
                      <span className="safety-table__number">{c.number}</span>
                    </td>
                    <td><strong>{c.service}</strong></td>
                    <td className="safety-table__notes">{c.availability}</td>
                    <td className="safety-table__notes">{c.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: 'var(--sp-3)', fontStyle: 'italic' }}>
            Important: Emergency numbers listed here must be verified before deployment.
            Numbers are correct as of October 2026 but may vary by state or change over time.
            Confirm current numbers at your state police or government helpline directory.
          </p>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="safety-section__title">
            Frequently asked questions
          </h2>
          <div className="safety-faq" role="list">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} role="listitem">
                <SafetyFaqItem q={item.q} a={item.a} id={i} />
              </div>
            ))}
          </div>
        </section>

        {/* Privacy note */}
        <section aria-labelledby="privacy-heading">
          <div className="safety-privacy">
            <h2 id="privacy-heading" className="safety-privacy__title">
              Privacy and data use
            </h2>
            <p className="safety-privacy__body">
              Personal information you submit — including your name, email address and phone number —
              is stored only for case management purposes. It is visible only to the officer
              assigned to your report and to administrators. It is never displayed on public
              case listings, search results, or any other public page.
            </p>
            <p className="safety-privacy__body">
              Case details shown publicly contain only factual, non-identifying information
              necessary for the public to assist in identification. Reporter identity is
              never disclosed publicly. Internal review notes and officer correspondence
              are accessible only to authorised staff.
            </p>
            <p className="safety-privacy__body">
              This is a demonstration system. No data submitted here is connected to any
              real law enforcement database. Do not submit real personal information in
              this demo environment.
            </p>
          </div>
        </section>

      </div>
    </PublicLayout>
  );
}
