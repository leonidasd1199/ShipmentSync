import React from "react";
import { Navigate } from "react-router-dom";

type RoleGateProps = {
    requiredRole?: string | string[];
    userRole?: string;
    children: React.ReactNode;
    redirect?: boolean;
};

export function RoleGate({
    requiredRole,
    userRole,
    children,
    redirect = false,
}: RoleGateProps) {

    if (!requiredRole) return <>{children}</>;

    const allowedRoles = Array.isArray(requiredRole)
        ? requiredRole
        : [requiredRole];

    const hasRole = allowedRoles.includes(userRole ?? "");

    if (!hasRole) {
        if (redirect) return <Navigate to="/" replace />;
        return <></>;
    }

    return <>{children}</>;
}