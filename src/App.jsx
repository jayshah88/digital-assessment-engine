import React, { useEffect, Component } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { useAssessmentStore, api } from '@store/assessmentStore';
import { initializeContent } from '@store/contentStore';
import LoadingScreen from '@components/UI/LoadingScreen';
import ErrorScreen from '@components/UI/ErrorScreen';

// ── Direct Imports (Architecture Flattening) ────────────────────────────────
import IntroScreen from '@components/AssessmentFlow/IntroScreen';
import QuestionFlow from '@components/AssessmentFlow/QuestionFlow';
import SubmittingScreen from '@components/AssessmentFlow/SubmittingScreen';
import ResultsGate from '@components/Results/ResultsGate';
import LeadCaptureForm from '@components/LeadCapture/LeadCaptureForm';
import FullResults from '@components/Results/FullResults';

// ── Phase → Component mapping ──────────────────────────────────────────────
const PHASE_COMPONENTS = {
  intro: IntroScreen,
  questions: QuestionFlow,
  submitting: SubmittingScreen,
  results: ResultsGate,
  'lead-capture': LeadCaptureForm,
  'full-results': FullResults,
};

// ── Robust Error Boundary for Phase Transitions ────────────────────────────
class PhaseErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    // Phase recovery triggered safely without exposing error details to client logs.
  }
  render() {
    if (this.state.hasError) {
      return (
        <ErrorScreen
          message={`The dashboard encountered a temporary rendering issue. (Error: ${this.state.error?.message || 'Unknown'})`}
          onRetry={() => {
            window.location.reload();
          }}
        />
      );
    }
    return this.props.children;
  }
}

export default function App({ assessmentId, assessmentSlug }) {
  const { phase, setAssessment, error: storeError, reset } = useAssessmentStore();

  // Initialize dynamic content and settings from backend on application mount
  useEffect(() => {
    initializeContent();
  }, []);

  const assessmentQuery = useQuery({
    queryKey: ['assessment', assessmentId, assessmentSlug],
    queryFn: async () => {
      const endpoint = assessmentId ? `/assessment/${assessmentId}` : `/assessment/slug/${assessmentSlug}`;
      const response = await api.get(endpoint);
      return response.data || null;
    },
    enabled: !!(assessmentId || assessmentSlug),
    staleTime: 5 * 60 * 1000,
  });

  const questionsQuery = useQuery({
    queryKey: ['questions', assessmentQuery.data?.id],
    queryFn: async () => {
      const response = await api.get(`/questions?assessment_id=${assessmentQuery.data.id}`);
      return response.data || [];
    },
    enabled: !!assessmentQuery.data?.id,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (assessmentQuery.data && questionsQuery.data) {
      setAssessment(assessmentQuery.data, questionsQuery.data);
    }
  }, [assessmentQuery.data, questionsQuery.data, setAssessment]);

  if (assessmentQuery.isLoading || questionsQuery.isLoading) {
    return <LoadingScreen message="Loading assessment…" />;
  }

  if (assessmentQuery.isError || questionsQuery.isError) {
    return (
      <ErrorScreen
        message={assessmentQuery.error?.message || questionsQuery.error?.message}
        onRetry={() => { assessmentQuery.refetch(); questionsQuery.refetch(); }}
      />
    );
  }

  if (storeError) {
    return <ErrorScreen message={storeError} onRetry={reset} />;
  }

  const PhaseComponent = PHASE_COMPONENTS[phase] || IntroScreen;

  return (
    <div className={`dap-app dap-app--phase-${phase}`} id="dap-app-main">
      <PhaseErrorBoundary key={phase}>
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ width: '100%' }}
          >
            <PhaseComponent />
            {/* Transition Debugger (Development only) */}
            {window.dapDebug && (
              <div style={{ position: 'fixed', bottom: 10, right: 10, background: '#000', color: '#0f0', padding: 5, fontSize: 10, zIndex: 9999 }}>
                PHASE: {phase}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </PhaseErrorBoundary>
    </div>
  );
}
