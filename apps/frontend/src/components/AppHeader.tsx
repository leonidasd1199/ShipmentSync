import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthStore } from "../stores/auth.store";
import { Settings, LogOut, UserIcon } from "lucide-react";

export default function AppHeader({ title = "App" }: { title?: string }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const initials = useMemo(() => {
    const base = (`${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim()) || (user?.email ?? "U");
    return base ? base[0].toUpperCase() : "U";
}, [user]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleSettings = () => {
    setOpen(false);
    navigate("/settings");
  };

  const handleProfile = () => {
    navigate("/me");
    setOpen(false);
  };


  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-800 bg-neutral-900">
      <div className="flex h-14 items-center justify-between px-4">
        <h1 className="font-semibold text-white text-[18px]">{title}</h1>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((v: boolean) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-700 text-white"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="User menu"
          >
            <span className="text-sm font-semibold select-none">{initials}</span>
          </button>

          {open && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-lg"
            >
               <button
                role="menuitem"
                onClick={handleProfile}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-800"
              >
                <UserIcon size={16} className="text-neutral-300" />
                My Profile
              </button>

              <button
                role="menuitem"
                onClick={handleSettings}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-800"
              >
                <Settings size={16} className="text-neutral-300" />
                Settings
              </button>

              <div className="mx-2 my-1 h-px bg-neutral-800" />

              <button
                role="menuitem"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-300 hover:bg-neutral-800"
              >
                <LogOut size={16} />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
