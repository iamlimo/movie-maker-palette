export type MaintenanceMode = 'on' | 'off';

// Deleted maintenance mode implementation (frontend toggle) as requested.
// File kept intentionally to avoid import/TS resolution errors if any leftover imports exist.
// If you want fully remove this feature, also remove any imports of this module.

export const getMaintenanceMode = (): MaintenanceMode => 'off';
export const setMaintenanceMode = (_mode: MaintenanceMode) => {};
export const isMaintenanceOn = (): boolean => false;
export const STORAGE_KEY_MAINTENANCE = 'maintenanceMode';
