type ApiPayload = Record<string, unknown>;

function htmlSnippetToMessage(value: string) {
  const clean = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.slice(0, 180);
}

export async function parseApiPayload(response: Response): Promise<ApiPayload> {
  const raw = await response.text();

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as ApiPayload) : {};
  } catch {
    return {
      error: htmlSnippetToMessage(raw) || 'Unexpected server response. Please try again.',
    };
  }
}

export function getApiError(payload: ApiPayload, fallback: string) {
  const maybeError = payload.error;
  return typeof maybeError === 'string' && maybeError.trim() ? maybeError : fallback;
}
