import { createContext, useContext, useReducer, ReactNode } from 'react';
import type { Incident, ChatMessage, AgentState, AppConfig } from '@incidentiq/shared-types';


// State
interface AppState {
  incidents: Incident[];
  currentConversationId: string | null;
  messages: ChatMessage[];
  agentStates: AgentState[];
  config: AppConfig;
  isLoading: boolean;
  error: string | null;
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  darkMode: boolean;
}

const initialState: AppState = {
  incidents: [],
  currentConversationId: null,
  messages: [],
  agentStates: [],
  config: {} as AppConfig,
  isLoading: false,
  error: null,
  sidebarCollapsed: true,
  mobileSidebarOpen: false,
  darkMode: false,
};

// Actions
type Action =
  | { type: 'SET_INCIDENTS'; payload: Incident[] }
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'APPEND_TO_LAST_MESSAGE'; payload: string }
  | { type: 'FINALIZE_MESSAGE'; payload: ChatMessage }
  | { type: 'SET_MESSAGES'; payload: ChatMessage[] }
  | { type: 'SET_CONVERSATION'; payload: string }
  | { type: 'SET_AGENT_STATES'; payload: AgentState[] }
  | { type: 'UPDATE_AGENT_STATUS'; payload: { agent: string; status: string } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'TOGGLE_MOBILE_SIDEBAR' }
  | { type: 'SET_CONFIG'; payload: AppConfig }
  | { type: 'SET_MOCK_DATA'; payload: boolean }
  | { type: 'TOGGLE_DARK_MODE' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_INCIDENTS':
      return { ...state, incidents: action.payload };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'APPEND_TO_LAST_MESSAGE': {
      const msgs = [...state.messages];
      const last = msgs[msgs.length - 1];
      if (last) {
        msgs[msgs.length - 1] = { ...last, content: last.content + action.payload };
      }
      return { ...state, messages: msgs };
    }
    case 'FINALIZE_MESSAGE': {
      const updated = [...state.messages];
      updated[updated.length - 1] = action.payload;
      return { ...state, messages: updated, isLoading: false };
    }
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    case 'SET_CONVERSATION':
      return { ...state, currentConversationId: action.payload };
    case 'SET_AGENT_STATES':
      return { ...state, agentStates: action.payload };
    case 'UPDATE_AGENT_STATUS': {
      const { agent, status } = action.payload;
      const exists = state.agentStates.find(a => a.name === agent);
      if (exists) {
        return {
          ...state,
          agentStates: state.agentStates.map(a =>
            a.name === agent
              ? { ...a, status: status as AgentState['status'], completedAt: status === 'completed' ? new Date().toISOString() : a.completedAt }
              : a
          ),
        };
      }
      return {
        ...state,
        agentStates: [...state.agentStates, {
          name: agent as AgentState['name'],
          status: status as AgentState['status'],
          currentTask: null,
          findings: [],
          startedAt: new Date().toISOString(),
          completedAt: null,
        }],
      };
    }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };
    case 'TOGGLE_MOBILE_SIDEBAR':
      return { ...state, mobileSidebarOpen: !state.mobileSidebarOpen };
    case 'SET_CONFIG':
      return { ...state, config: action.payload };
    case 'TOGGLE_DARK_MODE':
      return { ...state, darkMode: !state.darkMode };
    default:
      return state;
  }
}

// Context
const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
}
