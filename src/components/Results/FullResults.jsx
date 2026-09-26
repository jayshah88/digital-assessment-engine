import React, { useRef, useState, useMemo, useEffect } from 'react';
import { motion, MotionConfig } from 'framer-motion';
import { RotateCcw, Download, Loader2, BarChart, Map, Cpu, Award } from 'lucide-react';
import { useAssessmentStore } from '@store/assessmentStore';
import { useContentStore, initializeContent } from '@store/contentStore';
import RadarChart from '@components/Charts/RadarChart';
import ScoreBreakdown from './ScoreBreakdown';
import BandSpecificResult from './BandSpecificResult';
import Button from '@components/UI/Button';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function FullResults() {
  const { result, assessment, blocks, reset } = useAssessmentStore();
  const { getLabel, getPdfTemplate, getCtaUrl } = useContentStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const dashboardRef = useRef(null);
  const headerRef = useRef(null);
  const phase2Ref = useRef(null);
  const pdfTargetRef = useRef(null);

  // Initialize content on mount
  useEffect(() => {
    initializeContent();
  }, []);

  const pdfConfig = getPdfTemplate();

  const pdfHeader = (
    <div
      className="dap-pdf-header"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '24px 40px',
        background: '#fff',
        borderBottom: `3px solid ${pdfConfig.primary_color || '#0F172A'}`,
        marginBottom: '24px',
        borderRadius: '8px'
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: pdfConfig.primary_color || '#0F172A', fontFamily: 'Inter, sans-serif' }}>
          {pdfConfig.header_title || 'Readiness & Capability Assessment'}
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: '13px', fontWeight: 600, color: pdfConfig.accent_color || '#6366F1', fontFamily: 'Inter, sans-serif' }}>
          {pdfConfig.header_subtitle || `Powered by ${window.dapConfig?.siteName || 'Digital Assessment Pro'}`}
        </p>
      </div>
      {pdfConfig.show_logo !== false && (
        <div
          style={{
            background: pdfConfig.primary_color || '#0F172A',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: '6px',
            fontWeight: 800,
            fontSize: '14px',
            letterSpacing: '1px',
            fontFamily: 'Inter, sans-serif'
          }}
        >
          {(window.dapConfig?.siteName || 'ASSESSMENT').toUpperCase()}
        </div>
      )}
    </div>
  );

  const pdfFooter = (
    <div
      className="dap-pdf-footer"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 40px',
        background: '#fff',
        borderTop: '1px solid #E2E8F0',
        marginTop: '32px',
        borderRadius: '8px'
      }}
    >
      <span style={{ fontSize: '12px', color: '#64748B', fontFamily: 'Inter, sans-serif' }}>
        {(pdfConfig.footer_text || `© {{year}} ${window.dapConfig?.siteName || 'Digital Assessment Pro'}. All rights reserved.`).replace('{{year}}', String(new Date().getFullYear()))}
      </span>
      {pdfConfig.show_page_numbers !== false && (
        <span style={{ fontSize: '12px', fontWeight: 700, color: pdfConfig.primary_color || '#0F172A', fontFamily: 'Inter, sans-serif' }}>
          Page 1 of 1
        </span>
      )}
    </div>
  );

  const totalScore = result?.score || result?.total_score || result?.sum || 0;
  const totalMax = result?.total_max || 48;
  const percentage = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
  const level = result?.level || { label: 'Analysis Complete', color: '#0F172A', description: 'Capability profiling finalized.' };
  const blockScores = result?.block_scores || {};
  const recommendations = result?.recommendations || [];

  // Determine if result is Benchmark GREEN (level.key === 'green', or percentage >= 85%)
  const bandKey = result?.band_key || level?.key || '';
  const isGreenBand = bandKey === 'green' || percentage >= 85;

  const ctaText = isGreenBand
    ? getLabel('button_cta_green', { fallback: 'Continue to Next Step' })
    : getLabel('button_cta_primary', { fallback: 'Talk to Us' });

  const fallbackBase = window.dapConfig?.siteUrl ? `${window.dapConfig.siteUrl}/contact` : '#contact';
  const fallbackGreen = window.dapConfig?.siteUrl ? `${window.dapConfig.siteUrl}/assessment` : '#assessment';
  const ctaUrl = getCtaUrl ? getCtaUrl(isGreenBand ? 'green' : 'amber') : (isGreenBand ? fallbackGreen : fallbackBase);

  const radarData = useMemo(() => {
    try {
      return (blocks || []).map(b => {
        const scoreData = blockScores[b.id] || {};
        const pct = typeof scoreData === 'object' ? (scoreData.pct || 0) : (scoreData || 0);
        const title = (b.title || 'Dimension').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        return {
          subject: title,
          score: Math.round(pct),
          color: b.color || '#4F46E5',
          fullMark: 100,
        };
      });
    } catch (e) {
      return [];
    }
  }, [blocks, blockScores]);

  const handleDownloadPDF = async () => {
    setIsGenerating(true);

    // Allow 300ms for React re-render and browser paint cycle to display dynamic headers/footers in print target
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const element = pdfTargetRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#F8FAFC',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2]
      });

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${assessment?.title || 'Engineering_Maturity'}_Report.pdf`);
    } catch (error) {
      // PDF Generation failed silently without leaking to console
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="dap-results" ref={dashboardRef}>
      {/* Executive Midnight Header */}
      <motion.div
        ref={headerRef}
        className="dap-results__header dap-results-header-custom"
        data-html2canvas-ignore="true"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
      >
        <div className="dap-results__header-inner dap-results-header-inner-custom">
          <div className="dap-results__title-group">
            <span className="dap-results__subtitle">{getLabel('helper_results_subtitle', { fallback: 'High-Fidelity Maturity Audit' })}</span>
            <h1 className="dap-results__heading">{assessment?.title || 'Engineering Maturity Assessment'}</h1>
          </div>
          <div className="dap-results__actions">
            <Button
              variant="primary"
              size="md"
              onClick={handleDownloadPDF}
              disabled={isGenerating}
              leftIcon={isGenerating ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
            >
              {isGenerating ? getLabel('message_generating_pdf', { fallback: 'Generating...' }) : getLabel('button_download', { fallback: 'Download Report' })}
            </Button>
            <Button variant="amber" size="md" onClick={reset} leftIcon={<RotateCcw size={16} />}>
              {getLabel('button_retake', { fallback: 'Re-Scan' })}
            </Button>
          </div>
        </div>
      </motion.div>

      <div className="dap-results__body">
        {/* Band-Specific Result Section */}
        <section className="dap-section">
          <BandSpecificResult
            result={result}
            blocks={blocks}
            onCTAClick={() => window.open(level.cta_url || ctaUrl, '_blank')}
          />
        </section>

        {/* Multidimensional Capability Map - Full Width */}
        <motion.div
          className="dap-card"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="dap-card-header">
            <div className="dap-card-header__left">
              <div className="dap-card-header__icon">
                <Map size={20} />
              </div>
              <div>
                <h3 className="dap-card-header__title">
                  {getLabel('section_capability_analysis', { fallback: 'Capability Analysis' })}
                </h3>
                <p className="dap-card-header__subtitle">
                  {getLabel('helper_radar_subtitle', { fallback: 'Performance across all dimensions (0-100% scale)' })}
                </p>
              </div>
            </div>
            <span className="dap-card-header__badge">
              {getLabel('label_radar_view', { fallback: 'Radar View' })}
            </span>
          </div>
          <RadarChart data={radarData} height={450} color={level.color || '#2c8c7f'} />
        </motion.div>

        {/* Heatmap Section */}
        <section className="dap-section--mt-0">
          <div className="dap-section-header">
            <BarChart size={28} className="dap-section-header__icon" />
            <h2 className="dap-section-header__title">
              Dimensional Performance Heatmap
            </h2>
          </div>
          <ScoreBreakdown blocks={blocks} blockScores={blockScores} />
        </section>

        {/* Pinnacle Footer CTA */}
        <motion.div
          ref={phase2Ref}
          className="dap-cta-section"
          data-html2canvas-ignore="true"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.19, 1, 0.22, 1] }}
        >
          <div className="dap-cta-section__inner">
            <h3 className="dap-cta-title">
              {getLabel('cta_title', { fallback: 'Accelerate Your Maturity Roadmap' })}
            </h3>
            <p className="dap-cta-description">
              {getLabel('cta_description', { fallback: 'Partner with our award-winning engineering group to translate these diagnostic metrics into a scalable, high-performance technology infrastructure.' })}
            </p>
            <div className="dap-cta-buttons">
              <Button variant="primary" size="xl" className="dap-btn-white" onClick={() => window.open(ctaUrl, '_blank')}>
                {ctaText}
              </Button>
              <Button variant="amber" size="xl" onClick={reset}>
                {getLabel('button_retake', { fallback: 'Re-Scan' })}
              </Button>
            </div>
          </div>
          {/* Subtle geometric background decoration */}
          <div className="dap-bg-decoration dap-bg-decoration--top-right" />
          <div className="dap-bg-decoration dap-bg-decoration--bottom-left" />
        </motion.div>
      </div>

      {/* Off-screen print target (Only rendered while isGenerating is true) */}
      {isGenerating && (
        <MotionConfig reducedMotion="always">
          <div style={{ width: 0, height: 0, overflow: 'hidden', position: 'absolute', left: 0, top: 0 }}>
            <div
              ref={pdfTargetRef}
              className="dap-pdf-target"
              style={{
                width: '1120px',
                background: '#F8FAFC',
                padding: '40px',
                display: 'flex',
                flexDirection: 'column',
                gap: '30px',
                boxSizing: 'border-box',
              }}
            >
              {pdfHeader}
              <BandSpecificResult
                result={result}
                blocks={blocks}
                onCTAClick={() => { }}
                isPdf={true}
              />

              <div className="dap-card" style={{ padding: '24px 32px' }}>
                <div className="dap-card-header" style={{ marginBottom: '20px' }}>
                  <div className="dap-card-header__left" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h3 className="dap-card-header__title" style={{ margin: 0 }}>
                      {getLabel('section_capability_analysis', { fallback: 'Capability Analysis' })}
                    </h3>
                  </div>
                </div>
                <RadarChart data={radarData} height={450} isPdf={true} color={level.color || '#2c8c7f'} />
              </div>

              <ScoreBreakdown blocks={blocks} blockScores={blockScores} isPdf={true} />
              {pdfFooter}
            </div>
          </div>
        </MotionConfig>
      )}
    </div>
  );
}
