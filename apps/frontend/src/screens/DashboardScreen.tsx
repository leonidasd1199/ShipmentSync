import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/auth.store";
import { PermissionGate } from "../components/PermissionGate";

import {
  Users,
  Building2,
  BarChart3,
  User as UserIcon,
  Settings,
  Files,
  Stamp,
  LifeBuoy,
  KeyRound,
  SquareChartGantt,
  Wallet,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

import { PERMISSIONS } from "../utils/permissions";

import quotationsImage from "../assets/images/quotations.png";
import introductionImage from "../assets/images/introduction.png";
import productsImage from "../assets/images/products.png";

type Item = {
  to: string;
  label: string;
  Icon: React.ComponentType<{ size?: number }>;
  requiredPermission?: string;
};

type CarouselItem = {
  to: string;
  img: string;
  alt: string;
};

export default function DashboardScreen() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const greetingName = user?.firstName || "user";
  const userPermissions = user?.permissions || [];
  const isClient = user?.roleCode === "client";

  const [slide, setSlide] = useState(0);

  const carousel: CarouselItem[] = [
    {
      to: "/dashboard",
      img: introductionImage,
      alt: 'Welcome'
    },
    {
      to: "/quotations",
      img: quotationsImage,
      alt: "Quotations"
    },
    {
      to: "/client-shipments",
      img: productsImage,
      alt: "Products"
    }
  ];

  useEffect(() => {
    if (!isClient) return;

    const interval = setInterval(() => {
      setSlide((s) => (s + 1) % carousel.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isClient, carousel.length]);

  const prev = () =>
    setSlide((s) => (s === 0 ? carousel.length - 1 : s - 1));

  const next = () =>
    setSlide((s) => (s + 1) % carousel.length);

  const adminItems: Item[] = [
    { to: "/clients", label: "Clients", Icon: Users, requiredPermission: PERMISSIONS.CLIENT_LIST },
    { to: "/offices", label: "Offices", Icon: Building2, requiredPermission: PERMISSIONS.OFFICE_LIST },
    { to: "/users/permissions", label: "Permissions", Icon: KeyRound, requiredPermission: PERMISSIONS.PERMISSIONS_ASSIGN },
    { to: "/reports", label: "Reports", Icon: BarChart3, requiredPermission: PERMISSIONS.REPORTS_VIEW },
    { to: "/me", label: "Profile", Icon: UserIcon },
    { to: "/settings", label: "Settings", Icon: Settings },
    { to: "/templates", label: "Templates", Icon: Files },
    { to: "/suppliers", label: "Suppliers", Icon: Stamp, requiredPermission: PERMISSIONS.SHIPPING_LIST },
    { to: "/finance", label: "Finance", Icon: Wallet, requiredPermission: PERMISSIONS.SUPPLIER_DEBITS_READ },
    { to: "/estimates", label: "Estimates", Icon: SquareChartGantt, requiredPermission: PERMISSIONS.QUOTATION_LIST },
    { to: "/help", label: "Help Desk", Icon: LifeBuoy },
  ];

  const clientItems: Item[] = [
    { to: "/quotations", label: "Quotations", Icon: SquareChartGantt },
    { to: "/client-shipments", label: "Products", Icon: Files },
    { to: "/settings", label: "Settings", Icon: Settings },
    { to: "/help", label: "Help Center", Icon: LifeBuoy },
  ];

  const items = isClient ? clientItems : adminItems;

  return (
    <div className="bg-white text-black px-6 py-6">
      <div className="mx-auto w-full max-w-6xl">
        <h2 className="text-xl sm:text-2xl font-semibold mb-6">
          Hi {greetingName}!
        </h2>

        {isClient && (
          <div className="mb-8">
            <div className="relative flex justify-center">
              <button
                type="button"
                onClick={prev}
                className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white p-2 shadow hover:bg-neutral-50"
                aria-label="Previous slide"
              >
                <ChevronLeft size={18} />
              </button>

              <button
                type="button"
                onClick={next}
                className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white p-2 shadow hover:bg-neutral-50"
                aria-label="Next slide"
              >
                <ChevronRight size={18} />
              </button>

              <button
                type="button"
                onClick={() => navigate(carousel[slide].to)}
                className="block w-full overflow-hidden rounded-xl bg-transparent focus:outline-none"
                >
                <img
                  src={carousel[slide].img}
                  alt={carousel[slide].alt}
                  className="w-full h-[420px] object-contain"
                />
              </button>
            </div>

            <div className="mt-3 flex justify-center gap-2">
              {carousel.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSlide(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={
                    slide === i
                      ? "h-2 w-6 rounded-full bg-neutral-700"
                      : "h-2 w-2 rounded-full bg-neutral-300"
                  }
                />
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(({ to, label, Icon, requiredPermission }) => {
            const card = (
              <button
                key={to}
                onClick={() => navigate(to)}
                className="group w-full rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-neutral-300 hover:shadow-sm"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-neutral-200">
                    <Icon size={22} />
                  </div>

                  <span className="text-center text-sm font-medium text-neutral-900">
                    {label}
                  </span>
                </div>
              </button>
            );

            if (isClient || !requiredPermission) return card;

            return (
              <PermissionGate
                key={to}
                requiredPermission={requiredPermission}
                userPermissions={userPermissions}
              >
                {card}
              </PermissionGate>
            );
          })}
        </div>
      </div>
    </div>
  );
}
