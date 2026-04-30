import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
    ChevronLeft,
    ChevronRight,
    Home,
    LifeBuoy,
    KeyRound,
    SquareChartGantt,
    Stamp,
    Building2,
    Users,
    Files,
    Ship,
    UserStar,
    DollarSign,
    Wallet
} from 'lucide-react';

import { useAuthStore } from '../stores/auth.store';
import { PERMISSIONS } from '../utils/permissions';
import { PermissionGate } from '../components/PermissionGate';

const nav = [
    { to: '/', label: 'Dashboard', icon: <Home size={18} /> },
    { to: '/agents', label: 'Agents', icon: <UserStar size={18} />, requiredPermission: PERMISSIONS.AGENT_LIST },
    { to: '/clients', label: 'Clients', icon: <Users size={18} />, requiredPermission: PERMISSIONS.CLIENT_LIST },
    { to: '/offices', label: 'Offices', icon: <Building2 size={18} />, requiredPermission: PERMISSIONS.OFFICE_LIST },
    { to: '/suppliers', label: 'Suppliers', icon: <Stamp size={18} />, requiredPermission: PERMISSIONS.SHIPPING_LIST },
    { to: '/finance', label: 'Finance', icon: <Wallet size={18} />, requiredPermission: PERMISSIONS.SUPPLIER_DEBITS_READ },
    { to: '/pricing/suppliers', label: 'Pricelist Review', icon: <DollarSign size={18} />, requiredPermission: PERMISSIONS.SHIPPING_READ },
    { to: "/templates", label: "Templates", icon: <Files size={18} />, requiredPermission: ''  },
    { to: '/estimates', label: 'Estimates', icon: <SquareChartGantt size={18} />, requiredPermission: PERMISSIONS.QUOTATION_LIST },
    { to: '/shipments', label: 'Shipments', icon: <Ship size={18} />, requiredPermission: PERMISSIONS.SHIPMENT_LIST },
    { to: '/users/permissions', label: 'Permissions', icon: <KeyRound size={18} />, requiredPermission: PERMISSIONS.PERMISSIONS_ASSIGN },
    { to: '/help', label: 'Help Desk', icon: <LifeBuoy size={18} />, requiredPermission: ''  },
];

const clientNav = [
    { to: '/', label: 'Dashboard', icon: <Home size={18} />, requiredPermission: '' },
    { to: '/quotations', label: 'Quotations', icon: <SquareChartGantt size={18} />, requiredPermission: ''  },
    { to: '/client-shipments', label: 'Products', icon: <Files size={18} />, requiredPermission: '' },
    { to: '/settings', label: 'Settings', icon: <KeyRound size={18} />, requiredPermission: ''  },
    { to: '/help', label: 'Help Center', icon: <LifeBuoy size={18} />, requiredPermission: ''  },
];

export default function AppSidebar({ initialExpanded = true }) {
    const [expanded, setExpanded] = useState(initialExpanded);
    const [isMobile, setIsMobile] = useState(false);

    const { user } = useAuthStore();

    const isClient = user?.roleCode === "client";
    const userPermissions = user?.permissions ?? [];

    const items = isClient ? clientNav : nav;

    useEffect(() => {
        const mq = window.matchMedia('(max-width: 768px)');

        const handle = (e: MediaQueryListEvent | MediaQueryList) => {
            const mobile = 'matches' in e ? e.matches : (e as MediaQueryList).matches;
            setIsMobile(mobile);

            if (mobile) setExpanded(false);
        };

        handle(mq);

        mq.addEventListener('change', handle);

        return () => mq.removeEventListener('change', handle);
    }, []);

    const lockedCollapsed = isMobile;
    const widthClass = !lockedCollapsed && expanded ? 'w-64' : 'w-16';

    return (
        <aside
            className={[
                'h-[calc(100vh-56px)] border-r border-neutral-800 bg-neutral-900 transition-all duration-200 ease-in-out sticky top-14 flex flex-col justify-between',
                widthClass,
            ].join(' ')}
        >
            <nav className="p-2">
                {items.map((item) => {

                    const link = (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                [
                                    'group relative mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                                    isActive
                                        ? 'bg-neutral-800 text-white'
                                        : 'text-neutral-300 hover:bg-neutral-800',
                                ].join(' ')
                            }
                        >
                            <span className="inline-flex h-6 w-6 items-center justify-center text-neutral-400">
                                {item.icon}
                            </span>

                            <span className={expanded ? 'block' : 'hidden'}>
                                {item.label}
                            </span>

                            {(lockedCollapsed || !expanded) && (
                                <span className="pointer-events-none absolute left-14 z-50 hidden rounded-md bg-neutral-800 px-2 py-1 text-xs text-white group-hover:block">
                                    {item.label}
                                </span>
                            )}
                        </NavLink>
                    );

                    if (isClient || !item.requiredPermission) {
                        return link;
                    }

                    return (
                        <PermissionGate
                            key={item.to}
                            requiredPermission={item.requiredPermission}
                            userPermissions={userPermissions}
                        >
                            {link}
                        </PermissionGate>
                    );
                })}
            </nav>

            {!lockedCollapsed && (
                <div className="p-2 flex items-center justify-end">
                    <button
                        onClick={() => {
                            if (lockedCollapsed) return;
                            setExpanded((e) => !e);
                        }}
                        disabled={lockedCollapsed}
                        className={[
                            'rounded-md p-2 text-neutral-300 w-full flex justify-center',
                            lockedCollapsed
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:bg-neutral-800',
                        ].join(' ')}
                    >
                        {!lockedCollapsed &&
                            (expanded ? <ChevronLeft size={18} /> : <ChevronRight size={18} />)}

                        {lockedCollapsed && <ChevronRight size={18} />}
                    </button>
                </div>
            )}
        </aside>
    );
}
