import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Mail, Briefcase, MapPin, Layers, 
  ArrowRight, Lock, Globe, CheckCircle2, BarChart, 
  Database, Activity, Target, RefreshCw 
} from 'lucide-react';
import { useAssessmentStore } from '@store/assessmentStore';
import { useContentStore } from '@store/contentStore';
import Button from '@components/UI/Button';
import { ScoreRing } from '@components/Charts/RadarChart';
import HubSpotForm from './HubSpotForm';

const cfg = window.dapConfig || window.dapAdmin || {};

/**
 * Field — Executive Input Architecture
 */
const Field = ({ label, icon: Icon, value, error, placeholder, onChange, onBlur, type = 'text', required = true }) => (
  <div className="dap-lead__input-group">
    {label && <label className="dap-lead__label">{label}{required && ' *'}</label>}
    <div className={`dap-lead__field ${error ? 'dap-lead__field--error' : ''}`}>
      {Icon && <Icon className="dap-lead__field-icon" size={18} />}
      <input
        type={type}
        className="dap-lead__input"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
      />
    </div>
    <AnimatePresence>
      {error && (
        <motion.p 
          initial={{ opacity: 0, y: -5 }} 
          animate={{ opacity: 1, y: 0 }} 
          exit={{ opacity: 0, y: -5 }}
          className="dap-lead__error"
        >
          {error}
        </motion.p>
      )}
    </AnimatePresence>
  </div>
);

export default function LeadCaptureForm() {
  const { allQuestions, answers, submitLead, result, assessment } = useAssessmentStore();
  const { fetchAssessmentHubspotConfig, fetchContent, hubspotConfig: storeConfig, bandCopy, getLabel, getPerformanceColors } = useContentStore();
  const [config, setConfig] = useState(null);
  const [isFetchingConfig, setIsFetchingConfig] = useState(true);
  
  const assessmentId = assessment?.id;
  
  // Fetch per-assessment HubSpot config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        // Only fetch general content if not already present
        if (!bandCopy) {
          await fetchContent();
        }

        if (assessmentId) {
          const hsConfig = await fetchAssessmentHubspotConfig(assessmentId);
          if (hsConfig) {
            setConfig(hsConfig);
          }
        } else if (storeConfig) {
          setConfig(storeConfig);
        }
      } catch (err) {
        // HubSpot config load failed gracefully
      } finally {
        setIsFetchingConfig(false);
      }
    };

    loadConfig();
    // Only re-run if assessmentId changes
  }, [assessmentId]);
  
  // Use fetched config
  const hubspotConfig = config;
  
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', company: '', job_title: '', country: '', programme_type: '', gdpr_consent: false
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hubspotSubmitted, setHubspotSubmitted] = useState(false);

  // Check if HubSpot form is enabled and configured
  const useHubSpot = hubspotConfig?.enabled === true && hubspotConfig?.portalId && hubspotConfig?.formId;
  
  // High-Fidelity Scoring Teaser
  const rawScore = result?.total_score || result?.score || result?.sum || 0;
  const totalMax = result?.total_max || 48;
  const teaserPct = totalMax > 0 ? Math.round((rawScore / totalMax) * 100) : 0;

  const perfColors = getPerformanceColors ? getPerformanceColors() : { red: '#c02b12', amber: '#e76424', gold: '#edaf18', green: '#069e7b' };
  const bandKey = result?.band_key || result?.level?.key || (teaserPct >= 85 ? 'green' : teaserPct >= 65 ? 'gold' : teaserPct >= 40 ? 'amber' : 'red');
  const ringColor = perfColors[bandKey] || result?.level?.color || '#069e7b';

  const blockPersonal = window.dapConfig?.blockPersonalEmails === true;
  const requireFullIdentity = window.dapConfig?.requireCompanyFields === true;

  const validate = (field, value) => {
    let err = '';
    const optionalFields = ['programme_type', ...(requireFullIdentity ? [] : ['company', 'job_title', 'country', 'last_name'])];
    if (!value && !optionalFields.includes(field)) {
      return getLabel('validation_mandatory', { fallback: 'Mandatory Field' });
    }

    if (field === 'email') {
      if (!/\S+@\S+\.\S+/.test(value)) return getLabel('validation_invalid_email', { fallback: 'Invalid Format' });
      if (blockPersonal) {
        const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'protonmail.com', 'aol.com', 'live.com', 'msn.com'];
        const domain = value.split('@')[1]?.toLowerCase();
        if (personalDomains.includes(domain)) return getLabel('validation_work_email', { fallback: 'Work domain required' });
      }
    }

    if (field === 'gdpr_consent' && !value) return getLabel('validation_consent_required', { fallback: 'Authorization required' });
    return err;
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (touched[field]) {
      setErrors(prev => ({ ...prev, [field]: validate(field, value) }));
    }
  };

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    setErrors(prev => ({ ...prev, [field]: validate(field, form[field]) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    Object.keys(form).forEach(key => {
      const err = validate(key, form[key]);
      if (err) newErrors[key] = err;
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setTouched(Object.keys(form).reduce((acc, k) => ({ ...acc, [k]: true }), {}));
      return;
    }

    setIsSubmitting(true);
    try {
      await submitLead(form);
    } catch (err) {
      alert(err.message || 'System transmission error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="dap-lead-form">
      
      {/* 10/10 TEASER CARD */}
      <motion.div 
        className="dap-card dap-lead__teaser"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="dap-lead__teaser-line" />
        
        <div className="dap-lead__teaser-score">
          <ScoreRing score={teaserPct} size={180} color={ringColor} animated />
        </div>
        <h1 className="dap-lead__title">
          {getLabel('lead_teaser_title', { fallback: 'Baseline Extraction Complete' })}
        </h1>
        <p className="dap-lead__description">
          {getLabel('lead_teaser_desc', { fallback: 'We have generated your strategic capability profile.' })}
          <span className="dap-lead__score-note">
            {getLabel('lead_teaser_score_note', { fallback: `Verification Score: ${Math.round(rawScore)} / ${Math.round(totalMax)} POINTS`, score: Math.round(rawScore), max: Math.round(totalMax) })}
          </span>
        </p>
      </motion.div>

      {/* 10/10 AUTHORIZATION FORM - HubSpot or Default */}
      <motion.div 
        className="dap-card dap-lead__form-card"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.8 }}
      >
        {isFetchingConfig ? (
          <div className="dap-lead__securing">
             <RefreshCw className="animate-spin dap-lead__securing-spinner" size={32} />
             <p className="dap-lead__securing-text">Securing Data Gateway...</p>
          </div>
        ) : useHubSpot ? (
          // HubSpot Form
          <div style={{ position: 'relative', width: '100%', minHeight: isSubmitting ? '260px' : 'auto' }}>
            {isSubmitting && (
              <div className="dap-lead__securing" style={{ padding: '60px 20px' }}>
                <RefreshCw className="animate-spin dap-lead__securing-spinner" size={36} />
                <p className="dap-lead__securing-text" style={{ fontSize: '18px', fontWeight: 700, marginTop: '16px' }}>
                  Constructing Detailed Roadmap...
                </p>
                <p style={{ fontSize: '13px', color: '#64748b', marginTop: '6px', textAlign: 'center' }}>
                  Analyzing metrics & finalizing your customized executive report
                </p>
              </div>
            )}
            <div style={isSubmitting ? { position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, overflow: 'hidden' } : {}}>
              <div className="dap-lead__form-header">
                <h2 className="dap-lead__form-title">
                  {getLabel('section_lead_form', { fallback: 'Unlock Full Roadmap' })}
                </h2>
                <p className="dap-lead__form-subtitle">
                  {getLabel('helper_lead_form', { fallback: 'Complete the form below to access your detailed diagnostic report' })}
                </p>
              </div>
              
              <HubSpotForm
                portalId={hubspotConfig.portalId}
                formId={hubspotConfig.formId}
                region={hubspotConfig.region}
                answers={answers}
                allQuestions={allQuestions}
                result={result}
                onSubmitting={() => setIsSubmitting(true)}
                onFormSubmitted={async (leadData) => {
                  setIsSubmitting(true);
                  try {
                    await submitLead(leadData);
                  } catch (err) {
                    // HubSpot lead sync error handled gracefully
                    useAssessmentStore.setState({ leadCaptured: true, phase: 'full-results', isLoading: false });
                  }
                }}
              />
            </div>
          </div>
        ) : (
          // Default Form
          <form onSubmit={handleSubmit} noValidate>
            <div className="dap-lead__form-header">
              <h2 className="dap-lead__form-title">
                {getLabel('section_lead_form', { fallback: 'Unlock Full Roadmap' })}
              </h2>
              <p className="dap-lead__form-subtitle">
                {getLabel('helper_lead_form', { fallback: 'Global Engineering Standards · Secure Executive Briefing' })}
              </p>
            </div>

            <div className="dap-lead__form-grid">
              <Field label={getLabel('label_first_name', { fallback: 'First name' })} icon={User} placeholder="Jane" value={form.first_name} error={touched.first_name && errors.first_name} onChange={v => handleChange('first_name', v)} onBlur={() => handleBlur('first_name')} />
              <Field label={getLabel('label_last_name', { fallback: 'Last name' })} icon={User} placeholder="Doe" value={form.last_name} error={touched.last_name && errors.last_name} onChange={v => handleChange('last_name', v)} onBlur={() => handleBlur('last_name')} />
            </div>

            <div className="dap-lead__form-grid dap-lead__form-grid--mt">
               <Field label={getLabel('label_company', { fallback: 'Company' })} icon={Briefcase} placeholder="e.g. Acme Industries" value={form.company} error={touched.company && errors.company} onChange={v => handleChange('company', v)} onBlur={() => handleBlur('company')} />
               <Field label={getLabel('label_job_title', { fallback: 'Job title' })} icon={Layers} placeholder="e.g. CTO" value={form.job_title} error={touched.job_title && errors.job_title} onChange={v => handleChange('job_title', v)} onBlur={() => handleBlur('job_title')} />
            </div>

            <Field label={getLabel('label_email', { fallback: 'Work email' })} icon={Mail} placeholder="jane.doe@company.com" type="email" value={form.email} error={touched.email && errors.email} onChange={v => handleChange('email', v)} onBlur={() => handleBlur('email')} />

            <div className="dap-lead__form-grid dap-lead__form-grid--mt">
              {/* Country Dropout */}
              <div className="dap-lead__input-group">
                <label className="dap-lead__label">{getLabel('label_country', { fallback: 'Country' })} *</label>
                <div className={`dap-lead__field ${touched.country && errors.country ? 'dap-lead__field--error' : ''}`}>
                  <Globe size={18} className="dap-lead__field-icon" />
                  <select className="dap-lead__select" value={form.country} onChange={e => handleChange('country', e.target.value)} onBlur={() => handleBlur('country')}>
                    <option value="">{getLabel('label_placeholder_country', { fallback: 'Select Country...' })}</option>
                    <option value="US">United States</option>
                    <option value="UK">United Kingdom</option>
                    <option value="IN">India</option>
                    <option value="DE">Germany</option>
                    <option value="AU">Australia</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                {touched.country && errors.country && <p className="dap-lead__error">{getLabel('validation_mandatory', { fallback: 'Required' })}</p>}
              </div>
              {/* Programme Type */}
              <div className="dap-lead__input-group">
                <label className="dap-lead__label">{getLabel('label_programme_type', { fallback: 'Programme type' })}</label>
                <div className="dap-lead__field">
                  <Target size={18} className="dap-lead__field-icon" />
                  <select className="dap-lead__select" value={form.programme_type} onChange={e => handleChange('programme_type', e.target.value)}>
                    <option value="">{getLabel('label_placeholder_programme_type', { fallback: 'Select Type...' })}</option>
                    <option value="New product development">New product development</option>
                    <option value="Platform refresh">Platform refresh</option>
                    <option value="Scale-up">Scale-up</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="dap-lead__consent">
              <label className="dap-lead__consent-label">
                <input type="checkbox" checked={form.gdpr_consent} onChange={e => handleChange('gdpr_consent', e.target.checked)} className="dap-lead__consent-checkbox" />
                <span className="dap-lead__consent-text">
                  {getLabel('label_consent', { fallback: 'I authorize the secure transmission of my capability metrics in accordance with global strategic data governance protocols.' })}
                </span>
              </label>
            </div>

            <Button type="submit" variant="primary" size="xl" fullWidth isLoading={isSubmitting} className="dap-lead__submit-btn" rightIcon={<ArrowRight size={20} />}>
              {getLabel('button_submit', { fallback: 'Construct Detailed Roadmap' })}
            </Button>

            <footer className="dap-lead__footer">
              <Lock size={14} /> {getLabel('lead_footer_security', { fallback: '256-BIT SSL CAPABILITY PROTECTION' })}
            </footer>
          </form>
        )}
      </motion.div>
    </div>
  );
}
