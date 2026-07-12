import type {
  ChatRequest, ChatResponse, Incident, IncidentSummary,
  HealthResponse, AppConfig, Conversation, ChatMessage,
} from '@incidentiq/shared-types';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(body.error?.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

// --- Chat API ---
export async function sendMessage(req: ChatRequest): Promise<ChatResponse> {
  return request<ChatResponse>('/api/chat', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function getConversations(): Promise<{ conversations: Conversation[] }> {
  return request('/api/chat/conversations');
}

export async function getConversationMessages(
  conversationId: string
): Promise<{ messages: ChatMessage[] }> {
  return request(`/api/chat/conversations/${conversationId}/messages`);
}

// --- Incidents API ---
export async function getIncidents(
  page = 1,
  pageSize = 20
): Promise<{ incidents: Incident[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }> {
  return request(`/api/incidents?page=${page}&pageSize=${pageSize}`);
}

export async function getIncidentSummary(): Promise<IncidentSummary> {
  return request('/api/incidents/summary');
}

export async function getIncident(id: string): Promise<Incident> {
  return request(`/api/incidents/${id}`);
}

// --- Health API ---
export async function getHealth(): Promise<HealthResponse> {
  return request('/api/health');
}

// --- SSE Stream ---
export async function streamMessage(
  req: ChatRequest,
  onToken: (content: string) => void,
  onDone: (message: ChatMessage, conversationId: string) => void,
  onAgentUpdate: (agent: string, status: 'running' | 'completed') => void,
  onError?: (error: string) => void
): Promise<void> {
  // Bypass Vite proxy — connect directly to backend for streaming
  const streamBase = 'http://localhost:3001';
  const url = `${streamBase}/api/chat/stream?conversationId=${req.conversationId}`;
  
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
  } catch (err) {
    console.error('[streamMessage] fetch error:', err);
    onError?.(`Fetch failed: ${err}`);
    return;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: res.statusText } }));
    onError?.(body.error?.message || `Request failed: ${res.status}`);
    return;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = JSON.parse(line.slice(6));

      if (data.type === 'token') onToken(data.content);
      else if (data.type === 'done') onDone(data.message, data.conversationId);
      else if (data.type === 'agent_started') onAgentUpdate(data.agent, 'running');
      else if (data.type === 'agent_completed') onAgentUpdate(data.agent, 'completed');
      else if (data.type === 'error') onError?.(data.message);
    }
  }
}

// --- File upload helper ---
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // strip data:...;base64, prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
