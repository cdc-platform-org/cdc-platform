// Keep accidental credentials out of stored conversations, summaries and
// provider prompts. This is intentionally shared with knowledge ingestion.
export function redactIakoSecrets(input: string): { text: string; redacted: boolean } {
  const text = input
    .replace(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, '[REDACTED PRIVATE KEY]')
    .replace(/\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AIza[A-Za-z0-9_-]{25,}|sb_(?:secret|publishable)_[A-Za-z0-9_-]{16,})\b/g, '[REDACTED TOKEN]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED TOKEN]')
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+\/-]{8,}/gi, '$1[REDACTED]')
    .replace(/((?:[A-Za-z0-9_]*(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD|PASSWD|DATABASE_URL|CONNECTION_STRING)[A-Za-z0-9_]*|პაროლი|ტოკენი)\s*["']?\s*[:=]\s*)(?:"[^"\r\n]+"|'[^'\r\n]+'|[^\s,;\r\n}]+)/gi, '$1[REDACTED]')
    .replace(/\b((?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|https?):\/\/)[^\s/@:]+:[^\s/@]+@/gi, '$1[REDACTED]@');
  return { text, redacted: text !== input };
}
