import React, { useState, useCallback, useEffect } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient, useIsFetching } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, ClipboardList, Users, BarChart3,
  Settings, Plus, Edit2, Trash2, Copy, Eye,
  Download, Upload, GripVertical, X, Check,
  ChevronUp, ChevronDown, Search, RefreshCw, Shuffle,
  ToggleLeft, ToggleRight, AlertTriangle, TrendingUp, TrendingDown,
  FileText, Mail, Globe, Settings2, Building2, Save, Info
} from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, CartesianGrid, PieChart, Pie, Cell
} from 'recharts';
import { api } from './store/assessmentStore';
import DashboardPage from './components/Admin/DashboardPage';
import ContentManagement from './components/Admin/ContentManagement';
import ConfirmModal from './components/Admin/shared/ConfirmModal';
import Pagination from './components/Admin/shared/Pagination';
import ModalPortal from './components/Admin/shared/ModalPortal';
import ErrorBoundary from './components/Admin/shared/ErrorBoundary';

const adm = window.dapAdmin || {};
const API_BASE = adm.apiUrl || '/wp-json/assessment/v1';

// Query client configuration with on-demand synchronization
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      refetchInterval: false,
      refetchOnWindowFocus: true,
      refetchIntervalInBackground: false,
      retry: 1,
    },
  },
});

function AutoSyncBadge() {
  const qc = useQueryClient();
  const isFetching = useIsFetching();
  const [manualSyncing, setManualSyncing] = useState(false);

  const handleSync = async () => {
    setManualSyncing(true);
    try {
      await qc.refetchQueries();
    } catch {
      // Ignore
    } finally {
      setTimeout(() => setManualSyncing(false), 600);
    }
  };

  const isSyncing = isFetching > 0 || manualSyncing;

  return (
    <button
      type="button"
      className={`dap-sync-badge ${isSyncing ? 'dap-sync-badge--syncing' : ''}`}
      onClick={handleSync}
      title="Live Auto-Sync active (syncs every 15s). Click to sync immediately."
    >
      <div className="dap-sync-badge__pulse" />
      <RefreshCw size={12} className={isSyncing ? 'adap-spin' : ''} />
      <span>{isSyncing ? 'Syncing...' : 'Auto Sync'}</span>
    </button>
  );
}

// ─── Toast System ─────────────────────────────────────────────────────────────
const ToastContext = React.createContext(null);
function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);
  return (
    <ToastContext.Provider value={add}>
      {children}
      <div className="adap-toast-container">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 60, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.9 }}
              className="adap-toast"
              style={{
                background: t.type === 'error' ? 'var(--adap-danger)' : 'var(--adap-success)',
              }}
            >
              <span className="adap-toast__message">{t.msg}</span>
              <button
                onClick={() => setToasts(t => t.filter(x => x.id !== t.id))}
                className="adap-toast__close"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
const useToast = () => React.useContext(ToastContext);

// ─── Root Admin App ───────────────────────────────────────────────────────────
export default function AdminApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </QueryClientProvider>
  );
}

// ─── Shell (Sidebar + Routing) ────────────────────────────────────────────────
const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'assessments', label: 'Assessments', icon: ClipboardList },
  { key: 'builder', label: 'Builder', icon: Edit2 },
  { key: 'submissions', label: 'Submissions', icon: Users },
  { key: 'leads', label: 'Leads', icon: Users },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'settings', label: 'Settings', icon: Settings },
];

const PAGE_TITLES = {
  dashboard: 'Dashboard', assessments: 'Assessments', builder: 'Assessment Builder',
  submissions: 'Submissions', leads: 'Leads', analytics: 'Analytics', settings: 'Settings',
};

function Shell() {
  // Parse initial page from URL hash (e.g., #content)
  const getInitialPage = () => {
    const hash = window.location.hash?.slice(1);
    const validPages = NAV.map(n => n.key);
    return validPages.includes(hash) ? hash : 'dashboard';
  };

  const [page, setPage] = useState(getInitialPage);
  const [builderAssessmentId, setBuilderAssessmentId] = useState(null);
  const caps = adm.currentUser?.caps || {};

  // Sync page state with URL hash
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash?.slice(1);
      const validPages = NAV.map(n => n.key);
      if (hash && validPages.includes(hash)) {
        setPage(hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Update URL hash when page changes
  useEffect(() => {
    if (window.location.hash !== `#${page}`) {
      window.location.hash = page;
    }
  }, [page]);

  const openBuilder = (id) => { setBuilderAssessmentId(id); setPage('builder'); };

  const PAGES = {
    dashboard: <ErrorBoundary fallbackMessage="Failed to load dashboard. Please try again."><DashboardPage /></ErrorBoundary>,
    assessments: <ErrorBoundary fallbackMessage="Failed to load assessments. Please try again."><AssessmentsPage onEdit={openBuilder} /></ErrorBoundary>,
    builder: <ErrorBoundary fallbackMessage="Failed to load builder. Please try again."><BuilderPage assessmentId={builderAssessmentId} /></ErrorBoundary>,
    submissions: <ErrorBoundary fallbackMessage="Failed to load submissions. Please try again."><SubmissionsPage /></ErrorBoundary>,
    leads: <ErrorBoundary fallbackMessage="Failed to load leads. Please try again."><LeadsPage /></ErrorBoundary>,
    analytics: <ErrorBoundary fallbackMessage="Failed to load analytics. Please try again."><AnalyticsPage /></ErrorBoundary>,
    settings: <ErrorBoundary fallbackMessage="Failed to load settings. Please try again."><SettingsPage /></ErrorBoundary>,
  };

  return (
    <div className="dap-admin adap-fade-in">
      {/* 10/10 Navigation Bar */}
      <header className="dap-admin__header">
        <div className="dap-header__top">
          <div className="adap-header-logo">
            <div className="adap-header-logo__icon">
              <BarChart3 size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="adap-header-title">Digital Assessment Pro</h1>
              <span className="adap-header-subtitle">Admin Dashboard</span>
            </div>
          </div>

          <div className="adap-flex adap-items-center adap-gap-6">
            <AutoSyncBadge />
            <div className="adap-user-info__divider">
              <div className="adap-user-info__text">
                <div className="adap-user-info__name">{adm.currentUser?.display_name || 'Admin'}</div>
                <div className="adap-user-info__role">{adm.currentUser?.role ? adm.currentUser.role.charAt(0).toUpperCase() + adm.currentUser.role.slice(1) : 'Administrator'}</div>
              </div>
              <div className="dap-topbar__avatar">{(adm.currentUser?.display_name || 'A')[0].toUpperCase()}</div>
            </div>
          </div>
        </div>

        <nav className="dap-header__nav">
          {NAV.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`dap-nav__item ${page === key ? 'dap-nav__item--active' : ''}`}
              onClick={() => setPage(key)}
            >
              <Icon size={16} strokeWidth={page === key ? 2.5 : 2} />
              {label}
              {page === key && <motion.div layoutId="nav-ink" className="dap-nav__ink" />}
            </button>
          ))}
        </nav>
      </header>

      {/* Main Content (Fluid) */}
      <main className="dap-admin__main">
        <div className="dap-admin__content adap-fade-in">
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            >
              {PAGES[page] || <DashboardPage />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// ─── Assessments Page ─────────────────────────────────────────────────────────
function AssessmentsPage({ onEdit }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', description: '' });
  const [showPublish, setShowPublish] = useState(false);
  const [publishForm, setPublishForm] = useState({ id: null, changelog: '' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, danger: false });
  const [selectedIds, setSelectedIds] = useState([]);

  const { data: assessmentsResponse, isLoading } = useQuery({
    queryKey: ['assessments'],
    queryFn: () => api.get('/assessment?status=draft,published'),
  });
  const assessments = assessmentsResponse?.data || [];

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/assessment', data),
    onSuccess: () => { toast('Assessment created!'); qc.invalidateQueries(['assessments']); setShowCreate(false); setCreateForm({ title: '', description: '' }); },
    onError: (e) => toast(e.message, 'error'),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id) => api.post(`/assessment/${id}/duplicate`, {}),
    onSuccess: () => { toast('Duplicated!'); qc.invalidateQueries(['assessments']); },
    onError: (e) => toast(e.message, 'error'),
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, changelog }) => api.post(`/assessment/${id}/publish`, { changelog }),
    onSuccess: () => { toast('Published!', 'success'); qc.invalidateQueries(['assessments']); },
    onError: (e) => toast(e.message, 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/assessment/${id}`),
    onSuccess: () => { toast('Assessment deleted.'); qc.invalidateQueries(['assessments']); setSelectedIds([]); },
    onError: (e) => toast(e.message, 'error'),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids) => api.post('/assessment/bulk-delete', { ids }),
    onSuccess: (res) => { toast(`${res.data?.deleted || ids.length} assessments deleted.`); qc.invalidateQueries(['assessments']); setSelectedIds([]); },
    onError: (e) => toast(e.message, 'error'),
  });

  const handleSelectAll = () => {
    if (selectedIds.length === assessments.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(assessments.map(a => a.id));
    }
  };

  const handleSelectOne = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkDelete = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Selected Assessments',
      message: `Are you sure you want to delete ${selectedIds.length} selected assessment(s)? This action cannot be undone.`,
      onConfirm: () => bulkDeleteMutation.mutate(selectedIds),
      danger: true,
    });
  };

  return (
    <motion.div className="adap-fade-in" initial={{ opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }}>
      <div className="adap-page-header">
        <div>
          <h2 className="adap-page-title">
            Assessments
          </h2>
          <p className="adap-page-subtitle">
            Manage all {assessments.length} assessments.
          </p>
        </div>
        <div className="dap-page-header__actions">
          {selectedIds.length > 0 && (
            <button className="adap-btn adap-btn--danger" onClick={handleBulkDelete} disabled={bulkDeleteMutation.isPending}>
              <Trash2 size={16} /> Delete {selectedIds.length} Selected
            </button>
          )}
          <button className="adap-btn adap-btn--primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Create Assessment
          </button>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <ModalPortal>
          <AnimatePresence>
            <motion.div className="adap-modal-overlay dap-glass" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div className="adap-modal adap-modal--wide" initial={{ scale: .95, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: .95, y: 30 }}>
                <div className="adap-modal__header">
                  <span className="adap-modal__title"><Plus size={20} className="adap-modal__title-icon" /> Create Assessment</span>
                  <button className="adap-modal__close" onClick={() => setShowCreate(false)}><X size={18} /></button>
                </div>
                <div className="adap-modal__body">
                  <div className="adap-form-group">
                    <label className="adap-label">Title *</label>
                    <input className="adap-input" value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Engineering Maturity Assessment" />
                  </div>
                  <div className="adap-form-group">
                    <label className="adap-label">Description</label>
                    <textarea className="adap-input adap-textarea" value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe what this assessment measures…" />
                  </div>
                </div>
                <div className="adap-modal__footer">
                  <button className="adap-btn adap-btn--outline" onClick={() => setShowCreate(false)}><X size={16} /> Cancel</button>
                  <button className="adap-btn adap-btn--primary" onClick={() => createMutation.mutate(createForm)} disabled={!createForm.title || createMutation.isPending}>
                    {createMutation.isPending ? <span className="adap-btn__spinner" /> : <><Plus size={16} /> Create Assessment</>}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </ModalPortal>
      )}

      {/* Publish Modal */}
      {showPublish && (
        <ModalPortal>
          <AnimatePresence>
            <motion.div className="adap-modal-overlay dap-glass" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div className="adap-modal" initial={{ scale: .95, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: .95, y: 30 }}>
                <div className="adap-modal__header">
                  <span className="adap-modal__title">🚀 Publish Assessment</span>
                  <button className="adap-modal__close" onClick={() => setShowPublish(false)}><X size={18} /></button>
                </div>
                <div className="adap-modal__body">
                  <p className="adap-help-text">
                    Publishing creates a frozen snapshot of the current assessment version. This version will be used for all new submissions.
                  </p>
                  <div className="adap-form-group">
                    <label className="adap-label">Changelog (Optional)</label>
                    <textarea
                      className="adap-input adap-textarea"
                      value={publishForm.changelog}
                      onChange={e => setPublishForm(f => ({ ...f, changelog: e.target.value }))}
                      placeholder="e.g. Added 2 new questions to Strategy block, updated scoring weights..."
                      rows={4}
                    />
                  </div>
                </div>
                <div className="adap-modal__footer">
                  <button className="adap-btn adap-btn--outline" onClick={() => setShowPublish(false)}><X size={16} /> Cancel</button>
                  <button
                    className="adap-btn adap-btn--primary"
                    onClick={() => {
                      publishMutation.mutate({ id: publishForm.id, changelog: publishForm.changelog });
                      setShowPublish(false);
                      setPublishForm({ id: null, changelog: '' });
                    }}
                    disabled={publishMutation.isPending}
                  >
                    {publishMutation.isPending ? <span className="adap-btn__spinner" /> : <><Check size={16} /> Publish Version</>}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </ModalPortal>
      )}

      {isLoading ? <LoadingRow /> : (
        <div className="adap-table-wrap">
          <table className="adap-table">
            <thead>
              <tr>
                <th className="adap-th-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === assessments.length && assessments.length > 0}
                    onChange={handleSelectAll}
                    className="adap-checkbox"
                  />
                </th>
                <th>Assessment Name</th>
                <th>Status</th>
                <th>Shortcode</th>
                <th>Last Modified</th>
                <th className="adap-actions-cell">Management</th>
              </tr>
            </thead>
            <tbody>
              {assessments.length === 0 && (
                <tr><td colSpan={6} className="adap-table-empty">
                  <div className="adap-empty">
                    <div className="adap-empty__icon">📋</div>
                    <div className="adap-empty__title">No Assessments</div>
                    <div className="adap-empty__text">Create your first assessment to begin.</div>
                  </div>
                </td></tr>
              )}
              {assessments.map(a => (
                <tr key={a.id}>
                  <td className="adap-td-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(a.id)}
                      onChange={() => handleSelectOne(a.id)}
                      className="adap-checkbox"
                    />
                  </td>
                  <td>
                    <div className="adap-assessment-title">{a.title}</div>
                    <div className="adap-assessment-slug">{a.slug}</div>
                  </td>
                  <td><span className={`adap-badge adap-badge--${a.status}`}>{a.status}</span></td>
                  <td>
                    <div
                      className="adap-shortcode"
                      title="Click to copy shortcode"
                      onClick={() => {
                        const shortcode = `[dap_assessment id="${a.id}"]`;
                        navigator.clipboard.writeText(shortcode).then(() => {
                          toast('Shortcode copied to clipboard!');
                        }).catch(() => {
                          // Fallback for older browsers
                          const textArea = document.createElement('textarea');
                          textArea.value = shortcode;
                          textArea.style.position = 'fixed';
                          textArea.style.left = '-999999px';
                          document.body.appendChild(textArea);
                          textArea.focus();
                          textArea.select();
                          try {
                            document.execCommand('copy');
                            toast('Shortcode copied to clipboard!');
                          } catch (err) {
                            toast('Failed to copy', 'error');
                          }
                          textArea.remove();
                        });
                      }}
                    >
                      <span className="adap-shortcode__bracket">[dap_assessment id="</span>
                      <span className="adap-shortcode__id">{a.id}</span>
                      <span className="adap-shortcode__bracket">"]</span>
                    </div>
                  </td>
                  <td className="adap-last-modified">{a.updated_at?.slice(0, 10)}</td>
                  <td className="adap-actions-cell">
                    <div className="adap-actions-group">
                      {a.status === 'draft' && (
                        <button
                          className="adap-btn adap-btn--primary adap-btn--sm"
                          onClick={() => { setPublishForm({ id: a.id, changelog: '' }); setShowPublish(true); }}
                          title="Publish Assessment"
                        >
                          <Check size={13} /> Publish
                        </button>
                      )}
                      <button className="adap-btn adap-btn--outline adap-btn--sm" onClick={() => onEdit(a.id)} title="Edit"><Edit2 size={13} /></button>
                      <button className="adap-btn adap-btn--outline adap-btn--sm" onClick={() => duplicateMutation.mutate(a.id)} title="Duplicate"><Copy size={13} /></button>
                      <button
                        className="adap-btn adap-btn--danger adap-btn--sm"
                        onClick={() => setConfirmModal({
                          isOpen: true,
                          title: 'Delete Assessment',
                          message: `Are you sure you want to delete "${a.title}"? This assessment and all its data will be permanently removed. This action cannot be undone.`,
                          onConfirm: () => deleteMutation.mutate(a.id),
                          danger: true,
                        })}
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        danger={confirmModal.danger}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </motion.div>
  );
}

// ─── Builder Page ─────────────────────────────────────────────────────────────
function BuilderPage({ assessmentId }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [selectedQ, setSelectedQ] = useState(null);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, danger: false });
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await api.get(`/questions/export?assessment_id=${assessmentId}`);
      const data = response.data || [];
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(data, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `dap-assessment-${assessmentId}-export.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast('Assessment exported successfully!');
    } catch (err) {
      toast(err.message || 'Failed to export assessment', 'error');
    } finally {
      setExporting(false);
    }
  };

  const { data: blocks = [], isLoading } = useQuery({
    queryKey: ['questions', assessmentId],
    queryFn: async () => {
      const response = await api.get(`/questions?assessment_id=${assessmentId}`);
      return response.data || [];
    },
    enabled: !!assessmentId,
  });

  // Sync selectedBlock with fresh data when blocks update
  useEffect(() => {
    if (selectedBlock && Array.isArray(blocks)) {
      const freshBlock = blocks.find(b => b.id === selectedBlock.id);
      if (freshBlock) {
        setSelectedBlock(freshBlock);
      }
    }
  }, [blocks, selectedBlock?.id]);

  // Sync selectedQ with fresh data when selectedBlock updates
  useEffect(() => {
    if (selectedQ && selectedBlock) {
      const freshQuestion = (selectedBlock.questions || []).find(q => q.id === selectedQ.id);
      if (freshQuestion) {
        setSelectedQ(freshQuestion);
      }
    }
  }, [selectedBlock?.questions, selectedQ?.id]);

  const createBlock = useMutation({
    mutationFn: (data) => api.post('/blocks', { assessment_id: assessmentId, ...data }),
    onSuccess: () => { toast('Block created'); qc.invalidateQueries(['questions']); },
    onError: (e) => toast(e.message, 'error'),
  });

  const updateBlock = useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/blocks/${id}`, data),
    onSuccess: async () => {
      toast('Block saved');
      await qc.invalidateQueries({ queryKey: ['questions'] });
      await qc.refetchQueries({ queryKey: ['questions'] });
    },
    onError: (e) => toast(e.message, 'error'),
  });

  const deleteBlock = useMutation({
    mutationFn: (id) => api.delete(`/blocks/${id}`),
    onSuccess: () => { toast('Block deleted'); qc.invalidateQueries(['questions']); setSelectedBlock(null); },
    onError: (e) => toast(e.message, 'error'),
  });

  const addQuestionMutation = useMutation({
    mutationFn: (data) => api.post('/questions', data),
    onSuccess: () => { toast('Question added!'); qc.invalidateQueries(['questions']); },
    onError: (e) => toast(e.message, 'error'),
  });

  const updateQuestionMutation = useMutation({
    mutationFn: ({ id, ...data }) => {
      if (typeof id === 'string' && id.startsWith('block:')) {
        return api.put(`/blocks/${id.replace('block:', '')}`, data);
      }
      return api.put(`/questions/${id}`, data);
    },
    onSuccess: async () => {
      toast('Saved!');
      await qc.invalidateQueries({ queryKey: ['questions'] });
      await qc.refetchQueries({ queryKey: ['questions'] });
    },
    onError: (e) => toast(e.message, 'error'),
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (id) => api.delete(`/questions/${id}`),
    onSuccess: () => { toast('Deleted.'); qc.invalidateQueries(['questions']); setSelectedQ(null); },
    onError: (e) => toast(e.message, 'error'),
  });

  const importMutation = useMutation({
    mutationFn: (questions) => api.post('/questions/import', { assessment_id: assessmentId, questions }),
    onSuccess: (d) => { toast(`Imported ${d.imported} questions!`); qc.invalidateQueries(['questions']); setShowImport(false); },
    onError: (e) => toast(e.message, 'error'),
  });

  const [showReorderBlocks, setShowReorderBlocks] = useState(false);
  const [draggedBlockId, setDraggedBlockId] = useState(null);
  const [dragOverBlockId, setDragOverBlockId] = useState(null);

  const reorderQuestionsMutation = useMutation({
    mutationFn: (items) => api.post('/questions/reorder', { items }),
    onSuccess: () => { toast('Questions reordered!'); qc.invalidateQueries(['questions']); },
    onError: (e) => toast(e.message, 'error'),
  });

  const reorderBlocksMutation = useMutation({
    mutationFn: (items) => api.post('/blocks/reorder', { items }),
    onSuccess: () => { toast('Block sequence updated!'); qc.invalidateQueries(['questions']); },
    onError: (e) => toast(e.message, 'error'),
  });

  const handleMoveBlock = (index, direction, e) => {
    e?.stopPropagation();
    const blocksList = Array.from(blocks);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocksList.length) return;

    const [moved] = blocksList.splice(index, 1);
    blocksList.splice(targetIndex, 0, moved);

    const items = blocksList.map((b, idx) => ({ id: b.id, order: idx + 1 }));
    reorderBlocksMutation.mutate(items);
  };

  const handleBlockDragStart = (e, id) => {
    setDraggedBlockId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(id));
  };

  const handleBlockDragOver = (e, id) => {
    e.preventDefault();
    if (id !== draggedBlockId) {
      setDragOverBlockId(id);
    }
  };

  const handleBlockDrop = (e, targetId) => {
    e.preventDefault();
    setDragOverBlockId(null);
    if (!draggedBlockId || draggedBlockId === targetId) {
      setDraggedBlockId(null);
      return;
    }
    const blocksList = Array.from(blocks);
    const fromIdx = blocksList.findIndex(b => String(b.id) === String(draggedBlockId));
    const toIdx = blocksList.findIndex(b => String(b.id) === String(targetId));

    if (fromIdx !== -1 && toIdx !== -1) {
      const [moved] = blocksList.splice(fromIdx, 1);
      blocksList.splice(toIdx, 0, moved);

      const items = blocksList.map((b, idx) => ({ id: b.id, order: idx + 1 }));
      reorderBlocksMutation.mutate(items);
    }
    setDraggedBlockId(null);
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importText);
      const qs = Array.isArray(parsed) ? parsed : parsed.questions;
      importMutation.mutate(qs);
    } catch {
      toast('Invalid JSON format', 'error');
    }
  };

  if (!assessmentId) return (
    <div className="adap-empty">
      <div className="adap-empty__icon">🔧</div>
      <div className="adap-empty__title">No assessment selected</div>
      <div className="adap-empty__text">Go to Assessments and click Edit to open the builder.</div>
    </div>
  );

  if (isLoading) return <LoadingRow />;

  const allQuestions = Array.isArray(blocks) ? blocks.flatMap(b => (b.questions || []).map(q => ({ ...q, blockTitle: b.title }))) : [];

  // Dynamic Max Score Calculation: Sum of (MaxOptionScore * BlockWeight)
  const assessmentMax = (Array.isArray(blocks) ? blocks : []).reduce((acc, b) => {
    const blockWeight = parseFloat(b.weight) || 1.0;
    const qMax = (b.questions || []).reduce((qAcc, q) => {
      const maxOpt = (q.options || []).reduce((m, o) => Math.max(m, parseFloat(o.score_value) || 0), 0);
      return qAcc + maxOpt;
    }, 0);
    return acc + (qMax * blockWeight);
  }, 0);

  return (
    <motion.div className="adap-fade-in" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
      <div className="adap-builder-header">
        <div>
          <h2 className="adap-builder-title">
            Assessment Builder
          </h2>
          <p className="adap-page-subtitle">
            Add blocks and questions to build your assessment.
          </p>
        </div>
        <div className="adap-builder-actions">
          <button className="adap-btn adap-btn--outline" onClick={() => setShowReorderBlocks(true)} title="Reorder Sequence of Blocks">
            <GripVertical size={14} /> Reorder Blocks
          </button>
          <button className="adap-btn adap-btn--outline" onClick={handleExport} disabled={exporting}>
            {exporting ? <span className="adap-btn__spinner" /> : <><Download size={14} /> Export Assessment</>}
          </button>
          <button className="adap-btn adap-btn--outline" onClick={() => setShowImport(true)}><Upload size={14} /> Bulk Import</button>
          <button className="adap-btn adap-btn--primary" onClick={() => createBlock.mutate({ title: 'New Block', weight: 1.0 })}><Plus size={14} /> Add Block</button>
        </div>
      </div>

      <div className="dap-builder">
        {/* Block Navigator */}
        <div className="adap-card adap-card--builder-nav">
          <div className="adap-card__header-sm" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="adap-card__header-label">Blocks ({blocks.length})</span>
            <button
              type="button"
              className="adap-btn adap-btn--outline adap-btn--sm"
              onClick={() => setShowReorderBlocks(true)}
              style={{ fontSize: '11px', padding: '4px 8px', height: '26px' }}
              title="Reorder Block Sequence"
            >
              <GripVertical size={13} /> Reorder
            </button>
          </div>
          <div className="adap-builder-blocks">
            {(Array.isArray(blocks) ? blocks : []).map((block, index) => (
              <div
                key={block.id}
                draggable
                onDragStart={(e) => handleBlockDragStart(e, block.id)}
                onDragOver={(e) => handleBlockDragOver(e, block.id)}
                onDragLeave={() => setDragOverBlockId(null)}
                onDrop={(e) => handleBlockDrop(e, block.id)}
                className={`adap-builder-block ${selectedBlock?.id === block.id ? 'adap-builder-block--active' : ''}`}
                onClick={() => { setSelectedBlock(block); setSelectedQ(null); }}
                style={{
                  position: 'relative',
                  borderTop: dragOverBlockId === block.id ? '2px solid #6366F1' : undefined
                }}
              >
                <div className="adap-flex adap-justify-between adap-items-center">
                  <div className="adap-flex adap-items-center adap-gap-2">
                    <GripVertical size={14} style={{ color: '#94A3B8', cursor: 'grab' }} />
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748B', minWidth: '16px' }}>
                      #{index + 1}
                    </span>
                    <div className={`adap-builder-block__title ${selectedBlock?.id === block.id ? 'adap-builder-block__title--active' : ''}`}>
                      {block.title}
                    </div>
                  </div>

                  <div className="adap-flex adap-items-center adap-gap-1">
                    <button
                      type="button"
                      disabled={index === 0 || reorderBlocksMutation.isPending}
                      onClick={(e) => handleMoveBlock(index, 'up', e)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '2px 4px',
                        cursor: index === 0 ? 'not-allowed' : 'pointer',
                        opacity: index === 0 ? 0.2 : 0.7,
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title="Move Up"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={index === blocks.length - 1 || reorderBlocksMutation.isPending}
                      onClick={(e) => handleMoveBlock(index, 'down', e)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '2px 4px',
                        cursor: index === blocks.length - 1 ? 'not-allowed' : 'pointer',
                        opacity: index === blocks.length - 1 ? 0.2 : 0.7,
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title="Move Down"
                    >
                      <ChevronDown size={14} />
                    </button>
                    <div className={`adap-builder-block__weight ${selectedBlock?.id === block.id ? 'adap-builder-block__weight--active' : ''}`}>
                      {block.weight}X
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Configuration Canvas */}
        <div className="adap-builder-editor">
          {selectedQ ? (
            <QuestionEditor
              question={selectedQ}
              onSave={(data) => {
                if (selectedQ.id === 'new') {
                  addQuestionMutation.mutate({ ...data, block_id: selectedBlock.id, assessment_id: assessmentId });
                } else {
                  updateQuestionMutation.mutate({ id: selectedQ.id, ...data });
                }
                setSelectedQ(null);
              }}
              onDelete={() => {
                if (selectedQ.id !== 'new') {
                  deleteQuestionMutation.mutate(selectedQ.id);
                }
                setSelectedQ(null);
              }}
              isSaving={addQuestionMutation.isPending || updateQuestionMutation.isPending}
            />
          ) : selectedBlock ? (
            <DimensionEditor
              block={selectedBlock}
              onSave={(data) => updateBlock.mutate({ id: selectedBlock.id, ...data })}
              onDelete={() => setConfirmModal({
                isOpen: true,
                title: 'Delete Block',
                message: `Are you sure you want to delete "${selectedBlock.title}"? This will also delete all ${selectedBlock.questions?.length || 0} questions in this block. This action cannot be undone.`,
                onConfirm: () => deleteBlock.mutate(selectedBlock.id),
                danger: true,
              })}
              onAddQuestion={() => setSelectedQ({ id: 'new', question_text: '', question_type: 'single', options: [{ option_text: 'Option 1', score_value: 1 }] })}
              onEditQuestion={setSelectedQ}
              onReorderQuestions={(items) => reorderQuestionsMutation.mutate(items)}
              isSaving={updateBlock.isPending}
              onClose={() => setSelectedBlock(null)}
            />
          ) : (
            <HubSpotSettings assessmentId={assessmentId} />
          )}
        </div>
      </div>

      {showImport && (
        <ModalPortal>
          <AnimatePresence>
            <motion.div className="adap-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div className="adap-modal" initial={{ scale: .95, y: 20 }} animate={{ scale: 1, y: 0 }}>
                <div className="adap-modal__header">
                  <span className="adap-modal__title"><Upload size={20} className="adap-modal__title-icon" /> Import Assessment Data</span>
                  <button className="adap-modal__close" onClick={() => setShowImport(false)}><X size={18} /></button>
                </div>
                <div className="adap-modal__body">
                  <p className="adap-help-text adap-mb-4">Paste your assessment JSON data below. The import will create dimensions and questions automatically.</p>
                  <textarea
                    className="adap-import-textarea"
                    rows={12}
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                    placeholder='[{"block":"Strategy","question":"Sample question?","type":"single","options":[{"text":"Option 1","score":5}]}]'
                  />
                </div>
                <div className="adap-modal__footer">
                  <button className="adap-btn adap-btn--outline" onClick={() => setShowImport(false)}><X size={16} /> Cancel</button>
                  <button className="adap-btn adap-btn--primary" onClick={handleImport} disabled={importMutation.isPending}>
                    {importMutation.isPending ? <span className="adap-btn__spinner" /> : <><Upload size={16} /> Import Data</>}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </ModalPortal>
      )}

      {/* Reorder Blocks Modal */}
      <ReorderBlocksModal
        blocks={blocks}
        isOpen={showReorderBlocks}
        onClose={() => setShowReorderBlocks(false)}
        onSave={(payload) => {
          reorderBlocksMutation.mutate(payload);
          setShowReorderBlocks(false);
        }}
        isSaving={reorderBlocksMutation.isPending}
      />

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        danger={confirmModal.danger}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </motion.div>
  );
}

function DimensionEditor({ block, onSave, onDelete, onAddQuestion, onEditQuestion, onReorderQuestions, isSaving, onClose }) {
  const [title, setTitle] = useState(block.title);
  const [weight, setWeight] = useState(block.weight || 1.0);
  const [questions, setQuestions] = useState(block.questions || []);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  // Sync all state when block changes
  useEffect(() => {
    setTitle(block.title);
    setWeight(block.weight || 1.0);
    setQuestions(block.questions || []);
  }, [block.id, block.title, block.weight, block.questions]);

  const handleDragStart = (e, id) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e, id) => {
    e.preventDefault();
    if (id !== draggedId) {
      setDragOverId(id);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    setDragOverId(null);

    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    const newQuestions = [...questions];
    const draggedIdx = newQuestions.findIndex(q => q.id === draggedId);
    const targetIdx = newQuestions.findIndex(q => q.id === targetId);

    if (draggedIdx === -1 || targetIdx === -1) {
      setDraggedId(null);
      return;
    }

    // Reorder array
    const [removed] = newQuestions.splice(draggedIdx, 1);
    newQuestions.splice(targetIdx, 0, removed);

    // Update sort_order values
    const reordered = newQuestions.map((q, idx) => ({
      ...q,
      sort_order: idx,
    }));

    setQuestions(reordered);
    setDraggedId(null);

    // Call API with reordered items
    if (onReorderQuestions) {
      onReorderQuestions(reordered.map((q, idx) => ({
        id: q.id,
        order: idx,
        block_id: block.id,
      })));
    }
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Header */}
      <div className="adap-block-editor-header">
        <div>
          <span className="adap-block-editor-label">Block Settings</span>
          <h3 className="adap-block-editor-title">{block.title}</h3>
        </div>
        <div className="adap-block-editor-actions">
          <button className="adap-btn adap-btn--outline" onClick={onClose} title="Back to Assessment Settings">
            ← Settings
          </button>
          <button className="adap-btn adap-btn--outline adap-btn--icon" onClick={onDelete} title="Delete Block"><Trash2 size={18} /></button>
          <button className="adap-btn adap-btn--primary" onClick={() => onSave({ title, weight })} disabled={isSaving}>
            {isSaving ? <span className="adap-btn__spinner" /> : <><Check size={16} /> Save Changes</>}
          </button>
        </div>
      </div>

      <div className="adap-block-editor-body">
        <div className="adap-form-grid-2">
          <div className="adap-form-group">
            <label className="adap-label adap-label--primary">Block Title</label>
            <input className="adap-input adap-input--bold" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="adap-form-group">
            <label className="adap-label">Weight</label>
            <input type="number" className="adap-input" value={weight} onChange={e => setWeight(e.target.value)} step={0.1} min={0.1} max={5} />
          </div>
        </div>

        {/* Question Registry */}
        <div className="adap-questions-section">
          <div className="adap-questions-header">
            <h4 className="adap-questions-title">Questions</h4>
            <button className="adap-btn adap-btn--primary adap-btn--sm" onClick={onAddQuestion}>
              <Plus size={14} /> Add Question
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {questions.length === 0 && (
              <div style={{ padding: '40px', textAlign: 'center', background: 'var(--adap-slate-50)', borderRadius: '12px', border: '1.5px dashed var(--adap-border)' }}>
                <p style={{ color: 'var(--adap-slate-400)', fontSize: '0.9rem', fontWeight: 600 }}>No questions added for this block.</p>
              </div>
            )}
            {questions.map((q, index) => (
              <motion.div
                key={q.id}
                className="dap-question-card"
                draggable
                onDragStart={(e) => handleDragStart(e, q.id)}
                onDragOver={(e) => handleDragOver(e, q.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, q.id)}
                onDragEnd={handleDragEnd}
                whileHover={{ x: 5 }}
                animate={{
                  scale: draggedId === q.id ? 1.02 : 1,
                  opacity: draggedId === q.id ? 0.8 : 1,
                  borderColor: dragOverId === q.id ? 'var(--adap-primary)' : 'var(--adap-border)',
                  boxShadow: dragOverId === q.id ? '0 4px 12px rgba(99, 102, 241, 0.15)' : 'none',
                }}
                transition={{ duration: 0.15 }}
                style={{
                  padding: '20px 24px', background: '#fff', border: '1.5px solid var(--adap-border)', borderRadius: '12px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'grab', transition: 'all 0.2s'
                }}
                onClick={() => onEditQuestion(q)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: '10px',
                      background: draggedId === q.id ? 'var(--adap-primary)' : 'var(--adap-primary-light)',
                      color: draggedId === q.id ? '#fff' : 'var(--adap-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'grab',
                    }}
                  >
                    <GripVertical size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--adap-slate-900)' }}>{q.question_text}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--adap-slate-400)', marginTop: '4px', fontWeight: 600 }}>
                      Type: <span style={{ color: 'var(--adap-primary)' }}>{q.question_type}</span> • Options: {q.options?.length || 0} • Order: {index + 1}
                    </div>
                  </div>
                </div>
                <div className="dap-question-card__actions">
                  <button className="adap-btn adap-btn--outline adap-btn--sm" style={{ padding: '0 12px' }}>Edit</button>
                </div>
              </motion.div>
            ))}
          </div>
          {questions.length > 1 && (
            <p style={{ fontSize: '0.75rem', color: 'var(--adap-slate-400)', marginTop: '12px', fontStyle: 'italic' }}>
              💡 Drag and drop questions to reorder them
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function HubSpotSettings({ assessmentId }) {
  const [config, setConfig] = useState({
    hubspot_enabled: false,
    hubspot_use_global: true,
    hubspot_portal_id: '',
    hubspot_form_id: '',
    hubspot_region: 'na1',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!assessmentId) return;

    api.get(`/assessment/${assessmentId}/hubspot-config`)
      .then(data => {
        if (data.data) {
          setConfig({
            hubspot_enabled: data.data.enabled || false,
            hubspot_use_global: data.data.use_global !== false,
            hubspot_portal_id: data.data.portal_id || '',
            hubspot_form_id: data.data.form_id || '',
            hubspot_region: data.data.region || 'na1',
          });
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load configuration');
        setLoading(false);
      });
  }, [assessmentId]);

  // Get WordPress REST API nonce from various possible sources
  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await api.put(`/assessment/${assessmentId}/hubspot-config`, {
        hubspot_enabled: config.hubspot_enabled ? 1 : 0,
        hubspot_use_global: config.hubspot_use_global ? 1 : 0,
        hubspot_portal_id: config.hubspot_portal_id,
        hubspot_form_id: config.hubspot_form_id,
        hubspot_region: config.hubspot_region,
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const ToggleCard = ({ title, subtitle, checked, onChange, icon: Icon, color = 'primary' }) => {
    // Color definitions based on available CSS variables
    const colorMap = {
      primary: {
        bg: checked ? 'var(--adap-primary-light)' : 'white',
        border: checked ? 'var(--adap-primary)' : 'var(--adap-border)',
        iconBg: checked ? 'rgba(107, 70, 250, 0.15)' : 'var(--adap-slate-100)',
        iconColor: checked ? 'var(--adap-primary)' : 'var(--adap-slate-400)',
        toggle: checked ? 'var(--adap-primary)' : 'var(--adap-slate-300)',
      },
      info: {
        bg: checked ? 'rgba(99, 102, 241, 0.08)' : 'white',
        border: checked ? '#6366f1' : 'var(--adap-border)',
        iconBg: checked ? 'rgba(99, 102, 241, 0.15)' : 'var(--adap-slate-100)',
        iconColor: checked ? '#6366f1' : 'var(--adap-slate-400)',
        toggle: checked ? '#6366f1' : 'var(--adap-slate-300)',
      }
    };
    const colors = colorMap[color] || colorMap.primary;

    return (
      <div
        onClick={() => onChange(!checked)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: 20,
          background: colors.bg,
          borderRadius: 12,
          border: `2px solid ${colors.border}`,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: colors.iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
        }}>
          {Icon && <Icon size={24} color={colors.iconColor} />}
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 600, color: 'var(--adap-slate-800)', display: 'block', fontSize: '0.95rem' }}>
            {title}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--adap-slate-500)', marginTop: 2, display: 'block' }}>
            {subtitle}
          </span>
        </div>
        <div style={{
          width: 52,
          height: 28,
          borderRadius: 14,
          background: colors.toggle,
          position: 'relative',
          transition: 'all 0.2s ease',
        }}>
          <div style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            background: 'white',
            position: 'absolute',
            top: 2,
            left: checked ? 26 : 2,
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }} />
        </div>
      </div>
    );
  };

  const StatusBadge = ({ active, text }) => (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 12px',
      borderRadius: 20,
      fontSize: '0.75rem',
      fontWeight: 600,
      background: active ? 'rgba(16, 185, 129, 0.1)' : 'var(--adap-slate-100)',
      color: active ? '#059669' : 'var(--adap-slate-500)',
      border: active ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid transparent',
    }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        background: active ? '#10b981' : 'var(--adap-slate-400)',
      }} />
      {text}
    </span>
  );

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <div style={{
          width: 40,
          height: 40,
          border: '3px solid var(--adap-slate-100)',
          borderTop: '3px solid var(--adap-primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px',
        }} />
        <p style={{ color: 'var(--adap-slate-500)', fontSize: '0.9rem' }}>Loading configuration...</p>
      </div>
    );
  }

  return (
    <motion.div
      className="builder-page"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ padding: 'clamp(20px, 4vw, 40px) clamp(16px, 4vw, 48px)', maxWidth: 640 }}
    >
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--adap-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.12em'
          }}>
            Assessment Settings
          </span>
          <StatusBadge
            active={config.hubspot_enabled}
            text={config.hubspot_enabled ? (config.hubspot_use_global ? 'Using Global' : 'Custom Config') : 'Disabled'}
          />
        </div>
        <h2 style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          color: 'var(--adap-slate-900)',
          margin: 0,
          fontFamily: 'Lexend',
          letterSpacing: '-0.02em',
        }}>
          HubSpot Integration
        </h2>
        <p style={{ fontSize: '0.95rem', color: 'var(--adap-slate-500)', marginTop: 10, lineHeight: 1.5 }}>
          Configure how leads are captured and synced with your HubSpot CRM. Each assessment can use global settings or have its own custom configuration.
        </p>
      </div>

      {/* Success/Error Messages */}
      {saved && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: '12px 16px',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: 10,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: '#047857',
            fontSize: '0.9rem',
            fontWeight: 500,
          }}
        >
          <Check size={18} color="#10b981" />
          Settings saved successfully!
        </motion.div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: '12px 16px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: 10,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: '#b91c1c',
            fontSize: '0.9rem',
            fontWeight: 500,
          }}
        >
          <X size={18} color="#ef4444" />
          {error}
        </motion.div>
      )}

      {/* Main Toggle - Integration Enable */}
      <div style={{ marginBottom: 24 }}>
        <ToggleCard
          title="Enable HubSpot Integration"
          subtitle="Capture leads and send assessment results to HubSpot"
          checked={config.hubspot_enabled}
          onChange={(checked) => setConfig(c => ({ ...c, hubspot_enabled: checked }))}
          icon={Mail}
          color="primary"
        />
      </div>

      {/* Configuration Options */}
      <AnimatePresence mode="wait">
        {config.hubspot_enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Mode Selection */}
            <div style={{ marginBottom: 24 }}>
              <ToggleCard
                title="Use Global HubSpot Settings"
                subtitle="Inherit configuration from global plugin settings"
                checked={config.hubspot_use_global}
                onChange={(checked) => setConfig(c => ({ ...c, hubspot_use_global: checked }))}
                icon={Globe}
                color="info"
              />
            </div>

            {/* Custom Configuration */}
            <AnimatePresence mode="wait">
              {!config.hubspot_use_global && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.25 }}
                  style={{
                    background: 'white',
                    borderRadius: 16,
                    border: '1px solid var(--adap-border)',
                    padding: 28,
                    marginBottom: 24,
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 24,
                    paddingBottom: 20,
                    borderBottom: '1px solid var(--adap-slate-100)',
                  }}>
                    <Settings2 size={20} color="var(--adap-slate-600)" />
                    <h3 style={{
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: 'var(--adap-slate-800)',
                      margin: 0
                    }}>
                      Custom Configuration
                    </h3>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Portal ID */}
                    <div>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--adap-slate-700)',
                        marginBottom: 8,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em'
                      }}>
                        HubSpot Portal ID
                        <span style={{ color: 'var(--adap-error-500)' }}>*</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          className="adap-input"
                          value={config.hubspot_portal_id}
                          onChange={e => setConfig(c => ({ ...c, hubspot_portal_id: e.target.value }))}
                          placeholder="e.g., 12345678"
                          style={{
                            width: '100%',
                            paddingLeft: 44,
                          }}
                        />
                        <Building2 size={18} style={{
                          position: 'absolute',
                          left: 14,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: 'var(--adap-slate-400)',
                        }} />
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--adap-slate-500)', marginTop: 6, marginBottom: 0 }}>
                        Found in your HubSpot account settings
                      </p>
                    </div>

                    {/* Form ID */}
                    <div>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--adap-slate-700)',
                        marginBottom: 8,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em'
                      }}>
                        Form ID
                        <span style={{ color: 'var(--adap-error-500)' }}>*</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          className="adap-input"
                          value={config.hubspot_form_id}
                          onChange={e => setConfig(c => ({ ...c, hubspot_form_id: e.target.value }))}
                          placeholder="e.g., abc-def-ghi-jkl"
                          style={{
                            width: '100%',
                            paddingLeft: 44,
                          }}
                        />
                        <FileText size={18} style={{
                          position: 'absolute',
                          left: 14,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: 'var(--adap-slate-400)',
                        }} />
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--adap-slate-500)', marginTop: 6, marginBottom: 0 }}>
                        The HubSpot form GUID from your forms dashboard
                      </p>
                    </div>

                    {/* Region */}
                    <div>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--adap-slate-700)',
                        marginBottom: 8,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em'
                      }}>
                        <Globe size={14} />
                        Data Center Region
                      </label>
                      <div style={{ display: 'flex', gap: 12 }}>
                        {[
                          { value: 'na1', label: 'North America', flag: '🇺🇸' },
                          { value: 'eu1', label: 'Europe', flag: '🇪🇺' },
                        ].map((region) => (
                          <button
                            key={region.value}
                            onClick={() => setConfig(c => ({ ...c, hubspot_region: region.value }))}
                            style={{
                              flex: 1,
                              padding: '14px 16px',
                              borderRadius: 10,
                              border: `2px solid ${config.hubspot_region === region.value ? 'var(--adap-primary)' : 'var(--adap-border)'}`,
                              background: config.hubspot_region === region.value ? 'var(--adap-primary-light)' : 'white',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <span style={{ fontSize: '1.25rem' }}>{region.flag}</span>
                            <div style={{ textAlign: 'left' }}>
                              <div style={{
                                fontWeight: 600,
                                color: config.hubspot_region === region.value ? 'var(--adap-primary-dark)' : 'var(--adap-slate-700)',
                                fontSize: '0.9rem',
                              }}>
                                {region.label}
                              </div>
                              <div style={{
                                fontSize: '0.75rem',
                                color: config.hubspot_region === region.value ? 'var(--adap-primary)' : 'var(--adap-slate-400)',
                                textTransform: 'uppercase',
                              }}>
                                {region.value}
                              </div>
                            </div>
                            {config.hubspot_region === region.value && (
                              <Check size={16} style={{ marginLeft: 'auto', color: 'var(--adap-primary)' }} />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
        <button
          className="adap-btn adap-btn--primary"
          onClick={handleSave}
          disabled={saving}
          style={{
            height: 48,
            padding: '0 28px',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {saving ? (
            <>
              <span className="adap-btn__spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
              Saving...
            </>
          ) : (
            <>
              <Save size={18} />
              Save Changes
            </>
          )}
        </button>

        {saved && (
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            style={{
              color: '#059669',
              fontSize: '0.9rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Check size={16} />
            Saved
          </motion.span>
        )}
      </div>

      {/* Help Text */}
      <div style={{
        marginTop: 32,
        padding: 20,
        background: 'var(--adap-slate-50)',
        borderRadius: 12,
        border: '1px solid var(--adap-slate-100)',
      }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <Info size={20} color="var(--adap-slate-400)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--adap-slate-700)', fontWeight: 600 }}>
              Need help finding your HubSpot credentials?
            </p>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--adap-slate-500)', lineHeight: 1.5 }}>
              Portal ID: Settings → Account & Billing → Account Information{' '}
              <span style={{ color: 'var(--adap-slate-300)', margin: '0 6px' }}>|</span>{' '}
              Form ID: Marketing → Lead Capture → Forms
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function QuestionEditor({ question, onSave, onDelete, isSaving }) {
  const [form, setForm] = useState({
    question_text: question.question_text,
    helper_text: question.helper_text || '',
    question_type: question.question_type,
    is_required: question.is_required,
  });
  const [options, setOptions] = useState(Array.isArray(question.options) ? question.options : []);
  const [draggedOptionIdx, setDraggedOptionIdx] = useState(null);
  const [dragOverOptionIdx, setDragOverOptionIdx] = useState(null);

  // Reset form when question changes
  useEffect(() => {
    setForm({
      question_text: question.question_text,
      helper_text: question.helper_text || '',
      question_type: question.question_type,
      is_required: question.is_required,
    });
    setOptions(Array.isArray(question.options) ? question.options : []);
  }, [question.id, question.question_text, question.helper_text, question.question_type, question.is_required, question.options]);

  const addOption = () => {
    const nextScore = options.length > 0 ? (parseFloat(options[options.length - 1]?.score_value) || 0) + 1 : 0;
    setOptions(o => [...o, { option_text: '', text: '', score_value: nextScore }]);
  };
  const removeOption = (i) => setOptions(o => o.filter((_, idx) => idx !== i));
  const updateOption = (i, field, val) => setOptions(o => o.map((opt, idx) => idx === i ? { ...opt, [field]: val, ...(field === 'option_text' ? { text: val } : {}) } : opt));

  // Randomize / shuffle options order while keeping scores in their fixed slot positions
  const randomizeOptions = () => {
    if (options.length <= 1) return;
    const currentScores = options.map(opt => opt.score_value);
    const shuffled = [...options];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const randomizedWithFixedScores = shuffled.map((opt, idx) => ({
      ...opt,
      sort_order: idx,
      score_value: currentScores[idx] !== undefined ? currentScores[idx] : opt.score_value,
    }));
    setOptions(randomizedWithFixedScores);
  };

  // Drag and drop for options (reorders option text/content, keeping positional scores)
  const handleOptionDragStart = (e, index) => {
    setDraggedOptionIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleOptionDragOver = (e, index) => {
    e.preventDefault();
    if (index !== draggedOptionIdx) {
      setDragOverOptionIdx(index);
    }
  };

  const handleOptionDrop = (e, targetIndex) => {
    e.preventDefault();
    setDragOverOptionIdx(null);
    if (draggedOptionIdx === null || draggedOptionIdx === targetIndex) {
      setDraggedOptionIdx(null);
      return;
    }

    const currentScores = options.map(opt => opt.score_value);
    const newOptions = [...options];
    const [moved] = newOptions.splice(draggedOptionIdx, 1);
    newOptions.splice(targetIndex, 0, moved);

    // Keep scores in their slot positions (order options, not score)
    const optionsWithFixedScores = newOptions.map((opt, idx) => ({
      ...opt,
      sort_order: idx,
      score_value: currentScores[idx] !== undefined ? currentScores[idx] : opt.score_value,
    }));

    setOptions(optionsWithFixedScores);
    setDraggedOptionIdx(null);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      {/* Header */}
      <div style={{ marginTop: 28, padding: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid var(--adap-border)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--adap-primary)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Question Editor</span>
          <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--adap-slate-900)', margin: 0, fontFamily: 'Lexend', lineHeight: 1.3 }}>Edit Question</h3>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="adap-btn adap-btn--outline adap-btn--icon" onClick={onDelete} title="Delete Question" style={{ width: 38, height: 38 }}><Trash2 size={18} /></button>
          <button className="adap-btn adap-btn--primary" onClick={() => onSave({ ...form, options: options.map((opt, idx) => ({ ...opt, sort_order: idx })) })} disabled={isSaving} style={{ height: 38, padding: '0 16px' }}>
            {isSaving ? <span className="adap-btn__spinner" /> : <><Check size={16} style={{ marginRight: 6 }} /> Save</>}
          </button>
        </div>
      </div>

      {/* Form */}
      <div style={{ marginTop: 28, padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Question Text */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--adap-slate-600)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Question Text *</label>
          <textarea
            className="adap-input"
            value={form.question_text}
            onChange={e => setForm(f => ({ ...f, question_text: e.target.value }))}
            rows={3}
            style={{ minHeight: 90, resize: 'vertical', fontSize: '15px', lineHeight: 1.5 }}
          />
        </div>

        {/* Helper Text */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--adap-slate-600)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Helper Text</label>
          <input
            className="adap-input"
            value={form.helper_text}
            onChange={e => setForm(f => ({ ...f, helper_text: e.target.value }))}
            placeholder="Optional helper text shown below the question"
            style={{ fontSize: '14px' }}
          />
        </div>

        {/* Settings Grid */}
        <div className="adap-form-grid-2-inline">
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--adap-slate-600)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Question Type</label>
            <select className="adap-input adap-select" value={form.question_type} onChange={e => setForm(f => ({ ...f, question_type: e.target.value }))} style={{ height: 42 }}>
              <option value="single">Single Choice</option>
              <option value="multi">Multiple Choice</option>
              <option value="scale">Scale (1-10)</option>
              <option value="text">Text Input</option>
              <option value="boolean">Yes / No</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--adap-slate-600)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Required</label>
            <select className="adap-input adap-select" value={form.is_required} onChange={e => setForm(f => ({ ...f, is_required: parseInt(e.target.value) }))} style={{ height: 42 }}>
              <option value={1}>Yes - Required</option>
              <option value={0}>No - Optional</option>
            </select>
          </div>
        </div>
      </div>

      {/* Answer Options */}
      {['single', 'multi'].includes(form.question_type) && (
        <div style={{ marginTop: 28, padding: 24, background: 'var(--adap-slate-50)', borderRadius: 12, border: '1px solid var(--adap-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--adap-slate-600)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Answer Options & Scoring</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                className="adap-btn adap-btn--outline adap-btn--sm"
                onClick={randomizeOptions}
                title="Randomly change order of all options at once (preserves scoring structure)"
              >
                <Shuffle size={14} /> Randomize Order
              </button>
              <button
                type="button"
                className="adap-btn adap-btn--outline adap-btn--sm"
                onClick={addOption}
              >
                <Plus size={14} /> Add Option
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {options.map((opt, i) => (
              <div
                key={i}
                draggable
                onDragStart={(e) => handleOptionDragStart(e, i)}
                onDragOver={(e) => handleOptionDragOver(e, i)}
                onDragLeave={() => setDragOverOptionIdx(null)}
                onDrop={(e) => handleOptionDrop(e, i)}
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  padding: '4px 6px',
                  borderRadius: 8,
                  borderTop: dragOverOptionIdx === i ? '2px solid var(--adap-primary)' : '2px solid transparent',
                  background: dragOverOptionIdx === i ? 'var(--adap-primary-light)' : 'transparent',
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                  flexWrap: 'wrap',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'grab',
                    padding: '6px 4px',
                    color: '#94A3B8',
                    flexShrink: 0,
                  }}
                  title="Drag to reorder option"
                >
                  <GripVertical size={16} />
                </div>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--adap-primary-light)', color: 'var(--adap-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                <input className="adap-input" style={{ flex: '1 1 180px', minWidth: '140px' }} placeholder="Option text..." value={opt.option_text || opt.text || ''} onChange={e => updateOption(i, 'option_text', e.target.value)} />
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', border: '1.5px solid var(--adap-border)', borderRadius: 'var(--adap-radius-md)', padding: '0 12px', height: 42, flexShrink: 0 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--adap-primary)' }}>Score</span>
                  <input style={{ width: 50, border: 'none', padding: 0, height: '100%', textAlign: 'center', background: 'transparent', fontWeight: 600 }} type="number" value={opt.score_value ?? 0} onChange={e => updateOption(i, 'score_value', parseFloat(e.target.value))} min={0} max={10} step={1} />
                </div>
                <button type="button" className="adap-btn adap-btn--outline adap-btn--icon adap-btn--sm" onClick={() => removeOption(i)} style={{ flexShrink: 0 }} title="Remove Option"><X size={16} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Submissions Page ─────────────────────────────────────────────────────────
function SubmissionsPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [viewSubmission, setViewSubmission] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, danger: false });
  const [selectedIds, setSelectedIds] = useState([]);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['submissions', page],
    queryFn: () => api.get(`/submissions?page=${page}&per_page=20`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/submissions/${id}`),
    onSuccess: () => { toast('Submission deleted.'); qc.invalidateQueries(['submissions']); setSelectedIds([]); },
    onError: (e) => toast(e.message, 'error'),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids) => api.post('/submissions/bulk-delete', { ids }),
    onSuccess: (res) => { toast(`${res.data?.deleted || ids.length} submissions deleted.`); qc.invalidateQueries(['submissions']); setSelectedIds([]); },
    onError: (e) => toast(e.message, 'error'),
  });

  const handleSelectAll = () => {
    if (selectedIds.length === submissions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(submissions.map(s => s.id));
    }
  };

  const handleSelectOne = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkDelete = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Selected Submissions',
      message: `Are you sure you want to delete ${selectedIds.length} selected submission(s)? This action cannot be undone.`,
      onConfirm: () => bulkDeleteMutation.mutate(selectedIds),
      danger: true,
    });
  };

  const handleDelete = (id, closeModal = false) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Submission',
      message: 'Are you sure you want to delete this submission? This action cannot be undone.',
      onConfirm: () => {
        deleteMutation.mutate(id);
        if (closeModal) setViewSubmission(null);
      },
      danger: true,
    });
  };

  const submissions = data?.data || [];
  const total = data?.meta?.total || submissions.length;

  return (
    <motion.div className="adap-fade-in" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 950, color: 'var(--adap-slate-900)', letterSpacing: '-0.04em', fontFamily: "'Lexend', sans-serif" }}>
            Submissions
          </h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--adap-slate-500)', marginTop: '6px', fontWeight: 500 }}>
            View all {total || submissions.length} assessment submissions.
          </p>
        </div>
        {selectedIds.length > 0 && (
          <button className="adap-btn adap-btn--danger" onClick={handleBulkDelete} disabled={bulkDeleteMutation.isPending}>
            <Trash2 size={16} /> Delete {selectedIds.length} Selected
          </button>
        )}
      </div>
      {isLoading ? <LoadingRow /> : (
        <div className="adap-table-wrap">
          <table className="adap-table">
            <thead>
              <tr>
                <th className="adap-th-narrow">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === submissions.length && submissions.length > 0}
                    onChange={handleSelectAll}
                    className="adap-checkbox"
                  />
                </th>
                <th className="adap-col-uuid">UUID</th>
                <th className="adap-col-email">Email</th>
                <th className="adap-col-score">Score</th>
                <th className="adap-col-level">Level</th>
                <th className="adap-col-status">Status</th>
                <th className="adap-col-date">Date</th>
                <th className="adap-col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.length === 0 && <tr><td colSpan={8} className="adap-table-no-data">No submissions found.</td></tr>}
              {submissions.map(s => (
                <tr key={s.id}>
                  <td className="adap-td-narrow">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(s.id)}
                      onChange={() => handleSelectOne(s.id)}
                      className="adap-checkbox"
                    />
                  </td>
                  <td className="adap-col-uuid">#{s.uuid?.slice(0, 8)}</td>
                  <td className="adap-col-email">{s.email || <span className="adap-text-muted">—</span>}</td>
                  <td className="adap-col-score">
                    <div className="adap-score-primary">
                      {s.normalized_score ? `${Math.round(s.normalized_score)}` : '—'}
                    </div>
                  </td>
                  <td className="adap-col-level">{s.score_level ? <LevelBadge level={s.score_level} /> : '—'}</td>
                  <td className="adap-col-status">
                    <span className={`adap-badge adap-badge--${s.status === 'completed' ? 'published' : 'draft'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="adap-col-date">{s.completed_at || '—'}</td>
                  <td>
                    <div className="adap-actions-group">
                      <button className="adap-btn adap-btn--outline adap-btn--sm adap-btn--icon" onClick={() => setViewSubmission(s)} title="View Details">
                        <Eye size={14} />
                      </button>
                      <button className="adap-btn adap-btn--danger adap-btn--sm adap-btn--icon" onClick={() => handleDelete(s.id)} title="Delete Submission">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {total > 20 && <Pagination page={page} total={total} perPage={20} onChange={setPage} />}
        </div>
      )}

      {/* Submission Detail Modal */}
      {viewSubmission && (
        <ModalPortal>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(8px)',
              zIndex: 100000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 20px',
            }}
            onClick={() => setViewSubmission(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              style={{
                background: '#fff',
                borderRadius: '16px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
                width: '100%',
                maxWidth: '900px',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div className="adap-modal__header">
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--adap-primary)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Submission Details</span>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--adap-slate-900)', marginTop: 4, fontFamily: 'Lexend' }}>#{viewSubmission.uuid?.slice(0, 8)}</h3>
                </div>
                <button className="adap-btn adap-btn--outline adap-btn--icon" onClick={() => setViewSubmission(null)} style={{ width: 36, height: 36 }}><X size={18} /></button>
              </div>
              <div className="adap-modal__body">
                <div className="adap-modal-grid-2">
                  <div className="adap-card" style={{ padding: 16 }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--adap-slate-500)', textTransform: 'uppercase', marginBottom: 4 }}>Email</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--adap-slate-900)' }}>{viewSubmission.email || '—'}</div>
                  </div>
                  <div className="adap-card" style={{ padding: 16 }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--adap-slate-500)', textTransform: 'uppercase', marginBottom: 4 }}>Score</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--adap-primary)' }}>{viewSubmission.normalized_score ? `${Math.round(viewSubmission.normalized_score)}` : '—'}</div>
                  </div>
                  <div className="adap-card" style={{ padding: 16 }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--adap-slate-500)', textTransform: 'uppercase', marginBottom: 4 }}>Level</div>
                    <div>{viewSubmission.score_level ? <LevelBadge level={viewSubmission.score_level} /> : '—'}</div>
                  </div>
                  <div className="adap-card" style={{ padding: 16 }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--adap-slate-500)', textTransform: 'uppercase', marginBottom: 4 }}>Status</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--adap-slate-900)', textTransform: 'capitalize' }}>{viewSubmission.status}</div>
                  </div>
                </div>
                {viewSubmission.answers && viewSubmission.answers.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--adap-slate-700)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--adap-slate-200)', paddingBottom: 12 }}>
                      Questions & Answers ({viewSubmission.answers.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      {viewSubmission.answers.map((ans, i) => (
                        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <div style={{ minWidth: 28, height: 28, borderRadius: '50%', background: 'var(--adap-primary-light)', color: 'var(--adap-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, flexShrink: 0, marginTop: 2 }}>
                            {i + 1}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--adap-slate-800)', marginBottom: 10, lineHeight: 1.4 }}>{ans.question_text || 'Question'}</div>

                            {/* Show all options with selected one highlighted */}
                            {ans.all_options && ans.all_options.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {ans.all_options.map((opt, optIndex) => (
                                  <div
                                    key={optIndex}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 10,
                                      padding: '8px 12px',
                                      borderRadius: '6px',
                                      background: opt.is_selected ? 'var(--adap-primary-light)' : 'var(--adap-slate-50)',
                                      border: opt.is_selected ? '1px solid var(--adap-primary)' : '1px solid var(--adap-slate-200)',
                                    }}
                                  >
                                    <span style={{
                                      minWidth: 24,
                                      height: 24,
                                      borderRadius: '50%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '12px',
                                      fontWeight: 800,
                                      background: opt.is_selected ? 'var(--adap-primary)' : 'var(--adap-slate-200)',
                                      color: opt.is_selected ? '#fff' : 'var(--adap-slate-600)'
                                    }}>
                                      {opt.letter}
                                    </span>
                                    <span style={{
                                      fontSize: '13px',
                                      fontWeight: opt.is_selected ? 600 : 400,
                                      color: opt.is_selected ? 'var(--adap-primary)' : 'var(--adap-slate-700)',
                                      flex: 1
                                    }}>
                                      {opt.option_text}
                                    </span>
                                    {opt.is_selected && (
                                      <span style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        color: 'var(--adap-primary)',
                                        background: '#fff',
                                        padding: '2px 8px',
                                        borderRadius: '4px'
                                      }}>
                                        Points: {opt.points}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              /* Fallback for text answers or no options */
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--adap-primary-light)', border: '1px solid var(--adap-primary)', borderRadius: '8px', padding: '8px 14px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '12px', color: 'var(--adap-primary)', fontWeight: 600 }}>Answer:</span>
                                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--adap-primary)' }}>{ans.answer_value || '—'}</span>
                                {ans.score_awarded > 0 && (
                                  <span style={{ fontSize: '12px', color: 'var(--adap-slate-600)', fontWeight: 500 }}>(Points: {ans.score_awarded})</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(!viewSubmission.answers || viewSubmission.answers.length === 0) && (
                  <div className="adap-card" style={{ padding: 24, textAlign: 'center', background: 'var(--adap-slate-50)' }}>
                    <span style={{ fontSize: '14px', color: 'var(--adap-slate-500)' }}>No answers recorded for this submission.</span>
                  </div>
                )}
              </div>
              <div className="adap-modal__footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button className="adap-btn adap-btn--danger" onClick={() => handleDelete(viewSubmission.id, true)}><Trash2 size={16} /> Delete</button>
                <button className="adap-btn adap-btn--outline" onClick={() => setViewSubmission(null)}><X size={16} /> Close</button>
              </div>
            </motion.div>
          </motion.div>
        </ModalPortal>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        danger={confirmModal.danger}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </motion.div>
  );
}

// ─── Leads Page ───────────────────────────────────────────────────────────────
function LeadsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [viewLead, setViewLead] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, danger: false });
  const [selectedIds, setSelectedIds] = useState([]);

  const { data: leadSubmissions = [], isLoading: isLoadingSubmissions } = useQuery({
    queryKey: ['lead-submissions', viewLead?.id],
    queryFn: async () => {
      if (!viewLead?.id) return [];
      const res = await api.get(`/leads/${viewLead.id}/submissions`);
      return res.data || [];
    },
    enabled: !!viewLead?.id,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['leads', page],
    queryFn: () => api.get(`/leads?page=${page}&per_page=25`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/leads/${id}`),
    onSuccess: () => { toast('Lead deleted.'); qc.invalidateQueries(['leads']); setSelectedIds([]); },
    onError: (e) => toast(e.message, 'error'),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids) => api.post('/leads/bulk-delete', { ids }),
    onSuccess: (res) => { toast(`${res.data?.deleted || ids.length} leads deleted.`); qc.invalidateQueries(['leads']); setSelectedIds([]); },
    onError: (e) => toast(e.message, 'error'),
  });

  const handleSelectAll = () => {
    if (selectedIds.length === leads.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(leads.map(l => l.id));
    }
  };

  const handleSelectOne = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkDelete = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Selected Leads',
      message: `Are you sure you want to delete ${selectedIds.length} selected lead(s)? This action cannot be undone.`,
      onConfirm: () => bulkDeleteMutation.mutate(selectedIds),
      danger: true,
    });
  };

  const handleDelete = (id, closeModal = false) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Lead',
      message: 'Are you sure you want to delete this lead? This action cannot be undone.',
      onConfirm: () => {
        deleteMutation.mutate(id);
        if (closeModal) setViewLead(null);
      },
      danger: true,
    });
  };

  const exportLeads = () => {
    window.location.href = `${adm.apiUrl}/leads/export?_wpnonce=${encodeURIComponent(adm.nonce || '')}`;
  };

  const leads = data?.data || [];
  const total = data?.meta?.total || leads.length;
  const filtered = search ? leads.filter(l => {
    const s = search.toLowerCase();
    const meta = typeof l.metadata === 'string' ? JSON.parse(l.metadata || '{}') : (l.metadata || {});
    return l.email?.toLowerCase().includes(s) ||
      l.first_name?.toLowerCase().includes(s) ||
      l.last_name?.toLowerCase().includes(s) ||
      l.company?.toLowerCase().includes(s) ||
      meta.job_title?.toLowerCase().includes(s) ||
      meta.programme_type?.toLowerCase().includes(s);
  }) : leads;
  const displayCount = search ? filtered.length : total;

  return (
    <motion.div className="adap-fade-in" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 950, color: 'var(--adap-slate-900)', letterSpacing: '-0.04em', fontFamily: "'Lexend', sans-serif" }}>
            Leads Directory
          </h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--adap-slate-500)', marginTop: '6px', fontWeight: 500 }}>
            {search ? `Showing ${filtered.length} of ${total} unique contact profiles matching "${search}"` : `Directory of unique contact profiles captured. Shows latest results and total assessment runs per contact.`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          {selectedIds.length > 0 && (
            <button className="adap-btn adap-btn--danger" onClick={handleBulkDelete} disabled={bulkDeleteMutation.isPending}>
              <Trash2 size={16} /> Delete {selectedIds.length} Selected
            </button>
          )}
          <div className="adap-search" style={{ width: '100%', maxWidth: '320px' }}>
            <Search size={16} className="adap-search__icon" />
            <input
              className="adap-search__input"
              placeholder="Search by email, name, company…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'var(--adap-slate-200)',
                  color: 'var(--adap-slate-600)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button className="adap-btn adap-btn--outline" onClick={exportLeads}><Download size={13} /> Export CSV</button>
        </div>
      </div>

      {isLoading ? <LoadingRow /> : (
        <div className="adap-table-wrap">
          <table className="adap-table">
            <thead>
              <tr>
                <th className="adap-th-narrow">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filtered.length && filtered.length > 0}
                    onChange={handleSelectAll}
                    className="adap-checkbox"
                  />
                </th>
                <th className="adap-col-email" style={{ whiteSpace: 'nowrap' }}>Email</th>
                <th style={{ whiteSpace: 'nowrap' }}>Name</th>
                <th style={{ whiteSpace: 'nowrap' }}>Company / Role</th>
                {/* <th style={{ whiteSpace: 'nowrap' }}>Industry</th> */}
                <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Submissions</th>
                <th className="adap-col-score" style={{ whiteSpace: 'nowrap' }}>Score</th>
                <th className="adap-col-level" style={{ whiteSpace: 'nowrap' }}>Level</th>
                {/* <th className="adap-col-status" style={{ whiteSpace: 'nowrap' }}>Source</th> */}
                <th className="adap-col-date" style={{ whiteSpace: 'nowrap' }}>Date</th>
                <th className="adap-col-actions" style={{ whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={9} className="adap-table-empty"><div className="adap-empty"><div className="adap-empty__icon">📬</div><div className="adap-empty__title">No leads yet</div><div className="adap-empty__text">Leads appear after someone submits and enters their email.</div></div></td></tr>}
              {filtered.map(l => {
                const meta = typeof l.metadata === 'string' ? JSON.parse(l.metadata || '{}') : (l.metadata || {});
                const runsCount = Number(l.submissions_count || 1);
                return (
                  <tr key={l.id}>
                    <td className="adap-td-narrow">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(l.id)}
                        onChange={() => handleSelectOne(l.id)}
                        className="adap-checkbox"
                      />
                    </td>
                    <td><strong className="adap-text-strong">{l.email}</strong></td>
                    <td className="adap-text-semibold">{[l.first_name, l.last_name].filter(Boolean).join(' ') || <span className="adap-text-muted">—</span>}</td>
                    <td>
                      <div className="adap-company-role">{meta.job_title || '—'}</div>
                      <div className="adap-company-meta">{l.company || '—'} • {meta.country || '—'}</div>
                    </td>
                    {/* <td><div className="adap-badge-inline">{meta.programme_type || '—'}</div></td> */}
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className="adap-badge-count"
                        style={{
                          background: runsCount > 1 ? '#EEF2FF' : '#F8FAFC',
                          color: runsCount > 1 ? '#4F46E5' : '#64748B',
                          border: runsCount > 1 ? '1px solid #C7D2FE' : '1px solid #E2E8F0',
                          fontWeight: 700,
                          fontSize: '12px',
                          minWidth: '28px',
                          height: '24px',
                          padding: '0 8px',
                          borderRadius: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title={`${runsCount} total assessment submission(s) by this contact`}
                      >
                        {runsCount}
                      </span>
                    </td>
                    <td><div className="adap-score-lg">{l.normalized_score ? `${Math.round(l.normalized_score)}` : '—'}</div></td>
                    <td>{l.score_level ? <LevelBadge level={l.score_level} /> : '—'}</td>
                    {/* <td className="adap-source">{l.source || '—'}</td> */}
                    <td className="adap-col-date">{l.created_at?.slice(0, 10)}</td>
                    <td>
                      <div className="adap-actions-group">
                        <button className="adap-btn adap-btn--outline adap-btn--sm adap-btn--icon" onClick={() => setViewLead({ ...l, metadata: meta })} title="View Contact Details">
                          <Eye size={14} />
                        </button>
                        <button className="adap-btn adap-btn--danger adap-btn--sm adap-btn--icon" onClick={() => handleDelete(l.id)} title="Delete Lead">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {total > 25 && <Pagination page={page} total={total} perPage={25} onChange={setPage} />}
        </div>
      )}

      {/* Lead Detail Modal */}
      {viewLead && (
        <ModalPortal>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(8px)',
              zIndex: 100000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 20px',
            }}
            onClick={() => setViewLead(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              style={{
                background: '#fff',
                borderRadius: '16px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
                width: '100%',
                maxWidth: '700px',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div className="adap-modal__header">
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--adap-primary)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Lead Profile</span>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--adap-slate-900)', marginTop: 4, fontFamily: 'Lexend' }}>{viewLead.email}</h3>
                </div>
                <button className="adap-btn adap-btn--outline adap-btn--icon" onClick={() => setViewLead(null)} style={{ width: 36, height: 36 }}><X size={18} /></button>
              </div>
              <div className="adap-modal__body">
                {/* Contact & History Summary */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Contact Status</span>
                    <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '13px' }}>Unique Profile • {viewLead.email}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>Assessment Activity</span>
                    <div style={{ fontWeight: 800, color: 'var(--adap-primary)', fontSize: '14px' }}>
                      {leadSubmissions.length || viewLead.submissions_count || 1} Total {(leadSubmissions.length || viewLead.submissions_count || 1) === 1 ? 'Submission' : 'Submissions'}
                    </div>
                  </div>
                </div>

                <div className="adap-modal-grid-2">
                  <div className="adap-card" style={{ padding: 16 }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--adap-slate-500)', textTransform: 'uppercase', marginBottom: 4 }}>Name</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--adap-slate-900)' }}>{[viewLead.first_name, viewLead.last_name].filter(Boolean).join(' ') || '—'}</div>
                  </div>
                  <div className="adap-card" style={{ padding: 16 }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--adap-slate-500)', textTransform: 'uppercase', marginBottom: 4 }}>Company</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--adap-slate-900)' }}>{viewLead.metadata?.company || viewLead.company || '—'}</div>
                  </div>
                  <div className="adap-card" style={{ padding: 16 }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--adap-slate-500)', textTransform: 'uppercase', marginBottom: 4 }}>Job Title</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--adap-slate-900)' }}>{viewLead.metadata?.job_title || '—'}</div>
                  </div>
                  <div className="adap-card" style={{ padding: 16 }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--adap-slate-500)', textTransform: 'uppercase', marginBottom: 4 }}>Industry</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--adap-slate-900)' }}>{viewLead.metadata?.programme_type || '—'}</div>
                  </div>
                  <div className="adap-card" style={{ padding: 16 }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--adap-slate-500)', textTransform: 'uppercase', marginBottom: 4 }}>Score</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--adap-primary)' }}>{viewLead.normalized_score ? `${Math.round(viewLead.normalized_score)}` : '—'}</div>
                  </div>
                  <div className="adap-card" style={{ padding: 16 }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--adap-slate-500)', textTransform: 'uppercase', marginBottom: 4 }}>Level</div>
                    <div>{viewLead.score_level ? <LevelBadge level={viewLead.score_level} /> : '—'}</div>
                  </div>
                  <div className="adap-card" style={{ padding: 16 }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--adap-slate-500)', textTransform: 'uppercase', marginBottom: 4 }}>Source</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--adap-slate-900)' }}>{viewLead.source || '—'}</div>
                  </div>
                  <div className="adap-card" style={{ padding: 16 }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--adap-slate-500)', textTransform: 'uppercase', marginBottom: 4 }}>Date</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--adap-slate-900)' }}>{viewLead.created_at?.slice(0, 10) || '—'}</div>
                  </div>
                </div>

                {/* Linked Assessment Submissions List */}
                <div style={{ marginTop: 10, marginBottom: 20 }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--adap-slate-700)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Assessment History ({leadSubmissions.length || viewLead.submissions_count || 1})</span>
                    <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--adap-slate-500)', textTransform: 'none' }}>All submissions from this contact</span>
                  </h4>
                  {isLoadingSubmissions ? (
                    <div style={{ padding: 14, textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>Loading history...</div>
                  ) : leadSubmissions.length > 0 ? (
                    <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                            <th style={{ padding: '8px 12px' }}>UUID</th>
                            <th style={{ padding: '8px 12px' }}>Score</th>
                            <th style={{ padding: '8px 12px' }}>Level</th>
                            <th style={{ padding: '8px 12px' }}>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leadSubmissions.map((s, idx) => (
                            <tr key={s.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#64748b' }}>#{s.uuid?.slice(0, 8)}</td>
                              <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--adap-primary)' }}>{Math.round(s.normalized_score)}</td>
                              <td style={{ padding: '8px 12px' }}><LevelBadge level={s.score_level} /></td>
                              <td style={{ padding: '8px 12px', color: '#64748b' }}>{s.completed_at || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#64748b', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px' }}>
                      Latest submission captured on {viewLead.created_at?.slice(0, 10)}.
                    </div>
                  )}
                </div>

                {viewLead.metadata && Object.keys(viewLead.metadata).length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--adap-slate-700)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Additional Information</h4>
                    <div className="adap-card" style={{ padding: 16 }}>
                      {Object.entries(viewLead.metadata).filter(([k]) => !['job_title', 'programme_type', 'company'].includes(k)).map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--adap-slate-100)' }}>
                          <span style={{ fontSize: '12px', color: 'var(--adap-slate-500)', textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</span>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--adap-slate-800)' }}>{v || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="adap-modal__footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button className="adap-btn adap-btn--danger" onClick={() => handleDelete(viewLead.id, true)}><Trash2 size={16} /> Delete</button>
                <button className="adap-btn adap-btn--outline" onClick={() => setViewLead(null)}><X size={16} /> Close</button>
              </div>
            </motion.div>
          </motion.div>
        </ModalPortal>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        danger={confirmModal.danger}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </motion.div>
  );
}

// ─── Analytics Page ─────────────────────────────────────────────────────────--
function AnalyticsPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => api.get('/analytics'),
  });

  if (isLoading) return <LoadingRow />;

  const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'];

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  // Extract data from API response wrapper { success: true, data: { ... } }
  const statsData = stats?.data || stats || {};

  // Calculate dynamic tickCount for Y-axis
  const dailyData = statsData.submissions_by_day || [];
  const globalMax = statsData.max_daily_submissions || 0;
  const localMax = Math.max(...dailyData.map(d => d.count || 0), 0);
  const maxVal = Math.max(globalMax, localMax);

  // Dynamic tickCount: if low volume (0-5), force integer labels. Else let Recharts auto-scale.
  const yTickCount = maxVal <= 5 ? maxVal + 1 : undefined;

  return (
    <motion.div className="adap-fade-in" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.1 } } }}>
      <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 950, color: 'var(--adap-slate-900)', letterSpacing: '-0.04em', fontFamily: "'Lexend', sans-serif" }}>
            Analytics
          </h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--adap-slate-500)', marginTop: '6px', fontWeight: 500 }}>
            View assessment performance metrics and trends.
          </p>
        </div>
        <button className="adap-btn adap-btn--outline" onClick={() => queryClient.invalidateQueries(['analytics-overview'])} style={{ background: '#fff' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* KPIs */}
      <div className="dap-stats" style={{ marginBottom: '40px' }}>
        {[
          {
            label: 'Submissions',
            sublabel: 'Completed sessions',
            value: statsData.total_submissions || 0,
            delta: statsData.submissions_delta || '0%',
            icon: <ClipboardList size={20} />,
            color: 'var(--adap-primary)',
            up: statsData.submissions_up !== false
          },
          {
            label: 'Completed',
            sublabel: 'Finished audits',
            value: statsData.completed || 0,
            delta: statsData.completed_delta || '0%',
            icon: <Check size={20} />,
            color: '#10B981',
            up: statsData.completed_up !== false
          },
          {
            label: 'Completion Rate',
            sublabel: 'Conversion efficiency',
            value: `${statsData.completion_rate || 0}%`,
            delta: statsData.completion_rate_delta || '0%',
            icon: <TrendingUp size={20} />,
            color: '#8B5CF6',
            up: statsData.completion_rate_up !== false
          },
          {
            label: 'Avg Score',
            sublabel: `${statsData.avg_score_percentage || 0}% maturity index`,
            value: `${statsData.avg_score || 0} / ${statsData.total_max_score || 57} pts`,
            delta: statsData.avg_score_delta || '0%',
            icon: <BarChart3 size={20} />,
            color: '#F59E0B',
            up: statsData.avg_score_up !== false
          },
          {
            label: 'Total Leads',
            sublabel: 'Unique client contacts',
            tooltip: 'Unique contact profiles captured. Multiple test submissions by the same user are linked to a single lead.',
            value: statsData.total_leads || 0,
            delta: statsData.leads_delta || '0%',
            icon: <Users size={20} />,
            color: '#7C3AED',
            up: statsData.leads_up !== false
          },
        ].map(({ label, sublabel, tooltip, value, icon, color, delta, up }) => (
          <motion.div key={label} variants={item} className="dap-stat" whileHover={{ y: -5 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '16px'
            }}>
              <div style={{
                color: color,
                background: `${color}15`,
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {icon}
              </div>
              {delta && (
                <div className="dap-glass" style={{
                  fontSize: '11px',
                  fontWeight: 900,
                  color: up ? '#10B981' : '#EF4444',
                  padding: '4px 10px',
                  borderRadius: '100px'
                }}>
                  {up ? '↑' : '↓'} {delta}
                </div>
              )}
            </div>
            <div className="dap-stat__label" style={{
              fontSize: '0.75rem',
              fontWeight: 800,
              color: 'var(--adap-slate-400)',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>{label}</span>
              {tooltip && (
                <span title={tooltip} style={{ cursor: 'help', display: 'inline-flex', color: 'var(--adap-slate-400)' }}>
                  <Info size={13} />
                </span>
              )}
            </div>
            <div className="dap-stat__value" style={{ fontSize: '1.4rem', fontWeight: 950, marginTop: '4px', lineHeight: 1.2 }}>{value}</div>
            {sublabel && (
              <div style={{ fontSize: '0.75rem', color: 'var(--adap-slate-500)', marginTop: '4px', fontWeight: 500 }}>
                {sublabel}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <div className="adap-analytics-charts-grid" style={{ marginBottom: '24px' }}>
        {/* Daily Submissions */}
        <motion.div
          variants={item}
          style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 20px -4px rgba(0,0,0,0.05)'
          }}
        >
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--adap-slate-900)', marginBottom: '20px' }}>
            <TrendingUp size={16} color="var(--adap-primary)" style={{ display: 'inline', marginRight: '8px' }} /> Daily Submissions
          </h3>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={statsData.submissions_by_day || []} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="anaTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--adap-primary)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--adap-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 500, fill: '#64748B' }}
                  dy={10}
                  tickFormatter={(d) => {
                    if (!d) return '';
                    const date = new Date(d);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                  padding={{ left: 10, right: 10 }}
                  minTickGap={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 500, fill: '#64748B' }}
                  dx={-5}
                  allowDecimals={false}
                  domain={[0, 'auto']}
                  tickCount={yTickCount}
                />
                <Tooltip
                  contentStyle={{ background: '#0F172A', border: 'none', borderRadius: '12px', color: '#FFF', fontSize: '12px', fontWeight: 700, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.2)', padding: '10px 16px' }}
                  itemStyle={{ color: '#818CF8' }}
                  cursor={{ stroke: 'var(--adap-primary)', strokeWidth: 2 }}
                  formatter={(value) => [value, 'Submissions']}
                  labelFormatter={(label) => {
                    const date = new Date(label);
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                  }}
                />
                <Area type="monotone" dataKey="count" stroke="var(--adap-primary)" strokeWidth={3} fillOpacity={1} fill="url(#anaTrend)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Level Distribution */}
        <motion.div
          variants={item}
          style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 20px -4px rgba(0,0,0,0.05)'
          }}
        >
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--adap-slate-900)', marginBottom: '16px' }}>
            <BarChart3 size={16} color="#8B5CF6" style={{ display: 'inline', marginRight: '8px' }} /> Level Distribution
          </h3>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statsData.level_breakdown?.length ? statsData.level_breakdown : [{ score_level: 'No Data', count: 1 }]}
                  dataKey="count"
                  nameKey="score_level"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={6}
                  stroke="none"
                >
                  {(statsData.level_breakdown?.length ? statsData.level_breakdown : [{ score_level: 'No Data', count: 1 }]).map((entry, i) => (
                    <Cell key={`cell-${i}`} fill={entry.score_level === 'No Data' ? '#E2E8F0' : (entry.color || COLORS[i % COLORS.length])} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div style={{ background: '#0F172A', padding: '10px 16px', borderRadius: '12px', color: '#FFF', fontSize: '12px', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: data.color || '#6366F1' }} />
                          <span style={{ fontWeight: 800 }}>{data.label || data.score_level}</span>
                        </div>
                        <div style={{ color: '#94A3B8', fontSize: '11px' }}>
                          {data.count} Submissions ({data.percentage || 0}%)
                        </div>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginTop: '12px' }}>
            {(statsData.level_breakdown || []).map((lvl) => (
              <div key={lvl.score_level} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--adap-slate-600)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: lvl.color || '#6366F1' }} />
                <span>{lvl.label || lvl.score_level}: <strong>{lvl.count}</strong> ({lvl.percentage || 0}%)</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Score Distribution (Bar Chart) */}
      <motion.div className="dap-chart-card" variants={item} style={{ marginTop: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div className="dap-chart-card__title" style={{ margin: 0 }}>
              <ClipboardList size={16} color="#10B981" style={{ display: 'inline', marginRight: '6px' }} /> Score Distribution (Raw Points out of 57)
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--adap-slate-500)', margin: '4px 0 0 0' }}>
              Submissions bucketed by regulatory point ranges and colored by Performance Band
            </p>
          </div>
        </div>
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={statsData.score_distribution || []}>
              <CartesianGrid strokeDasharray="10 10" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="range_label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748B' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: '#64748B' }} dx={-10} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: 'rgba(99, 102, 241, 0.05)', radius: 8 }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const data = payload[0].payload;
                  return (
                    <div style={{ background: '#0F172A', padding: '10px 16px', borderRadius: '12px', color: '#FFF', fontSize: '12px', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: data.color || '#6366F1' }} />
                        <span style={{ fontWeight: 800 }}>Point Range: {data.range_label || `${data.bucket} pts`}</span>
                      </div>
                      {data.band_label && (
                        <div style={{ color: data.color || '#F59E0B', fontWeight: 700, fontSize: '11px', marginBottom: '4px' }}>
                          Band: {data.band_label}
                        </div>
                      )}
                      <div style={{ color: '#94A3B8', fontSize: '11px' }}>
                        Submissions: <strong style={{ color: '#FFF' }}>{data.count}</strong>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="count" radius={[8, 8, 2, 2]}>
                {(statsData.score_distribution || []).map((entry, idx) => (
                  <Cell key={`ana-bar-${idx}`} fill={entry.color || '#6366F1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Settings Page with Tabs ──────────────────────────────────────────────────
function SettingsPage() {
  const [activeTab, setActiveTab] = useState('system');
  const toast = useToast();
  const qc = useQueryClient();

  // Fetch settings from API
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await api.get('/settings');
      return response.data || null;
    },
  });

  const [form, setForm] = useState({
    dap_lead_gate_enabled: true,
    dap_rate_limit_per_hour: 10,
    dap_cache_ttl: 300,
    dap_keep_data_on_uninstall: false,
  });

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      setForm({
        dap_lead_gate_enabled: settings.dap_lead_gate_enabled ?? true,
        dap_rate_limit_per_hour: settings.dap_rate_limit_per_hour || 10,
        dap_cache_ttl: settings.dap_cache_ttl || 300,
        dap_keep_data_on_uninstall: settings.dap_keep_data_on_uninstall ?? false,
      });
    }
  }, [settings]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (data) => api.post('/settings', data),
    onSuccess: () => {
      toast('Settings saved successfully!');
      qc.invalidateQueries(['settings']);
    },
    onError: (e) => toast(e.message || 'Failed to save settings', 'error'),
  });

  const save = () => {
    saveMutation.mutate(form);
  };

  const Field = ({ label, name, type = 'text', help }) => (
    <div className="adap-form-group">
      <label className="adap-label">{label}</label>
      {type === 'toggle' ? (
        <label className="adap-switch">
          <input type="checkbox" checked={!!form[name]} onChange={e => setForm(f => ({ ...f, [name]: e.target.checked }))} />
          <span className="adap-switch__slider" />
        </label>
      ) : (
        <input className="adap-input" type={type} value={form[name] || ''} onChange={e => setForm(f => ({ ...f, [name]: type === 'number' ? +e.target.value : e.target.value }))} />
      )}
      {help && <small style={{ color: '#94A3B8', fontSize: '.75rem' }}>{help}</small>}
    </div>
  );

  const TABS = [
    { key: 'system', label: 'System Settings', icon: Settings },
    { key: 'content', label: 'Content Management', icon: FileText },
  ];

  return (
    <motion.div className="adap-fade-in" initial={{ opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 950, color: 'var(--adap-slate-900)', letterSpacing: '-0.04em', fontFamily: "'Lexend', sans-serif" }}>
          Settings
        </h2>
        <p style={{ fontSize: '0.95rem', color: 'var(--adap-slate-500)', marginTop: '6px', fontWeight: 500 }}>
          Configure system settings and dynamic content
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid #E2E8F0' }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '12px 20px',
                background: 'transparent',
                border: 'none',
                borderBottom: `3px solid ${isActive ? '#6366F1' : 'transparent'}`,
                color: isActive ? '#6366F1' : '#64748B',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'system' && (
        <div style={{ maxWidth: 880 }}>

          <div className="adap-card" style={{ marginBottom: '32px', boxShadow: 'var(--adap-shadow-md)', border: '1px solid var(--adap-border)' }}>
            <div className="adap-card__title" style={{ fontFamily: 'Lexend', fontWeight: 900 }}>🔒 Access Control</div>
            <Field label="Require Email for Results" name="dap_lead_gate_enabled" type="toggle" help="Require users to enter their email before viewing results." />
          </div>

          <div className="adap-card" style={{ marginBottom: '32px', boxShadow: 'var(--adap-shadow-md)', border: '1px solid var(--adap-border)' }}>
            <div className="adap-card__title" style={{ fontFamily: 'Lexend', fontWeight: 900 }}>⚡ Performance Settings</div>
            <div className="adap-content-grid-2" style={{ gap: '24px' }}>
              <Field label="TTL (Seconds)" name="dap_cache_ttl" type="number" help="Cache time-to-live for assessment data." />
              <Field label="Rate Ceiling" name="dap_rate_limit_per_hour" type="number" help="Maximum submissions allowed per IP per hour." />
            </div>
          </div>

          <div className="adap-card" style={{ marginBottom: '40px', border: '1px solid #FECACA', background: '#FFF7F7' }}>
            <div className="adap-card__title" style={{ color: '#EF4444', fontFamily: 'Lexend', fontWeight: 900 }}>⚠️ Danger Zone</div>
            <Field label="Keep Data on Uninstall" name="dap_keep_data_on_uninstall" type="toggle" help="Keep all assessment data after uninstalling the plugin." />
          </div>

          <button className="adap-btn adap-btn--primary" onClick={save} disabled={saveMutation.isPending || isLoading} style={{ minWidth: 200, height: 48, fontSize: '1rem', boxShadow: '0 4px 12px var(--adap-primary)40' }}>
            {saveMutation.isPending ? <span className="adap-btn__spinner" /> : <><Check size={18} /> Save Settings</>}
          </button>
        </div>
      )}

      {activeTab === 'content' && (
        <ContentManagement />
      )}
    </motion.div>
  );
}

// ─── Shared Components ────────────────────────────────────────────────────────
function LevelBadge({ level }) {
  const configured = window.dapAdmin?.settings?.performanceColors || {};
  const redHex = configured.red || '#c02b12';
  const amberHex = configured.amber || '#e76424';
  const goldHex = configured.gold || '#edaf18';
  const greenHex = configured.green || '#069e7b';

  const colors = {
    red: redHex,
    amber: amberHex,
    gold: goldHex,
    green: greenHex,
    beginner: redHex,
    developing: amberHex,
    intermediate: amberHex,
    proficient: goldHex,
    advanced: greenHex,
    expert: greenHex
  };

  const bg = {
    red: `${redHex}18`,
    amber: `${amberHex}18`,
    gold: `${goldHex}20`,
    green: `${greenHex}18`,
    beginner: `${redHex}18`,
    developing: `${amberHex}18`,
    intermediate: `${amberHex}18`,
    proficient: `${goldHex}20`,
    advanced: `${greenHex}18`,
    expert: `${greenHex}18`
  };

  const lvlKey = level?.toLowerCase() || '';
  const color = colors[lvlKey] || 'var(--adap-slate-400)';
  return (
    <span style={{
      display: 'inline-flex', padding: '6px 12px', borderRadius: '20px', background: bg[lvlKey] || 'var(--adap-slate-100)',
      color: color, fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', border: `1px solid ${color}40`
    }}>
      {level}
    </span>
  );
}
function LoadingRow() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0', gap: '24px' }}>
      <div style={{ width: 48, height: 48, border: '4px solid var(--adap-slate-200)', borderTopColor: 'var(--adap-primary)', borderRadius: '50%', animation: 'adapSpin 1s linear infinite' }} />
      <span style={{ color: 'var(--adap-slate-400)', fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Loading…</span>
      <style>{`@keyframes adapSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ReorderBlocksModal({ blocks, isOpen, onClose, onSave, isSaving }) {
  const [items, setItems] = useState([]);
  const [draggedId, setDraggedId] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setItems(Array.from(blocks || []));
    }
  }, [isOpen, blocks]);

  if (!isOpen) return null;

  const move = (idx, direction) => {
    const next = Array.from(items);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= next.length) return;
    const [moved] = next.splice(idx, 1);
    next.splice(targetIdx, 0, moved);
    setItems(next);
  };

  const handleSave = () => {
    const payload = items.map((b, idx) => ({ id: b.id, order: idx + 1 }));
    onSave(payload);
  };

  return (
    <ModalPortal>
      <AnimatePresence>
        <motion.div className="adap-modal-overlay dap-glass" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="adap-modal adap-modal--wide" initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}>
            <div className="adap-modal__header">
              <span className="adap-modal__title">
                <GripVertical size={20} className="adap-modal__title-icon" style={{ display: 'inline', marginRight: '8px' }} />
                Update Sequence of Assessment Blocks
              </span>
              <button className="adap-modal__close" onClick={onClose}><X size={18} /></button>
            </div>
            <div className="adap-modal__body">
              <p className="adap-help-text">
                Drag and drop blocks or use the Up/Down controls to set the display sequence in the assessment flow.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {items.map((block, idx) => (
                  <div
                    key={block.id}
                    draggable
                    onDragStart={() => setDraggedId(block.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (!draggedId || draggedId === block.id) return;
                      const next = Array.from(items);
                      const from = next.findIndex(b => b.id === draggedId);
                      const to = next.findIndex(b => b.id === block.id);
                      if (from !== -1 && to !== -1) {
                        const [moved] = next.splice(from, 1);
                        next.splice(to, 0, moved);
                        setItems(next);
                      }
                      setDraggedId(null);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: '#F8FAFC',
                      border: '1.5px solid #E2E8F0',
                      borderRadius: '10px',
                      cursor: 'grab',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <GripVertical size={16} color="#94A3B8" />
                      <span style={{
                        background: '#6366F1',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 800,
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {idx + 1}
                      </span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#0F172A' }}>{block.title}</div>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>{block.questions?.length || 0} Questions • Weight: {block.weight}X</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        className="adap-btn adap-btn--outline adap-btn--sm"
                        disabled={idx === 0}
                        onClick={() => move(idx, 'up')}
                      >
                        <ChevronUp size={14} /> Move Up
                      </button>
                      <button
                        type="button"
                        className="adap-btn adap-btn--outline adap-btn--sm"
                        disabled={idx === items.length - 1}
                        onClick={() => move(idx, 'down')}
                      >
                        <ChevronDown size={14} /> Move Down
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="adap-modal__footer">
              <button className="adap-btn adap-btn--outline" onClick={onClose}><X size={16} /> Cancel</button>
              <button className="adap-btn adap-btn--primary" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <span className="adap-btn__spinner" /> : <><Save size={16} /> Save Block Sequence</>}
              </button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </ModalPortal>
  );
}

