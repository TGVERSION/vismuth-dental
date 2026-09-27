// Сборка ответа о состоянии сессии — общая для GET одной сессии и для списка.

import { buildMockTranscription } from './transcript';
import { MOCK_ERROR_TEXT } from './mode';
import {
  isProcessingDone,
  processingProgress,
  type MockSession,
} from './store';

export interface StatusPayload {
  session_id: string;
  protocol_id: string;
  status: 'recording' | 'processing' | 'done' | 'error';
  created_at: string | null;
  progress: number | null;
  transcript: string | null;
  field_values: Record<string, string> | null;
  error: string | null;
}

export const statusPayload = async (
  session: MockSession,
  authorization: string,
): Promise<StatusPayload> => {
  const base = {
    session_id: session.sessionId,
    protocol_id: session.protocolId,
    created_at: session.createdAt
      ? new Date(session.createdAt).toISOString()
      : null,
    transcript: null,
    field_values: null,
    error: null,
  };

  if (session.completedAt === null) {
    return { ...base, status: 'recording', progress: null };
  }

  if (!isProcessingDone(session)) {
    return {
      ...base,
      status: 'processing',
      progress: processingProgress(session),
    };
  }

  // Режим error: обработка завершилась сбоем с причиной.
  if (session.mode === 'error') {
    return { ...base, status: 'error', progress: 1, error: MOCK_ERROR_TEXT };
  }

  const { transcript, fieldValues } = await buildMockTranscription(
    session.protocolId,
    authorization,
  );

  return {
    ...base,
    status: 'done',
    progress: 1,
    transcript,
    field_values: fieldValues,
  };
};
