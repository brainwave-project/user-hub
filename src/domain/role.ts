/**
 * Platform roles — must mirror the roles seeded in postgres/init/02-user-management.sql
 * and the Keycloak realm roles in keycloak/realm-export.json.
 */
export enum Role {
  ADMIN  = 'ADMIN',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}
