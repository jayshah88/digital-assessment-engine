/**
 * Assessment Store — Zustand-powered global state
 * Handles: assessment data, answers, session persistence, UI state
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ─── API Client ──────────────────────────────────────────────────────────────
const cfg = window.dapConfig || window.dapAdmin || {};

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

export const api = {
  baseUrl: cfg.apiUrl || '/wp-json/assessment/v1',
  nonce:   cfg.nonce  || '',

  async request(path, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); 

    // Determine current nonce - prefer window.wpApiSettings?.nonce (standard WP REST API), then dapConfig, then dapAdmin
    const currentNonce = window.wpApiSettings?.nonce || window.dapConfig?.nonce || window.dapAdmin?.nonce || this.nonce;

    try {
      const res = await fetch(getSafeUrl(`${this.baseUrl}${path}`), {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce':   currentNonce,
          ...(options.headers || {}),
        },
        credentials: 'same-origin',
      });
      
      clearTimeout(timeoutId);

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        if (!res.ok) throw new ApiError(`Server Error (${res.status})`, res.status);
        throw new ApiError('Invalid response from server.', 500);
      }

      if (!res.ok) {
        throw new ApiError(data.message || 'Request failed', res.status, data.code);
      }
      // Return full response with data and meta for count information
      return data;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') throw new ApiError('Request timed out.', 408);
      throw err;
    }
  },

  get:    (path)         => api.request(path),
  post:   (path, body)   => api.request(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    (path, body)   => api.request(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: (path)         => api.request(path, { method: 'DELETE' }),
};

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code   = code;
  }
}

// ─── Assessment Store ─────────────────────────────────────────────────────────
export const useAssessmentStore = create(
  persist(
    (set, get) => ({
      // ── Data ──────────────────────────────────────────────────────────────
      assessment:    null,
      blocks:        [],
      allQuestions:  [],
      currentBlock:  0,
      currentQuestion: 0,
      assessmentId: null, // Track current assessment for session safety

      // ── Answers: { questionId: value | value[] } ───────────────────────
      answers: {},

      // ── Submission result ─────────────────────────────────────────────
      result: null,
      submissionUuid: null,
      submissionId:   null,

      // ── Lead capture ──────────────────────────────────────────────────
      leadCaptured: false,

      // ── UI state ──────────────────────────────────────────────────────
      phase: 'intro',   // intro | questions | submitting | results | lead | full-results
      isLoading: false,
      error: null,
      startedAt: null,

      // ── Session ID ────────────────────────────────────────────────────
      sessionId: crypto.randomUUID(),

      // ─── Actions ────────────────────────────────────────────────────────

      setAssessment: (assessment, blocks) => {
        const { assessmentId: storedId, allQuestions: storedQs, reset } = get();
        
        const newQs = (blocks || []).flatMap(b => (b.questions || []).map(q => ({ 
          ...q, 
          blockId: b.id, 
          blockTitle: b.title, 
          blockColor: b.color, 
          blockIcon: b.icon,
          blockWeight: b.weight  // Include block weight for scoring
        })));

        // Session Guard: If ID changed OR question count mismatched OR question IDs mismatched, clear stale state
        const idMismatch = storedId && assessment.id && Number(assessment.id) !== Number(storedId);
        const countMismatch = storedId && assessment.id && storedQs.length > 0 && storedQs.length !== newQs.length;
        
        // Deep Question Check: If the first few question IDs don't match, we definitely have stale data
        const idSetMismatch = storedId && assessment.id && storedQs.length > 0 && newQs.length > 0 && 
                               storedQs[0].id !== newQs[0].id;

        if (idMismatch || countMismatch || idSetMismatch) {
          reset();
        }

        // Only commit updates to memory if it's the first load or an actual change
        if (storedId === assessment.id && get().allQuestions.length > 0 && !countMismatch && !idSetMismatch) {
          return;
        }

        set({
          assessment,
          blocks,
          assessmentId: assessment.id,
          allQuestions: newQs,
        });
      },

      startAssessment: () => set({
        phase: 'questions',
        currentBlock: 0,
        currentQuestion: 0,
        startedAt: Date.now(),
      }),

      setAnswer: (questionId, value) => set(state => ({
        answers: { ...state.answers, [questionId]: value },
      })),

      goNext: () => {
        const { allQuestions, currentQuestion } = get();
        if (currentQuestion < allQuestions.length - 1) {
          set({ currentQuestion: currentQuestion + 1 });
        }
      },

      goPrev: () => {
        const { currentQuestion } = get();
        if (currentQuestion > 0) {
          set({ currentQuestion: currentQuestion - 1 });
        }
      },

      goToQuestion: (index) => set({ currentQuestion: Math.max(0, index) }),

      submitAssessment: async () => {
        const { answers, assessment, startedAt, sessionId } = get();
        set({ phase: 'submitting', isLoading: true, error: null });

        try {
          const duration = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
          const leadGateEnabled = window.dapConfig?.leadGate ?? true;
          const res = await api.post('/submit', {
            assessment_id:    assessment.id,
            answers,
            session_uuid:     sessionId,
            duration_seconds: duration,
            utm_source:       new URLSearchParams(location.search).get('utm_source') || '',
            utm_medium:       new URLSearchParams(location.search).get('utm_medium') || '',
            utm_campaign:     new URLSearchParams(location.search).get('utm_campaign') || '',
            is_preview:       leadGateEnabled,
          });

          // 1. Commit result to store first
          const resultData = res.data || res;
          set({
            result:         resultData,
            submissionUuid: resultData.uuid || null,
            submissionId:   resultData.submission_id || null,
            isLoading:      false
          });

          // 2. Mandatory Stability Delay (Ensure React reconciles the Result payload)
          await new Promise(r => setTimeout(r, 600));

          // 3. Transition to Results phase
          set({ phase: resultData.require_lead ? 'results' : 'full-results' });

        } catch (err) {
          set({ 
            error: err.message || 'The server encountered an issue while processing your report.', 
            phase: 'questions',
            isLoading: false
          });
        }
      },

      submitLead: async (leadData) => {
        set({ isLoading: true, error: null });
        try {
          let { submissionId, answers, assessment, sessionId, startedAt } = get();

          // Ensure the assessment is persisted to the DB if it was skipped (preview mode)
          if (!submissionId) {
            const duration = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
            const res = await api.post('/submit', {
              assessment_id:    assessment.id,
              answers,
              session_uuid:     sessionId,
              duration_seconds: duration,
              utm_source:       new URLSearchParams(location.search).get('utm_source') || '',
              utm_medium:       new URLSearchParams(location.search).get('utm_medium') || '',
              utm_campaign:     new URLSearchParams(location.search).get('utm_campaign') || '',
              is_preview:       false,
            });
            
            const resultData = res.data || res;
            submissionId = resultData.submission_id;
            set({ submissionId, submissionUuid: resultData.uuid });
          }

          // Save lead metrics
          await api.post('/lead', {
            ...leadData,
            submission_id: submissionId,
          });
          set({ leadCaptured: true, phase: 'full-results', isLoading: false });
        } catch (err) {
          set({ error: err.message, isLoading: false });
          throw err;
        }
      },

      reset: () => set({
        phase: 'intro',
        answers: {},
        result: null,
        submissionUuid: null,
        submissionId: null,
        leadCaptured: false,
        currentBlock: 0,
        currentQuestion: 0,
        startedAt: null,
        error: null,
        sessionId: crypto.randomUUID(),
      }),

      // ─── Computed ─────────────────────────────────────────────────────

      get currentQ() {
        const { allQuestions, currentQuestion } = get();
        return allQuestions[currentQuestion] || null;
      },

      get progress() {
        const { allQuestions, currentQuestion } = get();
        return allQuestions.length > 0
          ? Math.round((currentQuestion / allQuestions.length) * 100)
          : 0;
      },

      get answeredCount() {
        return Object.keys(get().answers).length;
      },

      get isCurrentAnswered() {
        const q = get().currentQ;
        return q ? get().answers[q.id] !== undefined : false;
      },
    }),
    {
      name:    'dap-session',
      storage: createJSONStorage(() => localStorage),
      // Only persist answers + progress (not transient UI state).
      partialize: (state) => ({
        answers:         state.answers,
        currentQuestion: state.currentQuestion,
        sessionId:       state.sessionId,
        startedAt:       state.startedAt,
        phase:           state.phase === 'submitting' ? 'questions' : state.phase,
        result:          state.result,
        submissionUuid:  state.submissionUuid,
        submissionId:    state.submissionId,
        leadCaptured:    state.leadCaptured,
      }),
    }
  )
);

if (typeof window !== 'undefined') {
  window.__dapStore = useAssessmentStore;
}
