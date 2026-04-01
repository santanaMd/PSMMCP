export class PsmmcpError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "PsmmcpError";
  }
}

export class AuthError extends PsmmcpError {
  constructor(message: string, cause?: Error) {
    super(message, "AUTH_ERROR", cause);
    this.name = "AuthError";
  }
}

export class AclDeniedError extends PsmmcpError {
  constructor(
    public readonly identity: string,
    public readonly resource: string,
    public readonly action: string,
    public readonly policyId?: string,
  ) {
    super(
      `Access denied: ${identity} cannot ${action} on ${resource}`,
      "ACL_DENIED",
    );
    this.name = "AclDeniedError";
  }
}

export class SecretNotFoundError extends PsmmcpError {
  constructor(public readonly secretId: string) {
    super(`Secret not found: ${secretId}`, "SECRET_NOT_FOUND");
    this.name = "SecretNotFoundError";
  }
}

export class SecretResolutionError extends PsmmcpError {
  constructor(
    public readonly placeholder: string,
    cause?: Error,
  ) {
    super(
      `Failed to resolve secret placeholder: ${placeholder}`,
      "SECRET_RESOLUTION_ERROR",
      cause,
    );
    this.name = "SecretResolutionError";
  }
}

export class ConfigError extends PsmmcpError {
  constructor(message: string, cause?: Error) {
    super(message, "CONFIG_ERROR", cause);
    this.name = "ConfigError";
  }
}

export class McpBackendError extends PsmmcpError {
  constructor(
    public readonly mcpId: string,
    message: string,
    cause?: Error,
  ) {
    super(`MCP backend error [${mcpId}]: ${message}`, "MCP_BACKEND_ERROR", cause);
    this.name = "McpBackendError";
  }
}
