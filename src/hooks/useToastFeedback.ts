import { useEffect, useRef, useState, type SetStateAction } from 'react';
import { toast } from 'sonner';

type FeedbackKind = 'auto' | 'error' | 'success';

function getMessages(value: unknown): string[] {
  if (value instanceof Error) {
    return getMessages(value.message);
  }

  if (typeof value === 'string') {
    const message = value.trim();
    if (
      !message ||
      /^(?:https?:\/\/|\/|[a-z]:\\)/i.test(message) ||
      /^(?:GET|POST|PUT|PATCH|DELETE)\s+\S+\s*(?:→|->)\s*\d{3}$/i.test(message)
    ) {
      return [];
    }

    return [message];
  }

  if (Array.isArray(value)) {
    return value.flatMap(getMessages);
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const directMessage = record.message ?? record.detail ?? record.error;
    if (directMessage !== undefined) {
      return getMessages(directMessage);
    }

    return Object.values(record).flatMap(getMessages);
  }

  return [];
}

export function getToastMessage(value: unknown): string | null {
  const message = [...new Set(getMessages(value))].join(' ');
  return message || null;
}

export function useToastFeedback<T>(
  initialValue: T,
  kind: FeedbackKind,
  fallbackMessage?: string,
): [T, (value: SetStateAction<T>) => void] {
  const [value, setValue] = useState(initialValue);
  const lastMessage = useRef('');

  useEffect(() => {
    const message =
      getToastMessage(value) ??
      (value === true ? fallbackMessage ?? '' : '');

    if (!message) {
      lastMessage.current = '';
      return;
    }

    if (message === lastMessage.current) return;
    lastMessage.current = message;

    const isError =
      kind === 'error' ||
      (kind === 'auto' &&
        /\b(?:error|failed|failure|unable|could not|cannot|no redirect|invalid)\b/i.test(message));

    if (isError) {
      toast.error(message, { id: `error-${message}` });
    } else {
      toast.success(message, { id: `success-${message}` });
    }
  }, [fallbackMessage, kind, value]);

  return [value, setValue];
}
