import { useState, useCallback } from 'react';
import type { ChatMessage, ChatRequest } from '@incidentiq/shared-types';
import { sendMessage, streamMessage } from '../api/client';
import { useAppContext } from '../context/AppContext';
import { v4 as uuid } from 'uuid';

// Simple UUID generator for frontend (no dependency needed)
function generateId(): string {
  return crypto.randomUUID();
}

export function useChat() {
  const { state, dispatch } = useAppContext();
  const [inputValue, setInputValue] = useState('');

  const loadMockMessages = useCallback(() => {
    dispatch({ type: 'SET_MESSAGES', payload: mockMessages });
    dispatch({ type: 'SET_CONVERSATION', payload: 'conv-1' });
  }, [dispatch]);

  const sendUserMessage = useCallback(async (
    content: string,
    attachments?: File[],
    feedbackResponse?: { requestId: string; selectedOption?: string; freeText?: string },
    incidentId?: string
  ) => {
    if (!content.trim() && !feedbackResponse) return;

    const conversationId = state.currentConversationId || generateId();

    dispatch({ type: 'SET_AGENT_STATES', payload: [] });

    // Add user message to UI immediately
    if (content.trim()) {
      const userMessage: ChatMessage = {
        id: generateId(),
        conversationId,
        role: 'user',
        content,
        agentName: null,
        metadata: {},
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: 'ADD_MESSAGE', payload: userMessage });
    }

    dispatch({ type: 'SET_CONVERSATION', payload: conversationId });
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const request: ChatRequest = {
        message: content,
        conversationId,
        incidentId,
        feedbackResponse,
      };
        // Add placeholder assistant message for streaming
        const placeholderMessage: ChatMessage = {
          id: generateId(),
          conversationId,
          role: 'assistant',
          content: '',
          agentName: 'system',
          metadata: {},
          createdAt: new Date().toISOString(),
        };
        dispatch({ type: 'ADD_MESSAGE', payload: placeholderMessage });

        await streamMessage(
          request,
          (token) => dispatch({ type: 'APPEND_TO_LAST_MESSAGE', payload: token }),
          (message) => dispatch({ type: 'FINALIZE_MESSAGE', payload: message }),
          (agent, status) => dispatch({ type: 'UPDATE_AGENT_STATUS', payload: { agent, status } }),
          (error) => dispatch({ type: 'SET_ERROR', payload: error }),
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.currentConversationId, dispatch]);

  const resetChat = useCallback(() => {
    dispatch({ type: 'SET_MESSAGES', payload: [] });
    dispatch({ type: 'SET_CONVERSATION', payload: null as any });
    dispatch({ type: 'SET_AGENT_STATES', payload: [] });
    setInputValue('');
  }, [dispatch]);

  return {
    messages: state.messages,
    isLoading: state.isLoading,
    error: state.error,
    inputValue,
    setInputValue,
    sendUserMessage,
    loadMockMessages,
    resetChat,
    agentStates: state.agentStates,
  };
}
