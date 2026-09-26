/**
 * Content Store — Manages dynamic, customizable content from the backend.
 * Fetches band copy, UI labels, email templates, and other dynamic content.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const cfg = window.dapConfig || window.dapAdmin || {};
const API_BASE = cfg.apiUrl || '/wp-json/assessment/v1';

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

export const useContentStore = create(
  persist(
    (set, get) => ({
      // Content state
      bandCopy: null,
      uiLabels: null,
      ctaUrlBase: window.dapConfig?.siteUrl ? `${window.dapConfig.siteUrl}/contact` : '#contact',
      ctaUrlGreen: window.dapConfig?.siteUrl ? `${window.dapConfig.siteUrl}/assessment` : '#assessment',
      performanceColors: null,
      hubspotConfig: null,
      pdfTemplate: null,
      
      // Loading states
      isLoading: false,
      error: null,

      /**
       * Fetch all dynamic content from the API.
       */
      fetchContent: async () => {
        set({ isLoading: true, error: null });
        
        try {
          const nonce = window.wpApiSettings?.nonce || window.dapConfig?.nonce || window.dapAdmin?.nonce || '';
          const response = await fetch(getSafeUrl(`${API_BASE}/settings/content`), {
            headers: {
              'X-WP-Nonce': nonce
            }
          });
          
          if (!response.ok) {
            throw new Error(`Failed to fetch content: ${response.status}`);
          }
          
          const data = await response.json();
          const fallbackBase = window.dapConfig?.siteUrl ? `${window.dapConfig.siteUrl}/contact` : '#contact';
          const fallbackGreen = window.dapConfig?.siteUrl ? `${window.dapConfig.siteUrl}/assessment` : '#assessment';

          set({
            bandCopy: data.data.band_copy,
            uiLabels: data.data.ui_labels,
            ctaUrlBase: data.data.cta_url_base || fallbackBase,
            ctaUrlGreen: data.data.cta_url_green || fallbackGreen,
            performanceColors: data.data.performance_colors || getDefaultPerformanceColors(),
            hubspotConfig: data.data.hubspot_config || getDefaultHubspotConfig(),
            pdfTemplate: data.data.pdf_template || getDefaultPdfTemplate(),
            isLoading: false,
          });
          
          return data.data;
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Content fetch failed', 
            isLoading: false,
            // Use defaults on error
            bandCopy: get().bandCopy || getDefaultBandCopy(),
            uiLabels: get().uiLabels || getDefaultUiLabels(),
            performanceColors: get().performanceColors || getDefaultPerformanceColors(),
            hubspotConfig: get().hubspotConfig || getDefaultHubspotConfig(),
            pdfTemplate: get().pdfTemplate || getDefaultPdfTemplate(),
          });
          return null;
        }
      },

      /**
       * Get a specific UI label by key.
       * Supports fallback value via vars.fallback
       */
      getLabel: (key, vars = {}) => {
        const labels = get().uiLabels || getDefaultUiLabels();
        const fallback = vars.fallback || key;
        let label = labels[key] || fallback;
        
        // Substitute variables safely without dynamic regex (prevents ReDoS)
        Object.entries(vars).forEach(([varKey, value]) => {
          if (varKey !== 'fallback') {
            label = label.split(`{{${varKey}}}`).join(String(value));
          }
        });
        
        return label;
      },

      /**
       * Get band copy for a specific band.
       */
      getBandCopy: (band, vars = {}) => {
        const copy = get().bandCopy || getDefaultBandCopy();
        const bandData = copy[band] || copy.red;
        
        // Substitute variables safely in all string values without dynamic regex
        const result = {};
        Object.entries(bandData).forEach(([key, value]) => {
          if (typeof value === 'string') {
            let substituted = value;
            Object.entries(vars).forEach(([varKey, varValue]) => {
              substituted = substituted.split(`{{${varKey}}}`).join(String(varValue));
            });
            result[key] = substituted;
          } else {
            result[key] = value;
          }
        });
        
        return result;
      },

      /**
       * Get CTA URL based on band (green vs default).
       */
      getCtaUrl: (band = '') => {
        const labels = get().uiLabels || getDefaultUiLabels();
        const fallbackBase = window.dapConfig?.siteUrl ? `${window.dapConfig.siteUrl}/contact` : '#contact';
        const fallbackGreen = window.dapConfig?.siteUrl ? `${window.dapConfig.siteUrl}/assessment` : '#assessment';
        if (band === 'green' || band === 'benchmark') {
          return labels.cta_url_green || get().ctaUrlGreen || fallbackGreen;
        }
        return labels.cta_url_base || get().ctaUrlBase || fallbackBase;
      },

      /**
       * Get performance colors for score levels.
       */
      getPerformanceColors: () => {
        return get().performanceColors || getDefaultPerformanceColors();
      },

      /**
       * Get HubSpot configuration (cached global version).
       * @deprecated Use fetchAssessmentHubspotConfig for per-assessment config
       */
      getHubspotConfig: () => {
        return get().hubspotConfig || getDefaultHubspotConfig();
      },

      /**
       * Get PDF template configuration settings.
       */
      getPdfTemplate: () => {
        return get().pdfTemplate || getDefaultPdfTemplate();
      },

      /**
       * Fetch HubSpot configuration for a specific assessment.
       * Falls back to global config if assessment uses global settings.
       * 
       * @param {number} assessmentId - The assessment ID
       * @returns {Promise<Object>} HubSpot config object
       */
      fetchAssessmentHubspotConfig: async (assessmentId) => {
        if (!assessmentId) {
          return getDefaultHubspotConfig();
        }
        
        try {
          const nonce = window.wpApiSettings?.nonce || window.dapConfig?.nonce || window.dapAdmin?.nonce || '';
          const response = await fetch(getSafeUrl(`${API_BASE}/assessment/${assessmentId}/hubspot-config`), {
            headers: {
              'X-WP-Nonce': nonce
            }
          });
          
          if (!response.ok) {
            throw new Error(`Failed to fetch HubSpot config: ${response.status}`);
          }
          
          const data = await response.json();
          
          // Transform API response to camelCase format
          const config = {
            enabled: data.data?.enabled || false,
            portalId: data.data?.portal_id || '',
            formId: data.data?.form_id || '',
            region: data.data?.region || 'na1',
            useGlobal: data.data?.use_global || false,
            assessmentId: data.data?.assessment_id,
          };
          
          // Also update the cached config for consistency
          set({ hubspotConfig: config });
          
          return config;
        } catch (error) {
          // Fall back to global config or defaults
          return get().hubspotConfig || getDefaultHubspotConfig();
        }
      },
    }),
    {
      name: 'dap-content-store',
      partialize: (state) => ({
        bandCopy: state.bandCopy,
        uiLabels: state.uiLabels,
        ctaUrlBase: state.ctaUrlBase,
        performanceColors: state.performanceColors,
        hubspotConfig: state.hubspotConfig,
        pdfTemplate: state.pdfTemplate,
      }),
    }
  )
);

// Default content for fallback
function getDefaultBandCopy() {
  return {
    red: {
      headline: 'High risk — act before you build',
      subheadline: 'Significant gaps in capability readiness.',
      description: 'At current trajectory, the gaps in your capability readiness will surface as schedule slippage or costly rework during execution.',
      lowest_dimensions: 'Your lowest-scoring dimensions — {{dim1}}, {{dim2}}, {{dim3}} — are the variables most likely to determine your delivery outcome.',
      full_text: 'At current trajectory, schedule slippage and costly rework are likely. The decisions being deferred now will cost significantly more to fix after execution begins.',
      cta_text: 'Talk to an advisor about your roadmap plan',
      cta_subtext: 'Schedule a strategic review',
      band_label: 'RED — High Risk',
      accent_color: '#c02b12',
      bg_color: '#FEF2F2',
      border_color: '#FECACA',
    },
    amber: {
      headline: 'Moderate risk — specific gaps to close',
      subheadline: 'Good foundations in some areas, but material gaps remain.',
      description: 'You have solid fundamentals established, but specific capabilities need reinforcement before scaling.',
      lowest_dimensions: 'The dimensions to prioritise before proceeding: {{dim1}}, {{dim2}}. Closing these gaps now is significantly cheaper than addressing them later.',
      full_text: 'Addressing these now is significantly more cost-effective than addressing them during validation and rollout.',
      cta_text: 'Download the comprehensive readiness framework',
      cta_subtext: 'Access actionable guidelines',
      band_label: 'AMBER — Moderate Risk',
      accent_color: '#e76424',
      bg_color: '#FFFBEB',
      border_color: '#FDE68A',
    },
    green: {
      headline: 'Benchmark readiness — sustain and scale',
      subheadline: 'Your programme is structured for scalable success across every core dimension.',
      description: 'Your programme is structured for scalable success. The fundamentals are in place across every evaluated dimension.',
      lowest_dimensions: 'The focus at this readiness level is maintaining standards and governance as you scale into new domains and platforms.',
      cta_text: 'Explore next steps and scaling strategies',
      cta_subtext: 'Continue your growth roadmap',
      band_label: 'GREEN — Benchmark',
      accent_color: '#069e7b',
      bg_color: '#ECFDF5',
      border_color: '#A7F3D0',
    },
    gold: {
      headline: 'Low risk — optimise remaining gaps',
      subheadline: 'Strong readiness across most dimensions.',
      description: 'Strong readiness across primary dimensions. The remaining gaps are specific, localized, and addressable.',
      cta_text: 'Review recommended actions and priority optimizations',
      cta_subtext: 'View actionable breakdown',
      band_label: 'GOLD — Low Risk',
      accent_color: '#edaf18',
      bg_color: '#FFFBEB',
      border_color: '#FDE68A',
    },
  };
}

function getDefaultUiLabels() {
  const fallbackBase = window.dapConfig?.siteUrl ? `${window.dapConfig.siteUrl}/contact` : '#contact';
  const fallbackGreen = window.dapConfig?.siteUrl ? `${window.dapConfig.siteUrl}/assessment` : '#assessment';
  return {
    button_start: 'Start Assessment',
    button_next: 'Next',
    button_back: 'Back',
    button_submit: 'Get My Results',
    button_retake: 'Re-Scan',
    button_download: 'Download Report',
    button_close: 'Close',
    button_book_call: 'Book a Call',
    button_learn_more: 'Learn More',
    button_cta_primary: 'Talk to Us',
    button_cta_green: 'Continue to Next Step',
    cta_url_base: fallbackBase,
    cta_url_green: fallbackGreen,
    section_score_breakdown: 'Score Breakdown',
    section_recommendations: 'Recommendations',
    section_your_results: 'Your Results',
    section_lead_form: 'Get Your Detailed Report',
    section_capability_analysis: 'Capability Analysis',
    helper_lead_form: 'Enter your details to receive a report with actionable recommendations.',
    helper_dimension_hover: 'Hover over any dimension card to see detailed insights.',
    helper_score_scale: 'Scores are calculated on a 0-{{max}} point scale across {{count}} dimensions.',
    helper_points_scale: '(Based on 0-{{max}} points scale)',
    helper_radar_subtitle: 'Performance across all dimensions (0-100% scale)',
    label_first_name: 'First Name',
    label_last_name: 'Last Name',
    label_email: 'Email Address',
    label_company: 'Company',
    label_job_title: 'Job Title',
    label_country: 'Country',
    label_programme_type: 'Programme type',
    label_consent: 'I authorize the secure transmission of my capability metrics in accordance with privacy guidelines.',
    label_placeholder_country: 'Select Country...',
    label_placeholder_programme_type: 'Select Type...',
    intro_description: 'Make informed, data-driven decisions for your organization. This interactive scorecard helps you evaluate your capabilities across critical operational and technological dimensions. Receive an instant readiness score, identify potential risks early, and get actionable recommendations to accelerate your roadmap.',
    intro_feature_1_title: 'Strategic Baseline',
    intro_feature_1_desc: 'A multidimensional audit across {{count}} critical domains.',
    intro_feature_2_title: 'Efficiency Focused',
    intro_feature_2_desc: 'Validated in ~{{mins}} minutes. Optimized for executive time management.',
    intro_feature_3_title: 'Precision Metrics',
    intro_feature_3_desc: 'High-fidelity capability mapping with actionable investment logic.',
    intro_feature_4_title: 'Secure Context',
    intro_feature_4_desc: 'Enterprise-grade confidentiality standards for strategic data protection.',
    intro_cta_note: 'High-Fidelity Dashboard Access · Results within ~3m',
    flow_step_counter: 'STEP {{current}} OF {{total}}',
    message_select_option: 'Please select an option to proceed',
    message_loading: 'Loading your results...',
    message_submitting: 'Submitting...',
    message_generating_pdf: 'Generating your PDF report...',
    message_success: 'Assessment completed successfully!',
    message_error: 'Something went wrong. Please try again.',
    message_submitting_step_1: 'Analysing your responses…',
    message_submitting_step_2: 'Calculating dimension scores…',
    message_submitting_step_3: 'Generating recommendations…',
    message_submitting_step_4: 'Preparing your report…',
    lead_teaser_title: 'Baseline Extraction Complete',
    lead_teaser_desc: 'We have generated your strategic capability profile.',
    lead_teaser_score_note: 'Verification Score: {{score}} / {{max}} POINTS',
    lead_footer_security: '256-BIT SSL DATA PROTECTION',
    validation_mandatory: 'Mandatory Field',
    validation_invalid_email: 'Invalid Format',
    validation_work_email: 'Work domain required',
    validation_consent_required: 'Authorization required',
    label_readiness_score: 'Your Readiness Score',
    label_completed_dimension: 'Completed Dimension',
    label_of_dimensions: 'of {{count}} dimensions',
    label_total_points: 'Total Points',
    label_points_earned: 'points earned',
    label_out_of: 'Out Of',
    label_maximum_points: 'maximum points',
    label_radar_view: 'Radar View',
    label_stats_average: 'Average',
    label_stats_benchmark: 'Benchmark (GREEN)',
    label_stats_high_risk: 'High Risk (RED)',
    cta_badge: 'Phase 2: Operationalization',
    cta_title: 'Accelerate Your Maturity Roadmap',
    cta_description: 'Translate these diagnostic metrics into a scalable, high-performance operational infrastructure.',
  };
}

// Initialize content on app load (Stale-While-Revalidate pattern for dynamic settings updates)
export function initializeContent() {
  const store = useContentStore.getState();
  store.fetchContent();
}

function getDefaultPerformanceColors() {
  return {
    red: '#c02b12',
    amber: '#e76424',
    gold: '#edaf18',
    green: '#069e7b',
  };
}

function getDefaultHubspotConfig() {
  return {
    enabled: false,
    portalId: '',
    formId: '',
    region: 'na1',
  };
}

function getDefaultPdfTemplate() {
  const siteName = window.dapConfig?.siteName || 'Digital Assessment Pro';
  return {
    header_title: 'Readiness & Capability Assessment',
    header_subtitle: `Powered by ${siteName}`,
    footer_text: `© {{year}} ${siteName}. All rights reserved.`,
    primary_color: '#0F172A',
    accent_color: '#6366F1',
    show_logo: true,
    show_page_numbers: true,
  };
}
