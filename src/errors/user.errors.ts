import { AppError, ErrorCode } from '@brainwave-project/core';

export class UserNotFoundError extends AppError {
  constructor(id: string) {
    super(`User '${id}' not found`, ErrorCode.NOT_FOUND, 404, { id });
  }
}

export class DuplicateEmailError extends AppError {
  constructor(email: string) {
    super(`Email '${email}' is already registered`, ErrorCode.DUPLICATE, 409, { email });
  }
}

export class DuplicateKeycloakIdError extends AppError {
  constructor(keycloakId: string) {
    super(`Keycloak identity '${keycloakId}' is already linked to an account`, ErrorCode.DUPLICATE, 409, { keycloakId });
  }
}

export class InvalidStateTransitionError extends AppError {
  constructor(from: string, to: string) {
    super(
      `Cannot transition account from '${from}' to '${to}'`,
      ErrorCode.INVALID_STATE_TRANSITION,
      409,
      { from, to },
    );
  }
}
