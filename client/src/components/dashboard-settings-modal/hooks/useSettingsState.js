import { useState, useEffect, useRef, useMemo } from 'react';
import { useAppStore } from '../../../store/appStore';
import { groupApi, sfConnectionApi, folderApi } from '../../../api/apiClient';

/**
 * @param {object} yamlBridgeRef - Ref populated by parent after useYamlExport: { pendingYamlImport, setPendingYamlImport, setImportSuccess, setImportError }
 */
export function useSettingsState(dashboard, isOpen, onClose, onSave, yamlBridgeRef) {
  const { currentRole, currentDashboard, updateDashboard, isAuthenticated } = useAppStore();

  // Store original values when modal opens for cancel/revert
  const originalValuesRef = useRef(null);

  // Connection-based resources
  const [availableWarehouses, setAvailableWarehouses] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [availableSemanticViews, setAvailableSemanticViews] = useState([]);
  const [availableCortexAgents, setAvailableCortexAgents] = useState([]);
  const [loadingResources, setLoadingResources] = useState(false);

  // Settings state
  const [name, setName] = useState(dashboard?.name || '');
  const [description, setDescription] = useState(dashboard?.description || '');
  const [warehouse, setWarehouse] = useState(dashboard?.warehouse || '');
  const [role, setRole] = useState(dashboard?.role || '');
  const [isPublished, setIsPublished] = useState(dashboard?.isPublished || false);

  // Sharing state
  const [visibility, setVisibility] = useState(dashboard?.visibility || 'private');
  const [sharedGroups, setSharedGroups] = useState(dashboard?.sharedGroups || []);
  const [availableGroups, setAvailableGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedGroupToAdd, setSelectedGroupToAdd] = useState('');

  // Semantic views referenced
  const [semanticViewsReferenced, setSemanticViewsReferenced] = useState(dashboard?.semanticViewsReferenced || []);
  const [selectedSemanticView, setSelectedSemanticView] = useState('');

  // Cortex agents
  const [cortexAgentsEnabled, setCortexAgentsEnabled] = useState(dashboard?.cortexAgentsEnabled || false);
  const [cortexAgents, setCortexAgents] = useState(dashboard?.cortexAgents || []);
  const [selectedCortexAgent, setSelectedCortexAgent] = useState('');

  // Folder state
  const [folderId, setFolderId] = useState(dashboard?.folder_id || null);
  const [folders, setFolders] = useState([]);
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
  const [showInlineCreateFolder, setShowInlineCreateFolder] = useState(false);
  const [inlineFolderName, setInlineFolderName] = useState('');
  const [creatingInlineFolder, setCreatingInlineFolder] = useState(false);
  const [folderSearchQuery, setFolderSearchQuery] = useState('');

  // Access control
  const [accessList, setAccessList] = useState(dashboard?.access || []);
  const [newRole, setNewRole] = useState('');
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const groupSearchRef = useRef(null);

  // Active tab
  const [activeTab, setActiveTab] = useState('general');

  // Loading/saving state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Ownership transfer state
  const [transferOwnerTo, setTransferOwnerTo] = useState('');
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);

  // Credential update state
  const [showCredentialUpdate, setShowCredentialUpdate] = useState(false);
  const [credentialType, setCredentialType] = useState('pat'); // 'pat' or 'keypair'
  const [newPatToken, setNewPatToken] = useState('');
  const [newPrivateKey, setNewPrivateKey] = useState('');
  const [newPrivateKeyPassphrase, setNewPrivateKeyPassphrase] = useState('');

  // Connection test state
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState(null);

  // Connection menu/replace state
  const [showConnectionMenu, setShowConnectionMenu] = useState(false);
  const [connectionMenuPos, setConnectionMenuPos] = useState({ top: 0, left: 0 });
  const [showReplaceConnection, setShowReplaceConnection] = useState(false);
  const [availableConnections, setAvailableConnections] = useState([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState(null);
  const connectionMenuRef = useRef(null);
  const connectionMenuBtnRef = useRef(null);

  // Check if current user is the owner (from backend access check)
  const isOwner = dashboard?.isOwner || dashboard?.access_level === 'owner';

  // Get admin roles for ownership transfer
  const adminRoles = accessList.filter((a) => a.permission === 'admin').map((a) => a.role);

  // State for tracking which semantic view has error (before revertToOriginal references timeout ref)
  const [semanticViewError, setSemanticViewError] = useState(null);
  const [errorViewName, setErrorViewName] = useState(null);
  const semanticViewErrorTimeoutRef = useRef(null);

  // Sync state with dashboard prop when modal opens or dashboard data changes
  useEffect(() => {
    if (isOpen && dashboard) {
      // Set current values from dashboard
      setName(dashboard.name || '');
      setDescription(dashboard.description || '');
      setWarehouse(dashboard.warehouse || '');
      setRole(dashboard.role || '');
      setIsPublished(dashboard.isPublished || false);
      setVisibility(dashboard.visibility || 'private');
      setSharedGroups(dashboard.sharedGroups ? [...dashboard.sharedGroups] : []);
      setSemanticViewsReferenced(dashboard.semanticViewsReferenced ? [...dashboard.semanticViewsReferenced] : []);
      setCortexAgentsEnabled(dashboard.cortexAgentsEnabled || false);
      setCortexAgents(dashboard.cortexAgents ? [...dashboard.cortexAgents] : []);
      setAccessList(dashboard.access ? [...dashboard.access] : []);
      setFolderId(dashboard.folder_id || null);

      // Also cache original values for cancel/revert
      originalValuesRef.current = {
        name: dashboard.name || '',
        description: dashboard.description || '',
        warehouse: dashboard.warehouse || '',
        isPublished: dashboard.isPublished || false,
        visibility: dashboard.visibility || 'private',
        sharedGroups: dashboard.sharedGroups ? [...dashboard.sharedGroups] : [],
        semanticViewsReferenced: dashboard.semanticViewsReferenced ? [...dashboard.semanticViewsReferenced] : [],
        cortexAgentsEnabled: dashboard.cortexAgentsEnabled || false,
        cortexAgents: dashboard.cortexAgents ? [...dashboard.cortexAgents] : [],
        accessList: dashboard.access ? [...dashboard.access] : [],
        folderId: dashboard.folder_id || null,
      };
    }
  }, [isOpen, dashboard?.id, dashboard?.access?.length, dashboard?.visibility, dashboard?.isPublished]);

  const readYamlBridge = () => yamlBridgeRef?.current ?? {};

  // Revert to original values
  const revertToOriginal = () => {
    if (originalValuesRef.current) {
      setName(originalValuesRef.current.name);
      setDescription(originalValuesRef.current.description);
      setWarehouse(originalValuesRef.current.warehouse);
      setIsPublished(originalValuesRef.current.isPublished);
      setVisibility(originalValuesRef.current.visibility);
      setSharedGroups([...originalValuesRef.current.sharedGroups]);
      setSemanticViewsReferenced([...originalValuesRef.current.semanticViewsReferenced]);
      setCortexAgentsEnabled(originalValuesRef.current.cortexAgentsEnabled);
      setCortexAgents([...originalValuesRef.current.cortexAgents]);
      setAccessList([...originalValuesRef.current.accessList]);
      setFolderId(originalValuesRef.current.folderId);
    }
    // Clear temporary states
    setError(null);
    setNewRole('');
    setSelectedSemanticView('');
    setSelectedCortexAgent('');
    setSelectedGroupToAdd('');
    setShowTransferConfirm(false);
    setTransferOwnerTo('');
    setShowCredentialUpdate(false);
    setNewPatToken('');
    setNewPrivateKey('');
    setNewPrivateKeyPassphrase('');
    setConnectionTestResult(null);
    setActiveTab('general');
    setFolderDropdownOpen(false);
    setFolderSearchQuery('');
    // Clear YAML import state
    const yb = readYamlBridge();
    yb.setPendingYamlImport?.(null);
    yb.setImportSuccess?.(false);
    yb.setImportError?.(null);
    // Clear semantic view error
    setSemanticViewError(null);
    setErrorViewName(null);
    if (semanticViewErrorTimeoutRef.current) {
      clearTimeout(semanticViewErrorTimeoutRef.current);
    }
  };

  // Handle cancel - revert changes and close
  const handleCancel = () => {
    revertToOriginal();
    onClose();
  };

  // Load resources from the dashboard's connection
  const loadResourcesFromConnection = async () => {
    if (!dashboard?.connection_id || !dashboard?.role) return;

    setLoadingResources(true);
    try {
      const resources = await sfConnectionApi.getResources(dashboard.connection_id, dashboard.role);
      setAvailableWarehouses(resources.warehouses || []);
      setAvailableRoles(resources.roles || []);
      setAvailableSemanticViews(resources.semanticViews || []);
      setAvailableCortexAgents(resources.cortexAgents || []);
    } catch (err) {
      console.error('Failed to load resources:', err);
    } finally {
      setLoadingResources(false);
    }
  };

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      loadResourcesFromConnection();
      loadAvailableGroups();
      loadFolders();
    }
  }, [isOpen, isAuthenticated, dashboard?.connection_id, dashboard?.role]);

  useEffect(() => {
    if (dashboard) {
      setName(dashboard.name || '');
      setDescription(dashboard.description || '');
      setWarehouse(dashboard.warehouse || '');
      setRole(dashboard.role || '');
      setIsPublished(dashboard.isPublished || false);
      setAccessList(dashboard.access || []);
      setSemanticViewsReferenced(dashboard.semanticViewsReferenced || []);
      setCortexAgentsEnabled(dashboard.cortexAgentsEnabled || false);
      setCortexAgents(dashboard.cortexAgents || []);
      setFolderId(dashboard.folder_id || null);
    }
  }, [dashboard]);

  // Add semantic view to list
  const addSemanticView = () => {
    if (!selectedSemanticView) return;

    // Check if already added
    const viewName = typeof selectedSemanticView === 'string' ? selectedSemanticView : selectedSemanticView.name;

    if (semanticViewsReferenced.some((v) => (typeof v === 'string' ? v : v.name) === viewName)) {
      return; // Already added
    }

    // Find the full view object from available views
    const viewObj = availableSemanticViews.find((v) => (v.name || v) === viewName || v === viewName);

    const newView = viewObj
      ? {
          name: viewObj.name || viewObj,
          fullyQualifiedName:
            viewObj.fullyQualifiedName ||
            viewObj.fqn ||
            `${viewObj.database || ''}.${viewObj.schema || ''}.${viewObj.name || viewObj}`.replace(/^\.+/, ''),
        }
      : { name: viewName, fullyQualifiedName: null };

    setSemanticViewsReferenced([...semanticViewsReferenced, newView]);
    setSelectedSemanticView('');
    // Clear any semantic view related error
    setSemanticViewError(null);
    setErrorViewName(null);
  };

  // Remove semantic view from list (with dependency check)
  const removeSemanticView = (viewName) => {
    // Clear any existing timeout
    if (semanticViewErrorTimeoutRef.current) {
      clearTimeout(semanticViewErrorTimeoutRef.current);
    }

    // Check if any widget in the dashboard is using this semantic view
    const widgetsUsingView = [];

    if (dashboard?.tabs) {
      dashboard.tabs.forEach((tab) => {
        if (tab.widgets) {
          tab.widgets.forEach((widget) => {
            const widgetViewRefs = widget.semanticViewsReferenced || [];
            const usesView = widgetViewRefs.some((ref) => {
              const refName = typeof ref === 'string' ? ref : ref.name;
              return refName === viewName;
            });
            if (usesView) {
              widgetsUsingView.push({
                widgetTitle: widget.title || widget.id,
                tabTitle: tab.title || tab.id,
              });
            }
          });
        }
      });
    }

    if (widgetsUsingView.length > 0) {
      const widgetNames = widgetsUsingView.map((w) => `"${w.widgetTitle}" (${w.tabTitle})`).join(', ');
      setSemanticViewError(`Cannot remove "${viewName}" - it is used by: ${widgetNames}. Remove it from these widgets first.`);
      setErrorViewName(viewName);

      // Auto-clear after 5 seconds
      semanticViewErrorTimeoutRef.current = setTimeout(() => {
        setSemanticViewError(null);
        setErrorViewName(null);
      }, 5000);
      return;
    }

    // Safe to remove
    setSemanticViewsReferenced(semanticViewsReferenced.filter((v) => (typeof v === 'string' ? v : v.name) !== viewName));
    setSemanticViewError(null);
    setErrorViewName(null);
  };

  // Add cortex agent to list (keyed by FQN)
  const addCortexAgent = () => {
    if (!selectedCortexAgent) return;

    const agentObj = availableCortexAgents.find((a) => a.fullyQualifiedName === selectedCortexAgent);
    if (!agentObj) return;

    const fqn = agentObj.fullyQualifiedName;
    if (cortexAgents.some((a) => (typeof a === 'object' ? a.fullyQualifiedName : a) === fqn)) {
      return;
    }

    setCortexAgents([
      ...cortexAgents,
      {
        name: agentObj.name,
        database: agentObj.database,
        schema: agentObj.schema,
        fullyQualifiedName: fqn,
      },
    ]);
    setSelectedCortexAgent('');
  };

  // Remove cortex agent from list (by FQN)
  const removeCortexAgent = (fqn) => {
    setCortexAgents(cortexAgents.filter((a) => (typeof a === 'object' ? a.fullyQualifiedName : a) !== fqn));
  };

  // Test connection using the dashboard's stored connection
  const testConnection = async () => {
    if (!dashboard?.connection_id) {
      setConnectionTestResult({ success: false, message: 'No connection configured' });
      return;
    }

    setTestingConnection(true);
    setConnectionTestResult(null);
    try {
      const result = await sfConnectionApi.test(dashboard.connection_id);
      if (result.success) {
        setConnectionTestResult({ success: true, message: `Connected as ${result.user} with role ${result.role}` });
      } else {
        setConnectionTestResult({ success: false, message: result.error || 'Connection failed' });
      }
    } catch (error) {
      setConnectionTestResult({ success: false, message: error.message || 'Connection failed' });
    } finally {
      setTestingConnection(false);
      // Reset the result after 5 seconds
      setTimeout(() => {
        setConnectionTestResult(null);
      }, 5000);
    }
  };

  // Load available connections for replacement
  const loadAvailableConnections = async () => {
    setLoadingConnections(true);
    try {
      const connections = await sfConnectionApi.list();
      setAvailableConnections(connections || []);
    } catch (error) {
      console.error('Failed to load connections:', error);
      setAvailableConnections([]);
    } finally {
      setLoadingConnections(false);
    }
  };

  // Handle replace connection
  const handleReplaceConnection = async () => {
    if (!selectedConnectionId || selectedConnectionId === dashboard?.connection_id) {
      return;
    }

    // Update the dashboard with the new connection
    const selectedConn = availableConnections.find((c) => c.id === selectedConnectionId);
    if (selectedConn) {
      updateDashboard(currentDashboard.id, {
        connection_id: selectedConnectionId,
        connection_name: selectedConn.name,
      });
      setShowReplaceConnection(false);
      setSelectedConnectionId(null);
    }
  };

  // Close connection menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (connectionMenuRef.current && !connectionMenuRef.current.contains(e.target)) {
        setShowConnectionMenu(false);
      }
    };
    if (showConnectionMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showConnectionMenu]);

  // Load available groups
  const loadAvailableGroups = async () => {
    setLoadingGroups(true);
    try {
      const response = await groupApi.getAll();
      setAvailableGroups(response.groups || []);
    } catch (err) {
      console.error('Failed to load groups:', err);
    } finally {
      setLoadingGroups(false);
    }
  };

  // Load folders
  const loadFolders = async () => {
    try {
      const response = await folderApi.getContents(null);
      setFolders(response.folders || []);
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
  };

  // Create folder inline
  const handleInlineCreateFolder = async () => {
    if (!inlineFolderName.trim()) return;

    setCreatingInlineFolder(true);
    try {
      const newFolder = await folderApi.create({
        name: inlineFolderName.trim(),
        parentId: null,
      });
      // API returns folder directly, not wrapped
      setFolders([...folders, newFolder]);
      setFolderId(newFolder.id);
      setShowInlineCreateFolder(false);
      setInlineFolderName('');
      setFolderSearchQuery('');
      setFolderDropdownOpen(false);
    } catch (err) {
      console.error('Failed to create folder:', err);
    } finally {
      setCreatingInlineFolder(false);
    }
  };

  // Add group to shared list
  const handleAddGroup = () => {
    if (!selectedGroupToAdd) return;

    const group = availableGroups.find((g) => g.id === selectedGroupToAdd);
    if (group && !sharedGroups.find((g) => g.id === group.id)) {
      setSharedGroups([...sharedGroups, group]);
    }
    setSelectedGroupToAdd('');
  };

  // Remove group from shared list
  const handleRemoveGroup = (groupId) => {
    setSharedGroups(sharedGroups.filter((g) => g.id !== groupId));
  };

  // Transfer ownership
  const handleTransferOwnership = async () => {
    if (!transferOwnerTo) return;

    try {
      // Update dashboard with new owner
      await updateDashboard(dashboard.id, { ownerRole: transferOwnerTo });
      setShowTransferConfirm(false);
      setTransferOwnerTo('');
      // Refresh the page or close settings since ownership has changed
      onClose();
    } catch (error) {
      setError('Failed to transfer ownership: ' + error.message);
    }
  };

  // Update credentials for the dashboard's connection
  const handleUpdateCredentials = async () => {
    if (!dashboard?.connection_id) {
      setError('No connection configured');
      return;
    }

    try {
      const updateData = {};
      if (credentialType === 'pat') {
        if (!newPatToken) {
          setError('Please enter a PAT token');
          return;
        }
        updateData.authType = 'pat';
        updateData.credentials = { token: newPatToken };
      } else {
        if (!newPrivateKey) {
          setError('Please enter a private key');
          return;
        }
        updateData.authType = 'keypair';
        updateData.credentials = {
          privateKey: newPrivateKey,
          passphrase: newPrivateKeyPassphrase,
        };
      }

      await sfConnectionApi.update(dashboard.connection_id, updateData);
      setShowCredentialUpdate(false);
      setNewPatToken('');
      setNewPrivateKey('');
      setNewPrivateKeyPassphrase('');
      setConnectionTestResult({ success: true, message: 'Credentials updated successfully!' });
    } catch (error) {
      setError('Failed to update credentials: ' + error.message);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Dashboard name is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const pendingYamlImport = readYamlBridge().pendingYamlImport;

      // Build the settings object
      const settings = {
        name: name.trim(),
        description: description.trim(),
        warehouse,
        role,
        isPublished,
        visibility,
        access: accessList,
        semanticViewsReferenced,
        cortexAgentsEnabled,
        cortexAgents: cortexAgentsEnabled ? cortexAgents : [],
        folder_id: folderId,
      };

      // Include pending YAML import if present
      if (pendingYamlImport) {
        if (pendingYamlImport.tabs) settings.tabs = pendingYamlImport.tabs;
        if (pendingYamlImport.filters) settings.filters = pendingYamlImport.filters;
        if (pendingYamlImport.semanticViewsReferenced) settings.semanticViewsReferenced = pendingYamlImport.semanticViewsReferenced;
        if (pendingYamlImport.cortexAgentsEnabled != null) settings.cortexAgentsEnabled = pendingYamlImport.cortexAgentsEnabled;
        if (pendingYamlImport.cortexAgents) settings.cortexAgents = pendingYamlImport.cortexAgents;
        if (pendingYamlImport.customColorSchemes) settings.customColorSchemes = pendingYamlImport.customColorSchemes;
      }

      await onSave(settings);

      // Clear pending import after successful save
      readYamlBridge().setPendingYamlImport?.(null);
      readYamlBridge().setImportSuccess?.(false);
      // Note: onSave handler closes the modal, no need to call onClose() here
    } catch (err) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered groups for the searchable dropdown
  const filteredGroupsForAccess = useMemo(() => {
    return availableGroups
      .filter((g) => !accessList.some((a) => a.groupId === g.id)) // Exclude already added
      .filter((g) => g.name.toLowerCase().includes(groupSearchQuery.toLowerCase())); // Search filter
  }, [availableGroups, accessList, groupSearchQuery]);

  const selectGroupForAccess = (group) => {
    setNewRole(group.id);
    setGroupSearchQuery(group.name);
    setShowGroupDropdown(false);
  };

  const addAccessRole = () => {
    if (!newRole) return;

    // Find the selected group
    const selectedGroup = availableGroups.find((g) => g.id === newRole);
    if (!selectedGroup) return;

    // Check if group is already in the list
    if (accessList.some((a) => a.groupId === newRole)) {
      setError('This group already has access');
      return;
    }

    // Groups just grant access - no permission level
    // User's app role determines what they can do
    setAccessList([
      ...accessList,
      {
        groupId: selectedGroup.id,
        groupName: selectedGroup.name,
      },
    ]);
    setNewRole('');
    setGroupSearchQuery('');
    setError(null);
  };

  // Close group dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (groupSearchRef.current && !groupSearchRef.current.contains(e.target)) {
        setShowGroupDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const removeAccessRole = (groupId) => {
    setAccessList(accessList.filter((a) => (a.groupId || a.role) !== groupId));
  };

  return {
    currentRole,
    currentDashboard,
    updateDashboard,
    isAuthenticated,
    originalValuesRef,
    availableWarehouses,
    setAvailableWarehouses,
    availableRoles,
    setAvailableRoles,
    availableSemanticViews,
    setAvailableSemanticViews,
    availableCortexAgents,
    setAvailableCortexAgents,
    loadingResources,
    setLoadingResources,
    name,
    setName,
    description,
    setDescription,
    warehouse,
    setWarehouse,
    role,
    setRole,
    isPublished,
    setIsPublished,
    visibility,
    setVisibility,
    sharedGroups,
    setSharedGroups,
    availableGroups,
    setAvailableGroups,
    loadingGroups,
    setLoadingGroups,
    selectedGroupToAdd,
    setSelectedGroupToAdd,
    semanticViewsReferenced,
    setSemanticViewsReferenced,
    selectedSemanticView,
    setSelectedSemanticView,
    cortexAgentsEnabled,
    setCortexAgentsEnabled,
    cortexAgents,
    setCortexAgents,
    selectedCortexAgent,
    setSelectedCortexAgent,
    folderId,
    setFolderId,
    folders,
    setFolders,
    folderDropdownOpen,
    setFolderDropdownOpen,
    showInlineCreateFolder,
    setShowInlineCreateFolder,
    inlineFolderName,
    setInlineFolderName,
    creatingInlineFolder,
    setCreatingInlineFolder,
    folderSearchQuery,
    setFolderSearchQuery,
    accessList,
    setAccessList,
    newRole,
    setNewRole,
    groupSearchQuery,
    setGroupSearchQuery,
    showGroupDropdown,
    setShowGroupDropdown,
    groupSearchRef,
    activeTab,
    setActiveTab,
    isSaving,
    setIsSaving,
    error,
    setError,
    transferOwnerTo,
    setTransferOwnerTo,
    showTransferConfirm,
    setShowTransferConfirm,
    showCredentialUpdate,
    setShowCredentialUpdate,
    credentialType,
    setCredentialType,
    newPatToken,
    setNewPatToken,
    newPrivateKey,
    setNewPrivateKey,
    newPrivateKeyPassphrase,
    setNewPrivateKeyPassphrase,
    testingConnection,
    setTestingConnection,
    connectionTestResult,
    setConnectionTestResult,
    showConnectionMenu,
    setShowConnectionMenu,
    connectionMenuPos,
    setConnectionMenuPos,
    showReplaceConnection,
    setShowReplaceConnection,
    availableConnections,
    setAvailableConnections,
    loadingConnections,
    setLoadingConnections,
    selectedConnectionId,
    setSelectedConnectionId,
    connectionMenuRef,
    connectionMenuBtnRef,
    isOwner,
    adminRoles,
    revertToOriginal,
    handleCancel,
    loadResourcesFromConnection,
    addSemanticView,
    semanticViewError,
    setSemanticViewError,
    errorViewName,
    setErrorViewName,
    semanticViewErrorTimeoutRef,
    removeSemanticView,
    addCortexAgent,
    removeCortexAgent,
    testConnection,
    loadAvailableConnections,
    handleReplaceConnection,
    loadAvailableGroups,
    loadFolders,
    handleInlineCreateFolder,
    handleAddGroup,
    handleRemoveGroup,
    handleTransferOwnership,
    handleUpdateCredentials,
    handleSave,
    filteredGroupsForAccess,
    selectGroupForAccess,
    addAccessRole,
    removeAccessRole,
  };
}
