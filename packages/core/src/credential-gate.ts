const REDACTED = "[REDACTED]";

export class CredentialGate {
  private readonly _secrets: Set<string>;

  constructor(secretValues: Set<string> | string[]) {
    this._secrets = new Set(
      (Array.isArray(secretValues) ? secretValues : [...secretValues]).filter(
        (s) => s.length > 0,
      ),
    );
  }

  scan(data: unknown): { cleaned: unknown; redactedCount: number } {
    let redactedCount = 0;

    const walk = (value: unknown): unknown => {
      if (typeof value === "string") {
        let result = value;
        for (const secret of this._secrets) {
          if (result.includes(secret)) {
            result = result.replaceAll(secret, REDACTED);
            redactedCount++;
          }
        }
        return result;
      }

      if (Array.isArray(value)) {
        return value.map(walk);
      }

      if (value !== null && typeof value === "object") {
        const obj: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          obj[k] = walk(v);
        }
        return obj;
      }

      return value;
    };

    const cleaned = walk(data);
    return { cleaned, redactedCount };
  }

  addSecret(value: string): void {
    if (value.length > 0) this._secrets.add(value);
  }

  get secretCount(): number {
    return this._secrets.size;
  }
}
