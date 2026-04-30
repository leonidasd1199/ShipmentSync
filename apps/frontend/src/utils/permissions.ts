export enum PERMISSIONS {
  USER_CREATE = "user:create",
  USER_READ = "user:read",
  USER_UPDATE = "user:update",
  USER_DELETE = "user:delete",
  USER_LIST = "user:list",

  PERMISSIONS_ASSIGN = "permissions:assign",

  COMPANY_CREATE = "company:create",
  COMPANY_READ = "company:read",
  COMPANY_UPDATE = "company:update",
  COMPANY_DELETE = "company:delete",
  COMPANY_LIST = "company:list",

  OFFICE_CREATE = "office:create",
  OFFICE_READ = "office:read",
  OFFICE_UPDATE = "office:update",
  OFFICE_DELETE = "office:delete",
  OFFICE_LIST = "office:list",

  CLIENT_CREATE = "client:create",
  CLIENT_READ = "client:read",
  CLIENT_UPDATE = "client:update",
  CLIENT_DELETE = "client:delete",
  CLIENT_LIST = "client:list",

  SHIPMENT_CREATE = "shipment:create",
  SHIPMENT_READ = "shipment:read",
  SHIPMENT_UPDATE = "shipment:update",
  SHIPMENT_DELETE = "shipment:delete",
  SHIPMENT_LIST = "shipment:list",
  SHIPMENT_TRACK = "shipment:track",
  SHIPMENT_FINANCE = "shipment:finance",
  SHIPMENT_APPROVE = "shipment:approve",
  SUPPLIER_DEBITS_READ = "supplier-debits:read",

  REPORTS_VIEW = "reports:view",
  ANALYTICS_VIEW = "analytics:view",

  SYSTEM_CONFIG = "system:config",
  SYSTEM_LOGS = "system:logs",
  SYSTEM_BACKUP = "system:backup",

  AUDIT_VIEW = "audit:view",

  SHIPPING_CREATE = "shipping:create",
  SHIPPING_READ = "shipping:read",
  SHIPPING_UPDATE = "shipping:update",
  SHIPPING_DELETE = "shipping:delete",
  SHIPPING_LIST = "shipping:list",

  AGENT_CREATE = "agent:create",
  AGENT_READ = "agent:read",
  AGENT_UPDATE = "agent:update",
  AGENT_DELETE = "agent:delete",
  AGENT_LIST = "agent:list",

  QUOTATION_CREATE = "quotation:create",
  QUOTATION_READ = "quotation:read",
  QUOTATION_UPDATE = "quotation:update",
  QUOTATION_DELETE = "quotation:delete",
  QUOTATION_LIST = "quotation:list",

  TEMPLATE_CREATE = "template:create",
  TEMPLATE_READ = "template:read",
  TEMPLATE_UPDATE = "template:update",
  TEMPLATE_DELETE = "template:delete",
  TEMPLATE_LIST = "template:list",

    // Agent Portal Permissions
  AGENT_PORTAL_ACCESS = "agent-portal:access",
  AGENT_PRICE_MAINTENANCE = "agent-portal:price-maintenance",
}
