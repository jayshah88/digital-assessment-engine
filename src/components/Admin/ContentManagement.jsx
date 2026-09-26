/**
 * Content Management Admin Page
 * Manage dynamic content: Band copy, UI labels, PDF templates
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Palette, Type, FileText, Save, RefreshCw, 
  ChevronDown, ChevronUp, AlertCircle, CheckCircle, Info, 
  Plug, ExternalLink, Droplet
} from 'lucide-react';

const API_BASE = window.dapAdmin?.apiUrl || '/wp-json/assessment/v1';

const getSafeUrl = (url) => {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const parsed = new URL(url);
    const loc = window.location;
    const isLocalhost = (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
                        (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1');
    if (parsed.origin !== loc.origin && !isLocalhost && parsed.hostname !== loc.hostname) {
      throw new Error('Invalid target URL origin');
    }
  }
  return url;
};

// Tab configuration
const TABS = [
  { id: 'colors', label: 'Performance Colors', icon: Droplet, description: 'RED, AMBER, GOLD, GREEN color settings' },
  { id: 'band', label: 'Band Copy', icon: Palette, description: 'RED, AMBER, GOLD, GREEN result messages' },
  { id: 'ui', label: 'UI Labels', icon: Type, description: 'Button text, titles, helper messages' },
  { id: 'pdf', label: 'PDF Template', icon: FileText, description: 'PDF export header, footer, colors' },
  { id: 'integrations', label: 'Integrations', icon: Plug, description: 'HubSpot form integration settings' },
];

// Fetch content from API
const fetchContent = async () => {
  const url = `${API_BASE}/settings/content-admin`;

  const response = await fetch(getSafeUrl(url), {
    headers: { 'X-WP-Nonce': window.dapAdmin?.nonce || window.wpApiSettings?.nonce || '' }
  });

  if (!response.ok) {
    const errorText = await response.text();
    
    let errorMessage = `Failed to fetch content: ${response.status} ${response.statusText}`;
    try {
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.message || errorData.code || errorMessage;
    } catch (e) {
      if (errorText.includes('<!DOCTYPE')) {
        errorMessage = `Server error (HTTP ${response.status}). This often means the REST API path is incorrect or blocked by the server.`;
      } else {
        errorMessage = errorText.substring(0, 200) || errorMessage;
      }
    }
    throw new Error(errorMessage);
  }
  const data = await response.json();
  return data.data;
};

// Save content to API
const saveContent = async (section, data) => {
  const url = `${API_BASE}/settings/content-admin/${section}`;
  const response = await fetch(getSafeUrl(url), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-WP-Nonce': window.dapAdmin?.nonce || window.wpApiSettings?.nonce || ''
    },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to save content');
  return response.json();
};

export default function ContentManagement() {
  const [activeTab, setActiveTab] = useState('colors');
  const [hasChanges, setHasChanges] = useState(false);
  const queryClient = useQueryClient();

  // Fetch all content
  const { data: content, isLoading, error } = useQuery({
    queryKey: ['content-admin'],
    queryFn: fetchContent,
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: ({ section, data }) => saveContent(section, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['content-admin']);
      queryClient.invalidateQueries(['analytics-overview']);
      queryClient.invalidateQueries(['analytics']);
      setHasChanges(false);
    }
  });

  if (isLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <RefreshCw className="animate-spin" size={32} style={{ margin: '0 auto 16px', color: '#6366F1' }} />
        <p>Loading content...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', color: '#DC2626' }}>
        <AlertCircle size={32} style={{ marginBottom: '16px' }} />
        <p>Error loading content: {error.message}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 8px', color: '#0F172A' }}>
          Content Management
        </h1>
        <p style={{ color: '#64748B', margin: 0 }}>
          Customize all dynamic content across the assessment system
        </p>
      </div>

      {/* Tabs */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', 
        gap: '12px',
        marginBottom: '24px' 
      }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '16px',
                borderRadius: '12px',
                border: '2px solid',
                borderColor: isActive ? '#6366F1' : '#E2E8F0',
                background: isActive ? '#EEF2FF' : '#fff',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <Icon size={20} color={isActive ? '#6366F1' : '#64748B'} />
                <span style={{ 
                  fontWeight: 700, 
                  color: isActive ? '#6366F1' : '#0F172A',
                  fontSize: '14px'
                }}>
                  {tab.label}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748B', lineHeight: 1.4 }}>
                {tab.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div style={{ 
        background: '#fff', 
        borderRadius: '16px', 
        border: '1px solid #E2E8F0',
        padding: '24px'
      }}>
        {activeTab === 'colors' && (
          <PerformanceColors 
            content={content?.performance_colors} 
            onSave={(data) => saveMutation.mutate({ section: 'colors', data })}
            isSaving={saveMutation.isPending}
          />
        )}
        {activeTab === 'band' && (
          <BandCopy 
            content={content?.band_copy} 
            performanceColors={content?.performance_colors}
            onSave={(data) => saveMutation.mutate({ section: 'band', data })}
            isSaving={saveMutation.isPending}
          />
        )}
        {activeTab === 'ui' && (
          <UiLabels 
            content={content?.ui_labels} 
            onSave={(data) => saveMutation.mutate({ section: 'ui', data })}
            isSaving={saveMutation.isPending}
          />
        )}
        {activeTab === 'pdf' && (
          <PdfTemplate 
            content={content?.pdf_template} 
            onSave={(data) => saveMutation.mutate({ section: 'pdf', data })}
            isSaving={saveMutation.isPending}
          />
        )}
        {activeTab === 'integrations' && (
          <HubSpotIntegration 
            content={content?.hubspot_config} 
            onSave={(data) => saveMutation.mutate({ section: 'integrations', data })}
            isSaving={saveMutation.isPending}
          />
        )}
      </div>
    </div>
  );
}

// Band Copy Section
function BandCopy({ content, performanceColors, onSave, isSaving }) {
  const [data, setData] = useState(content || {});
  const [activeBand, setActiveBand] = useState('red');

  const colors = performanceColors || {
    red: '#c02b12',
    amber: '#e76424',
    gold: '#edaf18',
    green: '#069e7b',
  };

  const hexToRgba = (hex, alpha) => {
    if (!hex) return `rgba(0,0,0,${alpha})`;
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const bands = [
    { key: 'red', label: 'RED — High Risk', color: colors.red, bg: hexToRgba(colors.red, 0.04) },
    { key: 'amber', label: 'AMBER — Moderate Risk', color: colors.amber, bg: hexToRgba(colors.amber, 0.04) },
    { key: 'gold', label: 'GOLD — Low Risk', color: colors.gold, bg: hexToRgba(colors.gold, 0.04) },
    { key: 'green', label: 'GREEN — Benchmark', color: colors.green, bg: hexToRgba(colors.green, 0.04) },
  ];

  const handleSave = () => onSave(data);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700 }}>Band Copy Configuration</h2>
          <p style={{ margin: 0, color: '#64748B', fontSize: '14px' }}>Customize result page content for each score band</p>
        </div>
        <SaveButton onClick={handleSave} isSaving={isSaving} />
      </div>

      {/* Band Selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {bands.map(band => (
          <button
            key={band.key}
            onClick={() => setActiveBand(band.key)}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: '2px solid',
              borderColor: activeBand === band.key ? band.color : 'transparent',
              background: activeBand === band.key ? band.bg : '#F1F5F9',
              color: band.color,
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            {band.label}
          </button>
        ))}
      </div>

      {/* Band Editor */}
      {bands.map(band => {
        if (band.key !== activeBand) return null;
        const bandData = data[band.key] || {};

        return (
          <div key={band.key} style={{ background: band.bg, padding: '24px', borderRadius: '12px', border: `2px solid ${band.color}20` }}>
            <div style={{ display: 'grid', gap: '16px' }}>
              <TextField
                label="Band Label (Badge)"
                value={bandData.band_label}
                onChange={(v) => setData(p => ({ ...p, [band.key]: { ...bandData, band_label: v } }))}
                placeholder="e.g., RED — High Risk"
              />
              <TextField
                label="Headline"
                value={bandData.headline}
                onChange={(v) => setData(p => ({ ...p, [band.key]: { ...bandData, headline: v } }))}
                placeholder="Main headline for result card"
              />
              <TextField
                label="Subheadline"
                value={bandData.subheadline}
                onChange={(v) => setData(p => ({ ...p, [band.key]: { ...bandData, subheadline: v } }))}
                placeholder="Brief description below headline"
              />
              <TextArea
                label="Description"
                value={bandData.description}
                onChange={(v) => setData(p => ({ ...p, [band.key]: { ...bandData, description: v } }))}
                placeholder="Main paragraph text"
                rows={4}
              />
              <TextArea
                label="Lowest Dimensions Text"
                value={bandData.lowest_dimensions}
                onChange={(v) => setData(p => ({ ...p, [band.key]: { ...bandData, lowest_dimensions: v } }))}
                placeholder="Text about lowest scoring dimensions. Use {{dim1}}, {{dim2}}, {{dim3}}"
                rows={3}
              />
              <TextField
                label="CTA Button Text"
                value={bandData.cta_text}
                onChange={(v) => setData(p => ({ ...p, [band.key]: { ...bandData, cta_text: v } }))}
                placeholder="e.g., Talk to one of our engineers"
              />
              <TextField
                label="CTA Subtext"
                value={bandData.cta_subtext}
                onChange={(v) => setData(p => ({ ...p, [band.key]: { ...bandData, cta_subtext: v } }))}
                placeholder="e.g., Schedule a consultation"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// UI Labels Section
function UiLabels({ content, onSave, isSaving }) {
  const [data, setData] = useState(content || {});

  const handleSave = () => onSave(data);

  const sections = [
    { title: 'Buttons', keys: ['button_start', 'button_next', 'button_back', 'button_submit', 'button_retake', 'button_download', 'button_close', 'button_book_call', 'button_learn_more', 'button_cta_primary', 'button_cta_green'] },
    { title: 'Section Titles', keys: ['section_score_breakdown', 'section_recommendations', 'section_your_results', 'section_lead_form', 'section_capability_analysis'] },
    { title: 'Form Labels & Options', keys: ['label_first_name', 'label_last_name', 'label_email', 'label_company', 'label_job_title', 'label_country', 'label_programme_type', 'label_consent', 'label_placeholder_country', 'label_placeholder_programme_type'] },
    { title: 'Messages & Steps', keys: ['message_loading', 'message_submitting', 'message_generating_pdf', 'message_success', 'message_error', 'message_select_option', 'message_submitting_step_1', 'message_submitting_step_2', 'message_submitting_step_3', 'message_submitting_step_4'] },
    { title: 'Helper Text & Subtitles', keys: ['helper_lead_form', 'helper_dimension_hover', 'helper_score_scale', 'helper_points_scale', 'helper_radar_subtitle'] },
    { title: 'Intro Screen Text', keys: ['intro_description', 'intro_feature_1_title', 'intro_feature_1_desc', 'intro_feature_2_title', 'intro_feature_2_desc', 'intro_feature_3_title', 'intro_feature_3_desc', 'intro_feature_4_title', 'intro_feature_4_desc', 'intro_cta_note'] },
    { title: 'Lead Teaser & Trust Security', keys: ['lead_teaser_title', 'lead_teaser_desc', 'lead_teaser_score_note', 'lead_footer_security'] },
    { title: 'Validation Warning Messages', keys: ['validation_mandatory', 'validation_invalid_email', 'validation_work_email', 'validation_consent_required'] },
    { title: 'Results Page Sublabels', keys: ['label_readiness_score', 'label_completed_dimension', 'label_of_dimensions', 'label_total_points', 'label_points_earned', 'label_out_of', 'label_maximum_points', 'label_radar_view', 'label_stats_average', 'label_stats_benchmark', 'label_stats_high_risk'] },
    { title: 'Phase 2: Operationalization CTA', keys: ['cta_badge', 'cta_title', 'cta_description'] },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700 }}>UI Labels & Text</h2>
          <p style={{ margin: 0, color: '#64748B', fontSize: '14px' }}>Customize all user-facing text and CTA button links</p>
        </div>
        <SaveButton onClick={handleSave} isSaving={isSaving} />
      </div>

      {/* Primary Result CTA Target Links */}
      <div style={{ marginBottom: '28px', padding: '20px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: '0 0 4px', textTransform: 'uppercase' }}>
          Result CTA Action Button Links
        </h3>
        <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 16px' }}>
          Configure destination links for the primary action button based on result readiness level.
        </p>

        <div className="adap-content-grid-2">
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748B', marginBottom: '6px', textTransform: 'uppercase' }}>
              Amber & Below CTA Link ("Talk to us")
            </label>
            <input
              type="text"
              value={data.cta_url_base || ''}
              onChange={(e) => setData(p => ({ ...p, cta_url_base: e.target.value }))}
              placeholder="https://example.com/contact"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                fontSize: '14px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#069E7B', marginBottom: '6px', textTransform: 'uppercase' }}>
              Benchmark GREEN CTA Link ("Continue to Next Step")
            </label>
            <input
              type="text"
              value={data.cta_url_green || ''}
              onChange={(e) => setData(p => ({ ...p, cta_url_green: e.target.value }))}
              placeholder="https://example.com/assessment"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                fontSize: '14px'
              }}
            />
          </div>
        </div>
      </div>

      {sections.map(section => (
        <div key={section.title} style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#64748B', marginBottom: '12px', textTransform: 'uppercase' }}>
            {section.title}
          </h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            {section.keys.map(key => {
              const isLongText = key.includes('description') || key.includes('desc') || key.includes('badge') || key.includes('consent') || key.includes('helper');
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <code style={{ 
                    minWidth: '200px', 
                    fontSize: '12px', 
                    color: '#6366F1', 
                    background: '#EEF2FF', 
                    padding: '4px 8px', 
                    borderRadius: '4px' 
                  }}>
                    {key}
                  </code>
                  {isLongText ? (
                    <textarea
                      value={data[key] || ''}
                      onChange={(e) => setData(p => ({ ...p, [key]: e.target.value }))}
                      rows={2}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #E2E8F0',
                        fontSize: '14px',
                        resize: 'vertical'
                      }}
                    />
                  ) : (
                    <input
                      type="text"
                      value={data[key] || ''}
                      onChange={(e) => setData(p => ({ ...p, [key]: e.target.value }))}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #E2E8F0',
                        fontSize: '14px'
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// Performance Colors Section
function PerformanceColors({ content, onSave, isSaving }) {
  const [data, setData] = useState(content || {
    red: '#c02b12',
    amber: '#e76424',
    gold: '#edaf18',
    green: '#069e7b',
  });

  const handleSave = () => onSave(data);

  const colors = [
    { key: 'red', label: 'RED — High Risk', default: '#c02b12', description: 'Used for scores < 40%' },
    { key: 'amber', label: 'AMBER — Moderate Risk', default: '#e76424', description: 'Used for scores 40% – 64%' },
    { key: 'gold', label: 'GOLD — Low Risk', default: '#edaf18', description: 'Used for scores 65% – 84%' },
    { key: 'green', label: 'GREEN — Benchmark', default: '#069e7b', description: 'Used for scores 85%+' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700 }}>Performance Colors</h2>
          <p style={{ margin: 0, color: '#64748B', fontSize: '14px' }}>Customize the color scheme for assessment performance bands</p>
        </div>
        <SaveButton onClick={handleSave} isSaving={isSaving} />
      </div>

      <div className="adap-content-grid-2" style={{ gap: '24px' }}>
        {colors.map(({ key, label, default: defaultColor, description }) => (
          <div key={key} style={{ padding: '20px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: '8px', 
                background: data[key] || defaultColor,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }} />
              <div>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>{label}</h4>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748B' }}>{description}</p>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="color"
                value={data[key] || defaultColor}
                onChange={(e) => setData(p => ({ ...p, [key]: e.target.value }))}
                style={{ width: '50px', height: '40px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              />
              <input
                type="text"
                value={data[key] || defaultColor}
                onChange={(e) => setData(p => ({ ...p, [key]: e.target.value }))}
                placeholder={defaultColor}
                style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '14px' }}
              />
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '32px', padding: '16px', background: '#EFF6FF', borderRadius: '8px', border: '1px solid #BFDBFE' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600, color: '#1E40AF' }}>
          <Info size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
          Where these colors are used
        </h4>
        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#1E40AF', lineHeight: 1.8 }}>
          <li>Score heatmap in results</li>
          <li>Performance badges and indicators</li>
          <li>Progress bars in dimension breakdown</li>
          <li>Band-specific result cards</li>
          <li>Alert icons for priority gaps</li>
        </ul>
      </div>
    </div>
  );
}

// PDF Template Section
function PdfTemplate({ content, onSave, isSaving }) {
  const [data, setData] = useState(content || {});

  const handleSave = () => onSave(data);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700 }}>PDF Export Template</h2>
          <p style={{ margin: 0, color: '#64748B', fontSize: '14px' }}>Customize PDF report appearance</p>
        </div>
        <SaveButton onClick={handleSave} isSaving={isSaving} />
      </div>

      <div style={{ display: 'grid', gap: '16px' }}>
        <TextField
          label="Header Title"
          value={data.header_title}
          onChange={(v) => setData(p => ({ ...p, header_title: v }))}
        />
        <TextField
          label="Header Subtitle"
          value={data.header_subtitle}
          onChange={(v) => setData(p => ({ ...p, header_subtitle: v }))}
        />
        <TextField
          label="Footer Text"
          value={data.footer_text}
          onChange={(v) => setData(p => ({ ...p, footer_text: v }))}
          placeholder="Use {{year}} for current year"
        />

        <div className="adap-content-grid-2">
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748B', marginBottom: '6px' }}>
              Primary Color
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="color"
                value={data.primary_color || '#0F172A'}
                onChange={(e) => setData(p => ({ ...p, primary_color: e.target.value }))}
                style={{ width: '50px', height: '40px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              />
              <input
                type="text"
                value={data.primary_color || '#0F172A'}
                onChange={(e) => setData(p => ({ ...p, primary_color: e.target.value }))}
                style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #E2E8F0' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748B', marginBottom: '6px' }}>
              Accent Color
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="color"
                value={data.accent_color || '#6366F1'}
                onChange={(e) => setData(p => ({ ...p, accent_color: e.target.value }))}
                style={{ width: '50px', height: '40px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              />
              <input
                type="text"
                value={data.accent_color || '#6366F1'}
                onChange={(e) => setData(p => ({ ...p, accent_color: e.target.value }))}
                style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #E2E8F0' }}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '24px', marginTop: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={data.show_logo}
              onChange={(e) => setData(p => ({ ...p, show_logo: e.target.checked }))}
            />
            <span>Show Logo in Header</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={data.show_page_numbers}
              onChange={(e) => setData(p => ({ ...p, show_page_numbers: e.target.checked }))}
            />
            <span>Show Page Numbers</span>
          </label>
        </div>
      </div>
    </div>
  );
}

// HubSpot Integration Section
function HubSpotIntegration({ content, onSave, isSaving }) {
  const [data, setData] = useState(content || {
    enabled: false,
    portalId: '',
    formId: '',
    region: 'na1',
    fieldMappings: {}
  });

  const handleSave = () => onSave(data);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700 }}>HubSpot Integration</h2>
          <p style={{ margin: 0, color: '#64748B', fontSize: '14px' }}>
            Configure HubSpot form to replace default lead capture
          </p>
        </div>
        <SaveButton onClick={handleSave} isSaving={isSaving} />
      </div>

      {/* Enable/Disable Toggle */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px', 
        padding: '16px', 
        background: data.enabled ? '#ECFDF5' : '#F1F5F9',
        borderRadius: '8px',
        marginBottom: '24px',
        border: `1px solid ${data.enabled ? '#A7F3D0' : '#E2E8F0'}`
      }}>
        <input
          type="checkbox"
          id="hubspot-enabled"
          checked={data.enabled}
          onChange={(e) => setData(p => ({ ...p, enabled: e.target.checked }))}
          style={{ width: '20px', height: '20px' }}
        />
        <label htmlFor="hubspot-enabled" style={{ fontWeight: 600, cursor: 'pointer' }}>
          Enable HubSpot Form
          <span style={{ display: 'block', fontSize: '13px', fontWeight: 400, color: '#64748B', marginTop: '2px' }}>
            When enabled, the HubSpot form will replace the default lead capture form
          </span>
        </label>
      </div>

      {/* Form Configuration */}
      <div style={{ display: 'grid', gap: '16px' }}>
        <div className="adap-content-grid-2">
          <TextField
            label="Portal ID"
            value={data.portalId}
            onChange={(v) => setData(p => ({ ...p, portalId: v }))}
            placeholder="e.g., 1727691"
          />
          <TextField
            label="Region"
            value={data.region}
            onChange={(v) => setData(p => ({ ...p, region: v }))}
            placeholder="e.g., na1, na2, eu1"
          />
        </div>
        <TextField
          label="Form ID"
          value={data.formId}
          onChange={(v) => setData(p => ({ ...p, formId: v }))}
          placeholder="e.g., 161c204a-5e2e-4611-9ddf-37b5c57c2724"
        />
      </div>

      {/* Instructions */}
      <div style={{ 
        marginTop: '32px', 
        padding: '16px', 
        background: '#EFF6FF', 
        borderRadius: '8px',
        border: '1px solid #BFDBFE'
      }}>
        <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700, color: '#1E40AF' }}>
          <Info size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
          How to set up your HubSpot form
        </h4>
        <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#1E40AF', lineHeight: 1.6 }}>
          <li>Go to Marketing → Forms in your HubSpot account</li>
          <li>Create a new form or use an existing one</li>
          <li>Add hidden fields for assessment data:
            <ul style={{ marginTop: '4px' }}>
              <li><code style={{ background: '#DBEAFE', padding: '2px 4px', borderRadius: '4px' }}>assessment_score</code></li>
              <li><code style={{ background: '#DBEAFE', padding: '2px 4px', borderRadius: '4px' }}>assessment_band</code></li>
              <li><code style={{ background: '#DBEAFE', padding: '2px 4px', borderRadius: '4px' }}>assessment_answers</code> (JSON string of all answers)</li>
            </ul>
          </li>
          <li>Copy the Portal ID, Form ID, and Region from your form embed code</li>
          <li>Paste them in the fields above</li>
        </ol>
      </div>

      {/* Preview */}
      {data.enabled && data.portalId && data.formId && (
        <div style={{ marginTop: '32px', padding: '16px', background: '#F0FDF4', borderRadius: '8px', border: '1px solid #BBF7D0' }}>
          <p style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: '#166534' }}>
            <CheckCircle size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
            Configuration Active
          </p>
          <code style={{ display: 'block', padding: '12px', background: '#fff', borderRadius: '6px', fontSize: '12px', wordBreak: 'break-all' }}>
            {`hbspt.forms.create({
  portalId: "${data.portalId}",
  formId: "${data.formId}",
  region: "${data.region || 'na1'}"
});`}
          </code>
        </div>
      )}
    </div>
  );
}

// Helper Components
function TextField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748B', marginBottom: '6px', textTransform: 'uppercase' }}>
        {label}
      </label>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: '8px',
          border: '1px solid #E2E8F0',
          fontSize: '14px'
        }}
      />
    </div>
  );
}

function TextArea({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748B', marginBottom: '6px', textTransform: 'uppercase' }}>
        {label}
      </label>
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: '8px',
          border: '1px solid #E2E8F0',
          fontSize: '14px',
          resize: 'vertical'
        }}
      />
    </div>
  );
}

function SaveButton({ onClick, isSaving }) {
  return (
    <button
      onClick={onClick}
      disabled={isSaving}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 20px',
        background: isSaving ? '#94A3B8' : '#6366F1',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        fontWeight: 700,
        cursor: isSaving ? 'not-allowed' : 'pointer'
      }}
    >
      {isSaving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
      {isSaving ? 'Saving...' : 'Save Changes'}
    </button>
  );
}
