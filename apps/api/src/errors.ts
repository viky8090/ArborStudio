/**
 * RFC 7807 problem+json error helpers.
 *
 * https://datatracker.ietf.org/doc/html/rfc7807
 */

export function problemJson(status: number, title: string, detail?: string, extra?: Record<string, unknown>) {
  return {
    type: 'about:blank',
    title,
    status,
    ...(detail ? { detail } : {}),
    ...(extra ?? {}),
  };
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly title: string,
    detail?: string,
    public readonly extra?: Record<string, unknown>,
  ) {
    super(detail ?? title);
    this.name = 'HttpError';
  }

  toJSON() {
    return problemJson(this.status, this.title, this.message, this.extra);
  }
}
