import { describe, it, expect, beforeEach, vi } from 'vitest';
import { create } from 'zustand';
import { createAskSlice } from '../../client/src/store/slices/askSlice';

const createTestStore = () =>
  create((...a) => ({
    currentRole: 'viewer',
    ...createAskSlice(...a),
  }));

const mockSessionStorage = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, val) => { store[key] = val; }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(globalThis, 'sessionStorage', { value: mockSessionStorage });

describe('askSlice', () => {
  let store;

  beforeEach(() => {
    store = createTestStore();
    mockSessionStorage.clear();
    vi.clearAllMocks();
  });

  it('initialises with default state', () => {
    const s = store.getState();
    expect(s.askHasAccess).toBeNull();
    expect(s.askWorkspaces).toEqual([]);
    expect(s.askActiveWorkspace).toBeNull();
    expect(s.askConversations).toEqual([]);
    expect(s.askActiveConversationId).toBeNull();
    expect(s.askMessages).toEqual([]);
    expect(s.askIsStreaming).toBe(false);
    expect(s.askMode).toBe('semantic');
  });

  describe('setAskWorkspaces', () => {
    it('replaces the workspace list', () => {
      const workspaces = [{ id: 'w1', name: 'WS1' }, { id: 'w2', name: 'WS2' }];
      store.getState().setAskWorkspaces(workspaces);
      expect(store.getState().askWorkspaces).toEqual(workspaces);
    });
  });

  describe('setAskActiveWorkspace', () => {
    it('sets the active workspace and clears conversation state', () => {
      store.setState({ askActiveConversationId: 'c1', askMessages: [{ role: 'user', content: 'hi' }] });
      const workspace = { id: 'w1', name: 'WS1' };
      store.getState().setAskActiveWorkspace(workspace);

      const s = store.getState();
      expect(s.askActiveWorkspace).toEqual(workspace);
      expect(s.askActiveConversationId).toBeNull();
      expect(s.askMessages).toEqual([]);
      expect(s.askWorkspaceViews).toEqual([]);
      expect(s.askWorkspaceAgents).toEqual([]);
    });

    it('persists workspace id to sessionStorage', () => {
      store.getState().setAskActiveWorkspace({ id: 'w1' });
      expect(mockSessionStorage.setItem).toHaveBeenCalled();
      const stored = JSON.parse(mockSessionStorage.setItem.mock.calls[0][1]);
      expect(stored.workspaceId).toBe('w1');
    });
  });

  describe('setAskWorkspaceResources', () => {
    it('sets views and agents, auto-selects first of each', () => {
      const views = [{ semantic_view_fqn: 'DB.S.V1' }, { semantic_view_fqn: 'DB.S.V2' }];
      const agents = [{ agent_fqn: 'DB.S.A1' }];
      store.getState().setAskWorkspaceResources(views, agents);

      const s = store.getState();
      expect(s.askWorkspaceViews).toEqual(views);
      expect(s.askWorkspaceAgents).toEqual(agents);
      expect(s.askActiveViewFqn).toBe('DB.S.V1');
      expect(s.askActiveAgentFqn).toBe('DB.S.A1');
    });

    it('preserves existing selection if already set', () => {
      store.setState({ askActiveViewFqn: 'DB.S.V2', askActiveAgentFqn: 'DB.S.A2' });
      store.getState().setAskWorkspaceResources(
        [{ semantic_view_fqn: 'DB.S.V1' }],
        [{ agent_fqn: 'DB.S.A1' }],
      );

      expect(store.getState().askActiveViewFqn).toBe('DB.S.V2');
      expect(store.getState().askActiveAgentFqn).toBe('DB.S.A2');
    });
  });

  describe('conversation management', () => {
    it('setAskConversations replaces the list', () => {
      const convos = [{ id: 'c1', title: 'Test' }];
      store.getState().setAskConversations(convos);
      expect(store.getState().askConversations).toEqual(convos);
    });

    it('addAskConversation prepends a new conversation', () => {
      store.getState().setAskConversations([{ id: 'c1' }]);
      store.getState().addAskConversation({ id: 'c2' });
      const ids = store.getState().askConversations.map(c => c.id);
      expect(ids).toEqual(['c2', 'c1']);
    });

    it('renameAskConversation updates the title', () => {
      store.getState().setAskConversations([{ id: 'c1', title: 'Old' }]);
      store.getState().renameAskConversation('c1', 'New Title');
      expect(store.getState().askConversations[0].title).toBe('New Title');
    });

    it('removeAskConversation removes and clears if it was active', () => {
      store.getState().setAskConversations([{ id: 'c1' }, { id: 'c2' }]);
      store.getState().setAskActiveConversation('c1', [{ role: 'user', content: 'hi' }]);

      store.getState().removeAskConversation('c1');

      const s = store.getState();
      expect(s.askConversations).toHaveLength(1);
      expect(s.askConversations[0].id).toBe('c2');
      expect(s.askActiveConversationId).toBeNull();
      expect(s.askMessages).toEqual([]);
    });

    it('removeAskConversation keeps active if a different one was removed', () => {
      store.getState().setAskConversations([{ id: 'c1' }, { id: 'c2' }]);
      store.getState().setAskActiveConversation('c1', [{ role: 'user', content: 'hi' }]);

      store.getState().removeAskConversation('c2');

      expect(store.getState().askActiveConversationId).toBe('c1');
      expect(store.getState().askMessages).toHaveLength(1);
    });

    it('setAskActiveConversation sets the id and optionally messages', () => {
      const messages = [{ role: 'user', content: 'hello' }];
      store.getState().setAskActiveConversation('c1', messages);

      expect(store.getState().askActiveConversationId).toBe('c1');
      expect(store.getState().askMessages).toEqual(messages);
    });
  });

  describe('message management', () => {
    it('addAskMessage appends to messages', () => {
      store.getState().addAskMessage({ role: 'user', content: 'hi' });
      store.getState().addAskMessage({ role: 'assistant', content: 'hello' });

      expect(store.getState().askMessages).toHaveLength(2);
      expect(store.getState().askMessages[1].role).toBe('assistant');
    });

    it('updateLastAskAssistantMessage updates the last assistant message with object', () => {
      store.getState().addAskMessage({ role: 'user', content: 'q' });
      store.getState().addAskMessage({ role: 'assistant', content: 'partial' });

      store.getState().updateLastAskAssistantMessage({ content: 'complete answer' });

      const msgs = store.getState().askMessages;
      expect(msgs[1].content).toBe('complete answer');
    });

    it('updateLastAskAssistantMessage supports updater function', () => {
      store.getState().addAskMessage({ role: 'assistant', content: 'a', tokens: 5 });

      store.getState().updateLastAskAssistantMessage(prev => ({
        ...prev,
        content: prev.content + 'b',
        tokens: prev.tokens + 3,
      }));

      const msg = store.getState().askMessages[0];
      expect(msg.content).toBe('ab');
      expect(msg.tokens).toBe(8);
    });
  });

  describe('setAskMode', () => {
    it('switches mode and clears conversations/messages', () => {
      store.getState().addAskMessage({ role: 'user', content: 'test' });
      store.getState().setAskConversations([{ id: 'c1' }]);

      store.getState().setAskMode('agent');

      const s = store.getState();
      expect(s.askMode).toBe('agent');
      expect(s.askActiveConversationId).toBeNull();
      expect(s.askMessages).toEqual([]);
      expect(s.askConversations).toEqual([]);
    });
  });

  describe('setAskStreaming', () => {
    it('toggles streaming state', () => {
      store.getState().setAskStreaming(true);
      expect(store.getState().askIsStreaming).toBe(true);
      store.getState().setAskStreaming(false);
      expect(store.getState().askIsStreaming).toBe(false);
    });
  });

  describe('checkAskAccess', () => {
    it('grants access to owner/admin roles', async () => {
      store.setState({ currentRole: 'owner' });
      const result = await store.getState().checkAskAccess();
      expect(result).toBe(true);
      expect(store.getState().askHasAccess).toBe(true);
    });

    it('grants access to admin role', async () => {
      store.setState({ currentRole: 'admin' });
      const result = await store.getState().checkAskAccess();
      expect(result).toBe(true);
    });
  });

  describe('getAskSavedSession', () => {
    it('returns empty object when no session saved', () => {
      expect(store.getState().getAskSavedSession()).toEqual({});
    });

    it('returns saved session data after workspace selection', () => {
      store.getState().setAskActiveWorkspace({ id: 'w1' });
      const session = store.getState().getAskSavedSession();
      expect(session.workspaceId).toBe('w1');
      expect(session.mode).toBe('semantic');
    });
  });
});
