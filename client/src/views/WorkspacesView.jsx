import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  FiLayers, FiGrid, FiMessageCircle, FiPlus,
  FiArrowRight, FiDatabase, FiUsers, FiCpu, FiTrash2,
  FiCheck, FiLoader, FiChevronDown, FiChevronUp, FiEdit2,
  FiExternalLink, FiRefreshCw, FiSearch, FiX, FiFlag,
  FiMoreVertical,
} from 'react-icons/fi';
import { useAppStore } from '../store/appStore';
import { workspaceApi } from '../api/modules/workspaceApi';
import { sfConnectionApi } from '../api/modules/sfConnectionApi';
import { askApi } from '../api/modules/askApi';
import CreateDashboardModal from '../components/CreateDashboardModal';
import ConnectionModal from '../components/ConnectionModal';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { useToast } from '../components/Toast';
import '../styles/WorkspacesView.css';

export default function WorkspacesView() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const {
    workspaces, activeWorkspace, loadWorkspaces, switchWorkspace,
    defaultWorkspaceId, setDefaultWorkspace,
    dashboards, isLoadingDashboards, currentRole, currentUser,
    askConversations, setAskConversations,
  } = useAppStore();

  // Workspace detail (full data from GET /:id)
  const [wsDetail, setWsDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Create workspace form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Connection modal
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [editingConnection, setEditingConnection] = useState(null);

  // Settings sections
  const [settingsOpen, setSettingsOpen] = useState({});

  // Members
  const [allUsers, setAllUsers] = useState([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [addMemberError, setAddMemberError] = useState('');
  const [dropdownDir, setDropdownDir] = useState('down');
  const memberDropdownRef = useRef(null);
  const addBtnRef = useRef(null);

  // Kebab menu & resource assignment modal
  const [connMenuOpen, setConnMenuOpen] = useState(null);
  const [assignModal, setAssignModal] = useState(null);
  const connMenuRef = useRef(null);

  // Dashboard create modal
  const [showCreateDashboard, setShowCreateDashboard] = useState(false);

  // Connection inline test
  const [testingConnId, setTestingConnId] = useState(null);
  const [connTestResults, setConnTestResults] = useState({});

  // Connection delete confirmation
  const [connectionToDelete, setConnectionToDelete] = useState(null);
  const [connectionDeleteWarning, setConnectionDeleteWarning] = useState(null);

  // Workspace connection being edited (for passing role/warehouse to ConnectionModal)
  const [editingWsConnection, setEditingWsConnection] = useState(null);

  // Workspace header menu & delete
  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const wsMenuRef = useRef(null);
  const [workspaceToDelete, setWorkspaceToDelete] = useState(null);
  const [deletePreview, setDeletePreview] = useState(null);
  const [loadingDeletePreview, setLoadingDeletePreview] = useState(false);
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);

  // Inline editing for workspace name & description
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const nameInputRef = useRef(null);
  const descInputRef = useRef(null);
  const saveTimerRef = useRef(null);

  const isAdmin = ['owner', 'admin'].includes(currentRole);
  const canAddMembers = ['owner', 'admin', 'editor'].includes(currentRole);
  const hasSecureAuth = currentUser?.auth_provider === 'saml' ||
    currentUser?.totp_enabled || currentUser?.passkey_enabled;
  const hasWorkspaces = workspaces.length > 0;
  const noWorkspaceSelected = hasWorkspaces && !activeWorkspace;

  // Persist workspace name/description changes
  const saveWorkspaceField = useCallback(async (field, value) => {
    if (!activeWorkspace) return;
    const trimmed = value.trim();
    if (field === 'name' && !trimmed) return;
    const current = field === 'name' ? activeWorkspace.name : (activeWorkspace.description || '');
    if (trimmed === current.trim()) return;

    try {
      await workspaceApi.update(activeWorkspace.id, { [field]: trimmed });
      await loadWorkspaces();
    } catch {
      toast.error(`Failed to update ${field}`);
    }
  }, [activeWorkspace, loadWorkspaces, toast]);

  const startEditName = () => {
    if (!isAdmin || !activeWorkspace) return;
    setDraftName(activeWorkspace.name || '');
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 0);
  };

  const startEditDesc = () => {
    if (!isAdmin || !activeWorkspace) return;
    setDraftDesc(activeWorkspace.description || '');
    setEditingDesc(true);
    setTimeout(() => descInputRef.current?.focus(), 0);
  };

  const commitName = () => {
    clearTimeout(saveTimerRef.current);
    setEditingName(false);
    saveWorkspaceField('name', draftName);
  };

  const commitDesc = () => {
    clearTimeout(saveTimerRef.current);
    setEditingDesc(false);
    saveWorkspaceField('description', draftDesc);
  };

  const handleNameChange = (e) => {
    setDraftName(e.target.value);
    clearTimeout(saveTimerRef.current);
    const val = e.target.value;
    saveTimerRef.current = setTimeout(() => {
      setEditingName(false);
      saveWorkspaceField('name', val);
    }, 2000);
  };

  const handleDescChange = (e) => {
    setDraftDesc(e.target.value);
    clearTimeout(saveTimerRef.current);
    const val = e.target.value;
    saveTimerRef.current = setTimeout(() => {
      setEditingDesc(false);
      saveWorkspaceField('description', val);
    }, 2000);
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') commitName();
    if (e.key === 'Escape') { clearTimeout(saveTimerRef.current); setEditingName(false); }
  };

  const handleDescKeyDown = (e) => {
    if (e.key === 'Enter') commitDesc();
    if (e.key === 'Escape') { clearTimeout(saveTimerRef.current); setEditingDesc(false); }
  };

  // Reset edit state when workspace changes
  useEffect(() => {
    setEditingName(false);
    setEditingDesc(false);
    clearTimeout(saveTimerRef.current);
  }, [activeWorkspace?.id]);

  // Cleanup timer on unmount
  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  // Open the resource assignment modal for a connection
  const openAssignModal = useCallback(async (wc, type) => {
    setConnMenuOpen(null);
    setAssignSearch('');
    setAssignModal({ wcId: wc.id, connectionName: wc.connection_name, type, loading: true, available: [] });

    try {
      // Fetch fresh workspace detail AND Snowflake resources in parallel
      const [freshDetail, res] = await Promise.all([
        workspaceApi.get(activeWorkspace.id),
        sfConnectionApi.getResources(wc.connection_id, wc.role || undefined),
      ]);

      // Update workspace detail so the rest of the UI is in sync
      setWsDetail(freshDetail);

      const connViews = (freshDetail?.semanticViews || []).filter(v => v.workspace_connection_id === wc.id);
      const connAgents = (freshDetail?.agents || []).filter(a => a.workspace_connection_id === wc.id);

      const rawItems = type === 'views' ? (res?.semanticViews || []) : (res?.cortexAgents || []);
      const assignedItems = type === 'views' ? connViews : connAgents;

      const available = rawItems.map(item => {
        const fqn = typeof item === 'object' ? item.fullyQualifiedName || item.name : item;
        const label = typeof item === 'object' ? item.name : item;
        const fqnUpper = fqn.toUpperCase();
        const match = type === 'views'
          ? assignedItems.find(a => a.semantic_view_fqn?.toUpperCase() === fqnUpper)
          : assignedItems.find(a => a.agent_fqn?.toUpperCase() === fqnUpper);
        return { fqn, label, assigned: !!match, recordId: match?.id };
      });

      // Initialize pending set from currently-assigned items
      const initialPending = new Set(available.filter(a => a.assigned).map(a => a.fqn));
      setAssignPending(initialPending);

      setAssignModal(prev => prev ? { ...prev, loading: false, available } : null);
    } catch {
      setAssignPending(new Set());
      setAssignModal(prev => prev ? { ...prev, loading: false, available: [] } : null);
    }
  }, [activeWorkspace?.id]);

  // Load full workspace detail
  const loadDetail = useCallback(async (wsId) => {
    if (!wsId) return;
    setLoadingDetail(true);
    try {
      const data = await workspaceApi.get(wsId);
      setWsDetail(data);
    } catch (e) {
      console.error('Failed to load workspace detail:', e);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (activeWorkspace?.id) {
      loadDetail(activeWorkspace.id);
      askApi.listConversations(activeWorkspace.id)
        .then(res => setAskConversations(res.conversations || []))
        .catch(console.error);
    } else {
      setWsDetail(null);
      setAskConversations([]);
    }
  }, [activeWorkspace?.id, loadDetail]);

  // Sync URL to include workspace UUID
  useEffect(() => {
    if (activeWorkspace?.id && location.pathname === '/workspaces') {
      navigate(`/workspaces/${activeWorkspace.id}`, { replace: true });
    }
  }, [activeWorkspace?.id, location.pathname, navigate]);

  // Open create modal from ?create=1 query param
  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setShowCreateForm(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Close workspace header menu on outside click
  useEffect(() => {
    if (!wsMenuOpen) return;
    const handleClick = (e) => {
      if (wsMenuRef.current && !wsMenuRef.current.contains(e.target)) {
        setWsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [wsMenuOpen]);

  // Close kebab menu on outside click
  useEffect(() => {
    if (!connMenuOpen) return;
    const handleClick = (e) => {
      if (connMenuRef.current && !connMenuRef.current.contains(e.target)) {
        setConnMenuOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [connMenuOpen]);

  // Close member add bar on outside click (admin dropdown)
  useEffect(() => {
    if (!showAddMember) return;
    const handleClick = (e) => {
      if (memberDropdownRef.current && !memberDropdownRef.current.contains(e.target)) {
        setShowAddMember(false);
        setMemberSearch('');
        setAddMemberError('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showAddMember]);

  // Handle create workspace
  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      const ws = await workspaceApi.create({
        name: createName.trim(),
        description: createDesc.trim(),
      });
      await loadWorkspaces();
      if (ws.workspace) {
        switchWorkspace(ws.workspace);
        navigate(`/workspaces/${ws.workspace.id}`, { replace: true });
      }
      setShowCreateForm(false);
      setCreateName('');
      setCreateDesc('');
    } catch (e) {
      setCreateError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleConnectionSaved = async (savedConn, config = {}) => {
    setShowConnectionModal(false);
    const wsConn = editingWsConnection;
    setEditingConnection(null);
    setEditingWsConnection(null);

    if (!activeWorkspace) return;

    if (wsConn && config.role && config.warehouse) {
      // Updating an existing workspace connection's role/warehouse
      try {
        await workspaceApi.updateConnection(activeWorkspace.id, wsConn.id, {
          role: config.role,
          warehouse: config.warehouse,
        });
      } catch { /* swallow if values unchanged */ }
      await loadDetail(activeWorkspace.id);
    } else if (!wsConn && savedConn?.id && config.role && config.warehouse) {
      // New connection being linked to workspace
      try {
        await workspaceApi.addConnection(activeWorkspace.id, {
          connectionId: savedConn.id,
          role: config.role,
          warehouse: config.warehouse,
        });
      } catch { /* might already be linked */ }
      await loadDetail(activeWorkspace.id);
    }
  };

  const handleEditConnection = async (wc) => {
    try {
      const res = await sfConnectionApi.getById(wc.connection_id);
      setEditingConnection(res.connection || res);
      setEditingWsConnection(wc);
      setShowConnectionModal(true);
    } catch (e) {
      console.error('Failed to load connection for editing:', e);
    }
  };

  const handleRequestDeleteConnection = async (wc) => {
    setConnMenuOpen(null);
    if (!activeWorkspace) return;
    try {
      const usage = await workspaceApi.checkConnectionUsage(activeWorkspace.id, wc.id);
      if (usage.dashboardCount > 0) {
        const names = usage.dashboards.map(d => d.name).join(', ');
        toast.error(`Cannot remove — this connection is used by dashboard(s): ${names}. Update those dashboards to use a different connection first.`);
        return;
      }
      if (usage.askConversationCount > 0) {
        setConnectionDeleteWarning(
          `${usage.askConversationCount} existing conversation(s) use this connection. Removing it will render those chats unusable — users will need to start new conversations.`
        );
      } else {
        setConnectionDeleteWarning(null);
      }
      setConnectionToDelete(wc);
    } catch {
      toast.error('Failed to check connection usage');
    }
  };

  const handleRemoveConnection = async () => {
    if (!activeWorkspace || !connectionToDelete) return;
    try {
      const result = await workspaceApi.removeConnection(activeWorkspace.id, connectionToDelete.id);
      if (result.askConversationsAffected > 0) {
        toast.success(`Connection removed. ${result.askConversationsAffected} conversation(s) using this connection will need new conversations.`);
      } else {
        toast.success(`Connection "${connectionToDelete.connection_name}" removed`);
      }
      setConnectionToDelete(null);
      setConnectionDeleteWarning(null);
      await loadDetail(activeWorkspace.id);
    } catch (err) {
      if (err.status === 409) {
        toast.error(err.message || 'This connection is in use by dashboards. Update those dashboards to use a different connection first.');
      } else {
        toast.error(err.message || 'Failed to remove connection');
      }
      setConnectionToDelete(null);
      setConnectionDeleteWarning(null);
    }
  };

  const handleTestConnection = async (connId) => {
    setTestingConnId(connId);
    setConnTestResults(prev => ({ ...prev, [connId]: null }));
    try {
      const result = await sfConnectionApi.test(connId);
      setConnTestResults(prev => ({
        ...prev,
        [connId]: result.success
          ? { success: true, message: `Connected as ${result.user}` }
          : { success: false, message: result.error || 'Failed' },
      }));
      setTimeout(() => setConnTestResults(prev => ({ ...prev, [connId]: null })), 4000);
    } catch (err) {
      setConnTestResults(prev => ({ ...prev, [connId]: { success: false, message: err.message } }));
      setTimeout(() => setConnTestResults(prev => ({ ...prev, [connId]: null })), 4000);
    } finally {
      setTestingConnId(null);
    }
  };

  // Member management
  const loadAllUsers = useCallback(async () => {
    try {
      const { fetchApi, safeJson } = await import('../api/modules/fetchCore.js');
      const res = await fetchApi('/users');
      const data = await safeJson(res, { users: [] });
      const users = data.users || data;
      setAllUsers(Array.isArray(users) ? users : []);
    } catch { setAllUsers([]); }
  }, []);

  const handleAddMember = async (userId) => {
    if (!userId || !activeWorkspace) return;
    setAddingMember(true);
    setAddMemberError('');
    try {
      await workspaceApi.addMember(activeWorkspace.id, userId);
      await loadDetail(activeWorkspace.id);
      setShowAddMember(false);
      setMemberSearch('');
    } catch (e) {
      setAddMemberError(e.message || 'Failed to add member');
    } finally { setAddingMember(false); }
  };

  const handleAddByEmail = async () => {
    const email = memberSearch.trim().toLowerCase();
    if (!email || !activeWorkspace) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setAddMemberError('Enter a valid email address');
      return;
    }
    setAddingMember(true);
    setAddMemberError('');
    try {
      const { fetchApi, safeJson } = await import('../api/modules/fetchCore.js');
      const res = await fetchApi(`/users/lookup?email=${encodeURIComponent(email)}`);
      if (!res.ok) {
        setAddMemberError('No user found with that email');
        return;
      }
      const data = await safeJson(res, {});
      if (!data.user) {
        setAddMemberError('No user found with that email');
        return;
      }
      const already = members.find(m => (m.user_id || m.id) === data.user.id);
      if (already) {
        setAddMemberError('User is already a member');
        return;
      }
      await workspaceApi.addMember(activeWorkspace.id, data.user.id);
      await loadDetail(activeWorkspace.id);
      setShowAddMember(false);
      setMemberSearch('');
    } catch (e) {
      setAddMemberError(e.message || 'Failed to add member');
    } finally { setAddingMember(false); }
  };

  const handleRemoveMember = async (userId) => {
    if (!activeWorkspace) return;
    await workspaceApi.removeMember(activeWorkspace.id, userId);
    await loadDetail(activeWorkspace.id);
  };

  const canDeleteWorkspace = activeWorkspace &&
    (activeWorkspace.created_by === currentUser?.id || currentRole === 'owner');

  const handleRequestDeleteWorkspace = async () => {
    if (!activeWorkspace) return;
    setLoadingDeletePreview(true);
    try {
      const preview = await workspaceApi.deletePreview(activeWorkspace.id);
      setDeletePreview(preview);
      setWorkspaceToDelete(activeWorkspace);
    } catch (e) {
      toast.error(e.message || 'Failed to load delete preview');
    } finally {
      setLoadingDeletePreview(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!workspaceToDelete) return;
    setDeletingWorkspace(true);
    try {
      await workspaceApi.delete(workspaceToDelete.id);
      toast.success(`Workspace "${workspaceToDelete.name}" and all its contents have been deleted`);
      setWorkspaceToDelete(null);
      setDeletePreview(null);
      switchWorkspace(null);
      navigate('/workspaces', { replace: true });
      await loadWorkspaces();
    } catch (e) {
      toast.error(e.message || 'Failed to delete workspace');
    } finally {
      setDeletingWorkspace(false);
    }
  };

  // Pending state for batch assignment
  const [assignPending, setAssignPending] = useState(new Set());
  const [assignSearch, setAssignSearch] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);

  // Toggle pending state locally (no API call)
  const handleTogglePending = (fqn) => {
    setAssignPending(prev => {
      const next = new Set(prev);
      if (next.has(fqn)) next.delete(fqn);
      else next.add(fqn);
      return next;
    });
  };

  // Apply all pending changes at once
  const handleApplyAssignment = async () => {
    if (!activeWorkspace || !assignModal) return;
    const { wcId, type, available } = assignModal;

    setAssignSaving(true);
    let errors = 0;
    try {
      const toAdd = available.filter(a => assignPending.has(a.fqn) && !a.assigned);
      const toRemove = available.filter(a => !assignPending.has(a.fqn) && a.assigned);

      for (const item of toRemove) {
        try {
          if (type === 'views') {
            await workspaceApi.removeView(activeWorkspace.id, item.recordId);
          } else {
            await workspaceApi.removeAgent(activeWorkspace.id, item.recordId);
          }
        } catch (e) {
          console.warn(`Failed to remove ${item.fqn}:`, e.message);
          errors++;
        }
      }
      for (const item of toAdd) {
        try {
          if (type === 'views') {
            await workspaceApi.addView(activeWorkspace.id, { semanticViewFqn: item.fqn, workspaceConnectionId: wcId });
          } else {
            await workspaceApi.addAgent(activeWorkspace.id, { agentFqn: item.fqn, workspaceConnectionId: wcId });
          }
        } catch (e) {
          // 409 = duplicate, treat as success (already assigned)
          if (e.message?.includes('already') || e.status === 409) {
            console.info(`${item.fqn} already assigned, skipping`);
          } else {
            console.warn(`Failed to add ${item.fqn}:`, e.message);
            errors++;
          }
        }
      }
    } finally {
      // Always refresh workspace detail so counts update
      try {
        const freshData = await workspaceApi.get(activeWorkspace.id);
        setWsDetail(freshData);
      } catch { /* best effort */ }

      setAssignSaving(false);
      setAssignModal(null);
      setAssignSearch('');
    }
  };

  const toggleSection = (key) => {
    setSettingsOpen(prev => ({ ...prev, [key]: !prev[key] }));
    if (key === 'members' && !settingsOpen.members && isAdmin) loadAllUsers();
  };

  // ===========================================================================
  // RENDER: No workspaces
  // ===========================================================================
  if (!hasWorkspaces) {
    return (
      <div className="workspaces-view ws-view-centered">
        <div className="ws-welcome">
          <div className="ws-welcome-hero">
            <div className="ws-welcome-icon">
              <FiLayers />
            </div>
            <h1>Welcome to Workspaces</h1>
            <p className="ws-welcome-subtitle">
              {isAdmin
                ? 'Create your first workspace to start building dashboards and chatting with your data.'
                : 'Your admin hasn\'t added you to a workspace yet. Once you\'re added, your dashboards and AskAI will appear here.'}
            </p>
          </div>

          <div className="ws-feature-cards">
            <div className="ws-feature-card">
              <div className="ws-feature-icon"><FiGrid /></div>
              <h3>Dashboards</h3>
              <p>Build interactive dashboards with charts, tables, and filters — all powered by your Snowflake data.</p>
            </div>
            <div className="ws-feature-card">
              <div className="ws-feature-icon"><FiMessageCircle /></div>
              <h3>AskAI</h3>
              <p>Chat with your data using natural language. Ask questions and get instant answers with semantic views.</p>
            </div>
            <div className="ws-feature-card">
              <div className="ws-feature-icon"><FiDatabase /></div>
              <h3>Connections</h3>
              <p>Each workspace connects to Snowflake with its own role, warehouse, and semantic views.</p>
            </div>
          </div>

          {isAdmin && (
            <button
              className="ws-btn ws-btn-primary ws-btn-lg ws-get-started-btn"
              onClick={() => setShowCreateForm(true)}
            >
              <FiPlus /> Get Started
            </button>
          )}

          {!isAdmin && (
            <div className="ws-waiting-card">
              <FiUsers className="ws-waiting-icon" />
              <h3>Awaiting Access</h3>
              <p>Ask your workspace admin to add you as a member. You'll be able to access dashboards and AskAI once you're part of a workspace.</p>
            </div>
          )}
        </div>

        {showCreateForm && (
          <div className="ws-create-overlay" onClick={() => setShowCreateForm(false)}>
            <div className="ws-create-card" onClick={e => e.stopPropagation()}>
              <button className="ws-create-close" onClick={() => setShowCreateForm(false)}><FiX /></button>
              <h2>Create Workspace</h2>
              <p>Give your workspace a name and you can configure connections later.</p>
              <div className="ws-field">
                <label>Workspace Name</label>
                <input value={createName} onChange={e => setCreateName(e.target.value)} placeholder="e.g. Marketing Analytics" autoFocus />
              </div>
              <div className="ws-field">
                <label>Description <span className="optional">(optional)</span></label>
                <input value={createDesc} onChange={e => setCreateDesc(e.target.value)} placeholder="What is this workspace for?" />
              </div>
              {createError && <div className="ws-error">{createError}</div>}
              <div className="ws-btn-row">
                <button className="ws-btn ws-btn-ghost" onClick={() => setShowCreateForm(false)}>Cancel</button>
                <button className="ws-btn ws-btn-primary" disabled={!createName.trim() || creating} onClick={handleCreate}>
                  {creating ? <><FiLoader className="spinner" /> Creating...</> : <><FiPlus /> Create Workspace</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===========================================================================
  // RENDER: Pick a workspace (default invalid but workspaces exist)
  // ===========================================================================
  if (noWorkspaceSelected) {
    return (
      <div className="workspaces-view ws-view-centered">
        <div className="ws-welcome">
          <div className="ws-welcome-hero">
            <div className="ws-welcome-icon"><FiLayers /></div>
            <h1>Select a Workspace</h1>
            <p className="ws-welcome-subtitle">
              Your default workspace is no longer available. Choose one of your workspaces below to continue.
            </p>
          </div>
          <div className="ws-picker-list">
            {workspaces.map(ws => (
              <button
                key={ws.id}
                className="ws-picker-item"
                onClick={async () => {
                  switchWorkspace(ws);
                  await setDefaultWorkspace(ws.id);
                  navigate(`/workspaces/${ws.id}`, { replace: true });
                }}
              >
                <div className="ws-picker-icon"><FiLayers /></div>
                <div className="ws-picker-info">
                  <span className="ws-picker-name">{ws.name}</span>
                  {ws.description && <span className="ws-picker-desc">{ws.description}</span>}
                </div>
                <FiArrowRight className="ws-picker-arrow" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // RENDER: Workspace hub
  // ===========================================================================

  const wsConnections = wsDetail?.connections || [];
  const members = wsDetail?.members || [];
  const allSemanticViews = wsDetail?.semanticViews || [];
  const allAgents = wsDetail?.agents || [];
  const hasConnections = wsConnections.length > 0;

  const recentDashboards = dashboards.slice(0, 3);
  const recentConversations = (askConversations || []).slice(0, 3);
  const nonMemberUsers = allUsers
    .filter(u => !members.find(m => (m.user_id || m.id) === u.id))
    .filter(u => u.email);
  const memberIds = new Set(members.map(m => m.user_id || m.id));
  const filteredSearchUsers = memberSearch.trim()
    ? allUsers.filter(u => u.email).filter(u =>
        u.email.toLowerCase().includes(memberSearch.trim().toLowerCase()) ||
        (u.display_name || u.username || '').toLowerCase().includes(memberSearch.trim().toLowerCase())
      )
    : [];



  return (
    <div className="workspaces-view">
      <div className="ws-header">
        <div className="ws-header-left">
          <h1>
            <FiLayers />
            {editingName ? (
              <input
                ref={nameInputRef}
                className="ws-inline-edit ws-inline-edit-name"
                value={draftName}
                onChange={handleNameChange}
                onBlur={commitName}
                onKeyDown={handleNameKeyDown}
                maxLength={100}
              />
            ) : (
              <span
                className={isAdmin ? 'ws-editable' : ''}
                onDoubleClick={startEditName}
                title={isAdmin ? 'Double-click to rename' : undefined}
              >
                {activeWorkspace?.name || 'Workspaces'}
              </span>
            )}
          </h1>
          {editingDesc ? (
            <input
              ref={descInputRef}
              className="ws-inline-edit ws-inline-edit-desc"
              value={draftDesc}
              onChange={handleDescChange}
              onBlur={commitDesc}
              onKeyDown={handleDescKeyDown}
              placeholder="Add a description..."
              maxLength={255}
            />
          ) : (
            <p
              className={isAdmin ? 'ws-editable' : ''}
              onDoubleClick={startEditDesc}
              title={isAdmin ? 'Double-click to edit description' : undefined}
            >
              {activeWorkspace?.description || (isAdmin ? 'Add a description...' : '')}
            </p>
          )}
        </div>
        <div className="ws-header-actions">
          {activeWorkspace && workspaces.length > 1 &&
            activeWorkspace.id === defaultWorkspaceId && (
              <span className="ws-default-badge"><FiFlag /> Default</span>
            )}
          {activeWorkspace && (
            <div className="ws-kebab-wrap" ref={wsMenuRef}>
              <button className="ws-kebab-btn" onClick={() => setWsMenuOpen(prev => !prev)}>
                <FiMoreVertical />
              </button>
              {wsMenuOpen && (
                <div className="ws-kebab-menu">
                  {workspaces.length > 1 && activeWorkspace.id !== defaultWorkspaceId && (
                    <button onClick={async () => {
                      setWsMenuOpen(false);
                      await setDefaultWorkspace(activeWorkspace.id);
                      toast.success('Set as default workspace');
                    }}>
                      <FiFlag size={13} /> Make Default
                    </button>
                  )}
                  {canDeleteWorkspace && (
                    <button
                      className="ws-kebab-danger"
                      onClick={() => { setWsMenuOpen(false); handleRequestDeleteWorkspace(); }}
                      disabled={loadingDeletePreview}
                    >
                      <FiTrash2 size={13} /> Delete Workspace
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create workspace modal */}
      {showCreateForm && (
        <div className="ws-create-overlay" onClick={() => setShowCreateForm(false)}>
          <div className="ws-create-card" onClick={e => e.stopPropagation()}>
            <button className="ws-create-close" onClick={() => setShowCreateForm(false)}><FiX /></button>
            <h2>Create New Workspace</h2>
            <div className="ws-field">
              <label>Workspace Name</label>
              <input value={createName} onChange={e => setCreateName(e.target.value)} placeholder="e.g. Finance Team" />
            </div>
            <div className="ws-field">
              <label>Description <span className="optional">(optional)</span></label>
              <input value={createDesc} onChange={e => setCreateDesc(e.target.value)} placeholder="What is this workspace for?" />
            </div>
            {createError && <div className="ws-error">{createError}</div>}
            <div className="ws-btn-row">
              <button className="ws-btn ws-btn-ghost" onClick={() => setShowCreateForm(false)}>Cancel</button>
              <button className="ws-btn ws-btn-primary" disabled={!createName.trim() || creating} onClick={handleCreate}>
                {creating ? <><FiLoader className="spinner" /> Creating...</> : <><FiPlus /> Create</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {noWorkspaceSelected && (
        <div className="ws-select-prompt">
          <FiLayers />
          <p>Select a workspace from the sidebar to get started.</p>
        </div>
      )}

      {activeWorkspace && (
        <div className="ws-hub-grid">
          {/* ---- Dashboards Card ---- */}
          <div className={`ws-card ${!hasSecureAuth ? 'ws-card-disabled' : ''}`}>
            <div className="ws-card-header">
              <div className="ws-card-title"><FiGrid /> Dashboards</div>
              <span className="ws-card-count">{isLoadingDashboards ? '…' : dashboards.length}</span>
            </div>
            <div className="ws-card-body">
              {!hasSecureAuth ? (
                <p className="ws-card-empty">Set up Multi-Factor Authentication in your settings to access dashboards.</p>
              ) : recentDashboards.length > 0 ? (
                <ul className="ws-recent-list">
                  {recentDashboards.map(d => (
                    <li key={d.id}>
                      <button className="ws-recent-item" onClick={() => navigate(`/workspaces/${activeWorkspace.id}/dashboards?id=${d.id}`)}>
                        <span className="ws-recent-name">{d.name}</span>
                        <FiExternalLink />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : isLoadingDashboards ? (
                null
              ) : (
                <p className="ws-card-empty">No dashboards yet. Create one to get started.</p>
              )}
            </div>
            <div className="ws-card-footer">
              <button className="ws-btn ws-btn-ghost" onClick={() => navigate(`/workspaces/${activeWorkspace.id}/dashboards`)} disabled={!hasSecureAuth}>
                View All <FiArrowRight />
              </button>
              <button className="ws-btn ws-btn-primary ws-btn-sm" onClick={() => setShowCreateDashboard(true)} disabled={!hasSecureAuth}>
                <FiPlus /> New Dashboard
              </button>
            </div>
          </div>

          {/* ---- AskAI Card ---- */}
          <div className={`ws-card ${(!hasConnections || !hasSecureAuth) ? 'ws-card-disabled' : ''}`}>
            <div className="ws-card-header">
              <div className="ws-card-title"><FiMessageCircle /> SimplyAsk</div>
              {askConversations.length > 0 && hasSecureAuth && (
                <span className="ws-card-count">{askConversations.length} {askConversations.length === 1 ? 'conversation' : 'conversations'}</span>
              )}
            </div>
            <div className="ws-card-body">
              {!hasSecureAuth ? (
                <p className="ws-card-empty">Set up Multi-Factor Authentication in your settings to use SimplyAsk.</p>
              ) : !hasConnections ? (
                <p className="ws-card-empty">Add a Snowflake connection to enable AskAI.</p>
              ) : recentConversations.length > 0 ? (
                <ul className="ws-recent-list">
                  {recentConversations.map(c => (
                    <li key={c.id}>
                      <button className="ws-recent-item" onClick={() => navigate(`/workspaces/${activeWorkspace.id}/ask`)}>
                        <span className="ws-recent-name">{c.title || 'Untitled chat'}</span>
                        <FiExternalLink />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ws-card-empty">No conversations yet. Start chatting with your data.</p>
              )}
            </div>
            <div className="ws-card-footer">
              <button className="ws-btn ws-btn-primary ws-btn-sm" onClick={() => navigate(`/workspaces/${activeWorkspace.id}/ask`)} disabled={!hasConnections || !hasSecureAuth}>
                <FiMessageCircle /> Start Chat
              </button>
            </div>
          </div>

          {/* ---- Workspace Settings (flat) ---- */}
          <div className="ws-flat-settings">
            <h2 className="ws-flat-heading">Workspace Settings</h2>

            {/* ── Connections ── */}
            <div className="ws-flat-section">
              <button className="ws-flat-section-toggle" onClick={() => toggleSection('connections')}>
                <span className="ws-flat-section-label"><FiDatabase size={14} /> Connections <span className="ws-flat-count">{wsConnections.length}</span></span>
                {settingsOpen.connections ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
              </button>
              {settingsOpen.connections && (
                <div className="ws-flat-section-body">
                  {wsConnections.length > 0 ? (
                    <table className="ws-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Account</th>
                          <th>Role / Warehouse</th>
                          <th>Resources</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {wsConnections.map(wc => {
                          const connViews = allSemanticViews.filter(v => v.workspace_connection_id === wc.id);
                          const connAgents = allAgents.filter(a => a.workspace_connection_id === wc.id);
                          const menuOpen = connMenuOpen === wc.id;
                          return (
                            <tr key={wc.id}>
                              <td className="ws-table-name">{wc.connection_name}</td>
                              <td className="ws-table-meta">{wc.connection_account}</td>
                              <td className="ws-table-meta">{[wc.role, wc.warehouse].filter(Boolean).join(' / ') || '—'}</td>
                              <td className="ws-table-meta">{connViews.length} views, {connAgents.length} agents</td>
                              <td className="ws-table-actions">
                                <div className="ws-kebab-wrap" ref={menuOpen ? connMenuRef : undefined}>
                                  <button className="ws-kebab-btn" onClick={() => setConnMenuOpen(menuOpen ? null : wc.id)}>
                                    <FiMoreVertical />
                                  </button>
                                  {menuOpen && (
                                    <div className="ws-kebab-menu">
                                      <button onClick={() => { setConnMenuOpen(null); handleTestConnection(wc.connection_id); }}>
                                        <FiRefreshCw size={13} /> Test Connection
                                      </button>
                                      {isAdmin && (
                                        <>
                                          <button onClick={() => { setConnMenuOpen(null); handleEditConnection(wc); }}>
                                            <FiEdit2 size={13} /> Edit
                                          </button>
                                          <button onClick={() => openAssignModal(wc, 'views')}>
                                            <FiLayers size={13} /> Assign Semantic Views
                                          </button>
                                          <button onClick={() => openAssignModal(wc, 'agents')}>
                                            <FiCpu size={13} /> Assign Cortex Agents
                                          </button>
                                          <button className="ws-kebab-danger" onClick={() => handleRequestDeleteConnection(wc)}>
                                            <FiTrash2 size={13} /> Remove
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                                {connTestResults[wc.connection_id] && (
                                  <span className={`ws-table-test-badge ${connTestResults[wc.connection_id].success ? 'success' : 'error'}`}>
                                    {connTestResults[wc.connection_id].success ? <FiCheck size={12} /> : <FiX size={12} />}
                                  </span>
                                )}
                                {testingConnId === wc.connection_id && <FiLoader className="spinner" size={14} />}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <p className="ws-muted">{isAdmin ? 'No connections configured.' : 'No connections configured. Ask an admin to add one.'}</p>
                  )}
                  {isAdmin && (
                    <div className="ws-flat-add-row">
                      <button className="ws-btn ws-btn-primary ws-btn-sm" onClick={() => setShowConnectionModal(true)}>
                        <FiPlus /> New Connection
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Members ── */}
            <div className="ws-flat-section">
              <button className="ws-flat-section-toggle" onClick={() => toggleSection('members')}>
                <span className="ws-flat-section-label"><FiUsers size={14} /> Members <span className="ws-flat-count">{members.length}</span></span>
                {settingsOpen.members ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
              </button>
              {settingsOpen.members && (
                <div className="ws-flat-section-body">
                  <div ref={memberDropdownRef}>
                  <div className="ws-member-header">
                    <span className="ws-member-count">{members.length} member{members.length !== 1 ? 's' : ''}</span>
                    {canAddMembers && (
                    <button
                      ref={addBtnRef}
                      className="ws-btn-add-member-text"
                      title="Add member"
                      onClick={() => {
                        if (showAddMember) {
                          setShowAddMember(false);
                          setMemberSearch('');
                          setAddMemberError('');
                        } else {
                          if (addBtnRef.current) {
                            const rect = addBtnRef.current.getBoundingClientRect();
                            const spaceBelow = window.innerHeight - rect.bottom;
                            setDropdownDir(spaceBelow < 280 ? 'up' : 'down');
                          }
                          setShowAddMember(true);
                        }
                      }}
                    >
                      {showAddMember ? <FiX size={12} /> : <FiPlus size={12} />}
                      <span>{showAddMember ? 'Cancel' : 'Add'}</span>
                    </button>
                    )}
                  </div>

                  {showAddMember && (
                    <div className="ws-member-add-bar">
                      <div className="ws-member-search-bar">
                        <FiSearch className="ws-member-search-icon" />
                        <input
                          type="text"
                          placeholder={isAdmin ? 'Search by name or email...' : 'Enter full email address...'}
                          value={memberSearch}
                          onChange={e => { setMemberSearch(e.target.value); setAddMemberError(''); }}
                          onKeyDown={e => { if (e.key === 'Enter' && !isAdmin) handleAddByEmail(); }}
                          autoFocus
                        />
                        {!isAdmin && (
                          <button
                            className="ws-btn ws-btn-primary ws-btn-xs"
                            onClick={handleAddByEmail}
                            disabled={addingMember || !memberSearch.trim()}
                          >
                            {addingMember ? <FiLoader className="spinner" /> : 'Add'}
                          </button>
                        )}
                      </div>
                      {addMemberError && <p className="ws-member-add-error">{addMemberError}</p>}
                      {isAdmin && memberSearch.trim() && (
                        <div className={`ws-member-dropdown ws-dropdown-${dropdownDir}`}>
                          <ul className="ws-member-dropdown-list">
                            {filteredSearchUsers.length > 0 ? filteredSearchUsers.map(u => {
                              const isMember = memberIds.has(u.id);
                              return (
                                <li
                                  key={u.id}
                                  className={`ws-member-dropdown-item${isMember ? ' ws-member-already' : ''}`}
                                  onClick={() => {
                                    if (isMember) {
                                      toast.info(`${u.display_name || u.username} is already a member`);
                                    } else {
                                      handleAddMember(u.id);
                                    }
                                  }}
                                >
                                  <div className="ws-member-avatar ws-member-avatar-sm">
                                    {((u.display_name || u.username || 'U')[0]).toUpperCase()}
                                  </div>
                                  <div className="ws-member-info">
                                    <span className="ws-member-name">{u.display_name || u.username}</span>
                                    <span className="ws-member-meta">{u.email}</span>
                                  </div>
                                  <span className={`ws-member-status ${isMember ? 'ws-status-added' : 'ws-status-not-added'}`}>
                                    {isMember ? '✓ Added' : '✕ Not Added'}
                                  </span>
                                </li>
                              );
                            }) : (
                              <li className="ws-member-dropdown-empty">No users match that search</li>
                            )}
                          </ul>
                          {addingMember && <div className="ws-member-dropdown-loading"><FiLoader className="spinner" /> Adding...</div>}
                        </div>
                      )}
                    </div>
                  )}
                  </div>

                  <div className="ws-member-scroll">
                    {members.length > 0 ? (
                      <table className="ws-table">
                        <thead>
                          <tr>
                            <th></th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {members.map(m => {
                            const name = m.display_name || m.username;
                            const mId = m.user_id || m.id;
                            const isWsOwner = mId === activeWorkspace?.created_by;
                            const isSelf = mId === currentUser?.id;
                            const canRemove = isAdmin && !isWsOwner && !isSelf;
                            return (
                              <tr key={mId}>
                                <td className="ws-table-avatar-cell">
                                  <div className="ws-member-avatar ws-member-avatar-sm">
                                    {(name || 'U')[0].toUpperCase()}
                                  </div>
                                </td>
                                <td className="ws-table-name">{name}</td>
                                <td className="ws-table-meta">{m.email || '—'}</td>
                                <td><span className="ws-member-role">{m.role}</span></td>
                                <td className="ws-table-actions">
                                  {canRemove && (
                                    <button className="ws-btn-icon-sm" onClick={() => handleRemoveMember(mId)} title="Remove">
                                      <FiTrash2 size={13} />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <p className="ws-muted">No members yet.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Resource assignment modal — ShelfPopup-style */}
      {assignModal && (
        <div className="ws-create-overlay" onClick={() => { if (!assignSaving) { setAssignModal(null); setAssignSearch(''); } }}>
          <div className="ws-assign-modal" onClick={e => e.stopPropagation()}>
            <div className="ws-assign-header">
              <span className="ws-assign-title">
                {assignModal.type === 'views' ? <FiLayers /> : <FiCpu />}
                {assignModal.type === 'views' ? 'Semantic Views' : 'Cortex Agents'} — {assignModal.connectionName}
              </span>
              <button className="ws-assign-close" onClick={() => { if (!assignSaving) { setAssignModal(null); setAssignSearch(''); } }}>
                <FiX />
              </button>
            </div>

            {assignSaving && (
              <div className="ws-assign-progress"><div className="ws-assign-progress-bar" /></div>
            )}

            <div className="ws-assign-search">
              <FiSearch className="ws-assign-search-icon" />
              <input
                type="text"
                placeholder={`Search ${assignModal.type === 'views' ? 'views' : 'agents'}...`}
                value={assignSearch}
                onChange={(e) => setAssignSearch(e.target.value)}
                autoFocus
              />
            </div>

            {assignModal.loading && (
              <div className="ws-assign-progress"><div className="ws-assign-progress-bar" /></div>
            )}

            {assignModal.loading ? (
              <div className="ws-assign-loading-hint">Fetching available resources...</div>
            ) : (() => {
              const filtered = assignModal.available.filter(item => {
                if (!assignSearch.trim()) return true;
                const s = assignSearch.toLowerCase();
                return item.label.toLowerCase().includes(s) || item.fqn.toLowerCase().includes(s);
              });
              const pendingCount = assignPending.size;
              const hasChanges = assignModal.available.some(a =>
                (assignPending.has(a.fqn) && !a.assigned) || (!assignPending.has(a.fqn) && a.assigned)
              );

              return filtered.length > 0 ? (
                <>
                  <div className="ws-assign-list">
                    {filtered.map(item => {
                      const isChecked = assignPending.has(item.fqn);
                      const fqnParts = item.fqn.split('.');
                      const path = fqnParts.length > 1 ? fqnParts.slice(0, -1).join('.') : '';
                      return (
                        <label key={item.fqn} className={`ws-assign-item ${isChecked ? 'checked' : ''}`}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleTogglePending(item.fqn)}
                            disabled={assignSaving}
                          />
                          {assignModal.type === 'views'
                            ? <FiLayers className="ws-assign-item-icon" />
                            : <FiCpu className="ws-assign-item-icon" />}
                          <div className="ws-assign-item-info">
                            <span className="ws-assign-item-name">{item.label}</span>
                            {path && <span className="ws-assign-item-path">{path}</span>}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <div className="ws-assign-footer">
                    <button
                      className="ws-assign-btn cancel"
                      onClick={() => { setAssignModal(null); setAssignSearch(''); }}
                      disabled={assignSaving}
                    >
                      Cancel
                    </button>
                    <button
                      className="ws-assign-btn apply"
                      onClick={handleApplyAssignment}
                      disabled={assignSaving || !hasChanges}
                    >
                      {assignSaving ? <><FiLoader className="spinner" /> Saving...</> : `Apply (${pendingCount})`}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="ws-assign-empty">
                    {assignSearch.trim()
                      ? `No ${assignModal.type === 'views' ? 'views' : 'agents'} match "${assignSearch}"`
                      : `No ${assignModal.type === 'views' ? 'semantic views' : 'cortex agents'} found for this connection.`}
                  </div>
                  <div className="ws-assign-footer">
                    <button
                      className="ws-assign-btn cancel"
                      onClick={() => { setAssignModal(null); setAssignSearch(''); }}
                    >
                      Close
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Workspace delete confirmation */}
      {workspaceToDelete && (() => {
        const parts = deletePreview ? [
          deletePreview.dashboardCount > 0 && `${deletePreview.dashboardCount} dashboard${deletePreview.dashboardCount !== 1 ? 's' : ''}`,
          deletePreview.folderCount > 0 && `${deletePreview.folderCount} folder${deletePreview.folderCount !== 1 ? 's' : ''}`,
          deletePreview.conversationCount > 0 && `${deletePreview.conversationCount} conversation${deletePreview.conversationCount !== 1 ? 's' : ''}`,
        ].filter(Boolean) : [];
        const warning = parts.length > 0
          ? `This will permanently delete ${parts.join(', ')}. This cannot be undone.`
          : null;
        return (
          <ConfirmDeleteModal
            itemName={workspaceToDelete.name}
            itemType="workspace"
            warning={warning}
            onConfirm={handleDeleteWorkspace}
            onCancel={() => { setWorkspaceToDelete(null); setDeletePreview(null); }}
          />
        );
      })()}

      {/* Connection delete confirmation */}
      {connectionToDelete && (
        <ConfirmDeleteModal
          itemName={connectionToDelete.connection_name}
          itemType="connection"
          warning={connectionDeleteWarning}
          onConfirm={handleRemoveConnection}
          onCancel={() => { setConnectionToDelete(null); setConnectionDeleteWarning(null); }}
        />
      )}

      {/* Snowflake connection create/edit modal */}
      {showConnectionModal && (
        <ConnectionModal
          connection={editingConnection}
          workspaceConnection={editingWsConnection}
          showConfig
          onClose={() => { setShowConnectionModal(false); setEditingConnection(null); setEditingWsConnection(null); }}
          onSaved={handleConnectionSaved}
        />
      )}

      {/* Dashboard create modal */}
      <CreateDashboardModal
        isOpen={showCreateDashboard}
        onClose={() => setShowCreateDashboard(false)}
        onSuccess={() => setShowCreateDashboard(false)}
      />
    </div>
  );
}
