import React from "react";
import { Navigate } from "react-router-dom";

type PermissionGateProps = {
  requiredPermission?: string;
  userPermissions?: string[];
  children: React.ReactNode;
  redirect?: boolean;
};

export function PermissionGate({
  requiredPermission,
  userPermissions = [],
  children,
  redirect = false,
}: PermissionGateProps) {
  if (!requiredPermission) return <>{children}</>;

  const hasPermission = userPermissions.includes(requiredPermission);
  if (!hasPermission) {
    if (redirect) return <Navigate to="/" replace />;
    return <></>;
  }

  return <>{children}</>;
}