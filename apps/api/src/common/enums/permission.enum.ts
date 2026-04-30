export enum Permission {
  // User Management
  USER_CREATE = "user:create",
  USER_READ = "user:read",
  USER_UPDATE = "user:update",
  USER_DELETE = "user:delete",
  USER_LIST = "user:list",
  PERMISSIONS_ASSIGN = "permissions:assign",

  // Company Management
  COMPANY_CREATE = "company:create",
  COMPANY_READ = "company:read",
  COMPANY_UPDATE = "company:update",
  COMPANY_DELETE = "company:delete",
  COMPANY_LIST = "company:list",

  // Office Management
  OFFICE_CREATE = "office:create",
  OFFICE_READ = "office:read",
  OFFICE_UPDATE = "office:update",
  OFFICE_DELETE = "office:delete",
  OFFICE_LIST = "office:list",

  // Shipping Line Management
  SHIPPING_CREATE = "shipping:create",
  SHIPPING_READ = "shipping:read",
  SHIPPING_UPDATE = "shipping:update",
  SHIPPING_DELETE = "shipping:delete",
  SHIPPING_LIST = "shipping:list",

  // Agent Management
  AGENT_CREATE = "agent:create",
  AGENT_READ = "agent:read",
  AGENT_UPDATE = "agent:update",
  AGENT_DELETE = "agent:delete",
  AGENT_LIST = "agent:list",

  // Quotation Management
  QUOTATION_CREATE = "quotation:create",
  QUOTATION_READ = "quotation:read",
  QUOTATION_UPDATE = "quotation:update",
  QUOTATION_DELETE = "quotation:delete",
  QUOTATION_LIST = "quotation:list",

  // Shipment Management
  SHIPMENT_CREATE = "shipment:create",
  SHIPMENT_READ = "shipment:read",
  SHIPMENT_UPDATE = "shipment:update",
  SHIPMENT_DELETE = "shipment:delete",
  SHIPMENT_LIST = "shipment:list",
  SHIPMENT_TRACK = "shipment:track",
  SHIPMENT_FINANCE = "shipment:finance",
  SHIPMENT_APPROVE = "shipment:approve",
  SUPPLIER_DEBITS_READ = "supplier-debits:read",

  // Reports & Analytics
  REPORTS_VIEW = "reports:view",
  ANALYTICS_VIEW = "analytics:view",

  // System Administration
  SYSTEM_CONFIG = "system:config",
  SYSTEM_LOGS = "system:logs",
  SYSTEM_BACKUP = "system:backup",
}
