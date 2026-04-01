import pino from "pino";

export interface AuditEvent {
  timestamp: string;
  traceId?: string;
  spanId?: string;
  identity: string;
  action: string;
  resource: string;
  policyId?: string;
  result: "allow" | "deny" | "error" | "redacted";
  details?: Record<string, unknown>;
}

export interface AuditLoggerOptions {
  output?: "stdout" | "file";
  filePath?: string;
  level?: string;
}

export class AuditLogger {
  private readonly _logger: pino.Logger;
  private readonly _events: AuditEvent[] = [];

  constructor(options: AuditLoggerOptions = {}) {
    const destination =
      options.output === "file" && options.filePath
        ? pino.destination(options.filePath)
        : pino.destination(1);

    this._logger = pino(
      {
        name: "psmmcp-audit",
        level: options.level || "info",
        formatters: {
          level: (label) => ({ level: label }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
        // Never serialize secret values — this logger is for audit only
        redact: {
          paths: ["secret", "password", "token", "value", "*.secret", "*.password", "*.token"],
          censor: "[REDACTED]",
        },
      },
      destination,
    );
  }

  log(event: AuditEvent): void {
    this._events.push(event);
    this._logger.info(
      {
        audit: true,
        traceId: event.traceId,
        spanId: event.spanId,
        identity: event.identity,
        action: event.action,
        resource: event.resource,
        policyId: event.policyId,
        result: event.result,
        details: event.details,
      },
      `[AUDIT] ${event.result.toUpperCase()} ${event.identity} ${event.action} ${event.resource}`,
    );
  }

  query(filters: {
    from?: Date;
    to?: Date;
    identity?: string;
    mcpId?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }): AuditEvent[] {
    let results = this._events;

    if (filters.from) {
      const from = filters.from.toISOString();
      results = results.filter((e) => e.timestamp >= from);
    }
    if (filters.to) {
      const to = filters.to.toISOString();
      results = results.filter((e) => e.timestamp <= to);
    }
    if (filters.identity) {
      results = results.filter((e) => e.identity === filters.identity);
    }
    if (filters.mcpId) {
      results = results.filter((e) => e.resource.includes(filters.mcpId!));
    }
    if (filters.action) {
      results = results.filter((e) => e.action === filters.action);
    }

    const offset = filters.offset || 0;
    const limit = filters.limit || 100;
    return results.slice(offset, offset + limit);
  }
}
