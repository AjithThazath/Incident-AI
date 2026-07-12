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
