/** Direct translation of a Daml `assertMsg`/`assertFail` failure. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

/** Direct translation of a Daml `controller X` authorization failure. */
export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}
