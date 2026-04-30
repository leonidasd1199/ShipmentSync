/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { Pencil, Save, X } from "lucide-react";
import { useUser } from "../hooks/useUser";
import { useAuthStore } from "../stores/auth.store";
import ChangePasswordModal from "../components/modals/Users/ChangePasswordModal";
import { changePassword } from "../services/auth.service";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+\d()\s-]*$/;

export default function ProfileScreen() {
    const { user: me, isLoading, refresh, updateMyProfile } = useUser();
    const setUser = useAuthStore((s) => s.setUser ?? (() => { }));

    const [editing, setEditing] = useState(false);
    const [firstName, setFirstName] = useState(me?.firstName ?? "");
    const [lastName, setLastName] = useState(me?.lastName ?? "");
    const [email, setEmail] = useState(me?.email ?? "");
    const [phone, setPhone] = useState(me?.phone ?? "");

    const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
    const [, setAvatarFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [showPasswordModal, setShowPasswordModal] = useState(false);

    useEffect(() => {
        setFirstName(me?.firstName ?? "");
        setLastName(me?.lastName ?? "");
        setEmail(me?.email ?? "");
        setPhone(me?.phone ?? "");
        // setAvatarPreviewUrl(me?.avatarUrl ?? null);
    }, [me]);

    const initials = useMemo(() => {
        const base = (`${me?.firstName ?? ""} ${me?.lastName ?? ""}`.trim()) || (me?.email ?? "U");
        return base ? base[0].toUpperCase() : "U";
    }, [me]);

    const original = useMemo(
        () => ({
            firstName: me?.firstName ?? "",
            lastName: me?.lastName ?? "",
            email: me?.email ?? "",
            phone: me?.phone ?? "",
        }),
        [me?.firstName, me?.lastName, me?.email, me?.phone]
    );

    const diff = useMemo(() => {
        const d: any = {};
        if (firstName.trim() !== original.firstName) d.firstName = firstName.trim();
        if (lastName.trim() !== original.lastName) d.lastName = lastName.trim();
        if (email.trim() !== original.email) d.email = email.trim();
        if ((phone ?? "").trim() !== (original.phone ?? "")) d.phone = phone.trim() || undefined;
        return d;
    }, [firstName, lastName, email, phone, original]);

    const isDirty = Object.keys(diff).length > 0;
    const emailValid = useMemo(() => EMAIL_REGEX.test((email ?? "").trim()), [email]);
    const phoneValid = useMemo(() => PHONE_REGEX.test((phone ?? "").trim()), [phone]);
    const canSave = editing && !saving && isDirty && emailValid && phoneValid;

    const handleStartEdit = () => {
        setEditing(true);
        setError(null);
    };

    const handleCancel = () => {
        setFirstName(original.firstName);
        setLastName(original.lastName);
        setEmail(original.email);
        setPhone(original.phone);
        setAvatarFile(null);
        setAvatarPreviewUrl(null);
        setEditing(false);
        setError(null);
    };

    const openPicker = () => {
        if (!editing) return;
        fileInputRef.current?.click();
    };

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        setAvatarFile(file);
        if (file) setAvatarPreviewUrl(URL.createObjectURL(file));
        else setAvatarPreviewUrl(null);
    };

    const onDropAvatar = (e: React.DragEvent) => {
        if (!editing) return;
        e.preventDefault();
        e.stopPropagation();
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith("image/")) {
            setAvatarFile(file);
            setAvatarPreviewUrl(URL.createObjectURL(file));
        }
    };
    const onDragOver = (e: React.DragEvent) => {
        if (!editing) return;
        e.preventDefault();
    };

    const handleSave = useCallback(async () => {
        if (!canSave) return;
        setSaving(true);
        setError(null);
        try {
            await updateMyProfile(diff);
            await refresh();

            setEditing(false);
        } catch (e: any) {
            setError(e?.response?.data?.message ?? "Failed to update profile. Please try again.");
        } finally {
            setSaving(false);
        }
    }, [canSave, diff, refresh, setUser, updateMyProfile]);

    const handleChangePassword = async (payload: { currentPassword: string; newPassword: string }) => {
        await changePassword(payload);
        setShowPasswordModal(false);
    };

    return (
        <div className="min-h-[calc(100vh-56px)] bg-white p-4 sm:p-6 text-neutral-900">
            <div className="mx-auto w-full max-w-3xl">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-[22px] font-semibold">My Profile</h1>

                    {!editing ? (
                        <button
                            type="button"
                            onClick={handleStartEdit}
                            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
                            title="Edit profile"
                            disabled={isLoading}
                        >
                            <Pencil size={16} />
                            Edit
                        </button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={!canSave}
                                className="inline-flex items-center gap-2 rounded-lg border border-neutral-900 bg-white px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Save profile"
                            >
                                <Save size={16} />
                                {saving ? "Saving..." : "Save"}
                            </button>
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
                                title="Cancel editing"
                            >
                                <X size={16} />
                                Cancel
                            </button>
                        </div>
                    )}
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6 shadow-sm">
                    <div className="mb-6 flex items-center gap-4">
                        <div
                            className="relative h-20 w-20 shrink-0"
                            onDrop={onDropAvatar}
                            onDragOver={onDragOver}
                        >
                            {avatarPreviewUrl ? (
                                <img
                                    src={avatarPreviewUrl}
                                    alt="Avatar"
                                    className="h-20 w-20 rounded-full object-cover border border-neutral-200"
                                />
                            ) : (
                                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 text-lg font-semibold text-neutral-700 select-none">
                                    {initials}
                                </div>
                            )}
                            <label
                                htmlFor="avatarFile"
                                className={[
                                    "absolute inset-0 rounded-full",
                                    editing ? "cursor-pointer" : "pointer-events-none",
                                    "bg-transparent outline-none ring-0 border-0",
                                ].join(" ")}
                                title={editing ? "Change avatar" : undefined}
                            />

                            {editing && <button
                                type="button"
                                onClick={openPicker}
                                disabled={!editing}
                                className="absolute -bottom-1 -right-[40px] z-20 flex h-8 items-center justify-center rounded-full bg-transparent text-neutral-700 hover:bg-neutral-100 disabled:opacity-100"
                                title={editing ? 'Change avatar' : 'Edit to change avatar'}
                                aria-label="Change avatar"
                            >
                                <Pencil size={14} className="text-neutral-700" />
                            </button>

                            }

                            <input
                                id="avatarFile"
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={onFileChange}
                            />
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="mb-1 block text-sm font-medium text-neutral-800">Name</label>
                        {!editing ? (
                            <p className="text-sm text-neutral-700 break-all">
                                {(me?.firstName || me?.lastName)
                                    ? `${me?.firstName ?? ""} ${me?.lastName ?? ""}`.trim()
                                    : "—"}
                            </p>
                        ) : (
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <input
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    placeholder="First name"
                                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                                    maxLength={50}
                                />
                                <input
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    placeholder="Last name"
                                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                                    maxLength={50}
                                />
                            </div>
                        )}
                    </div>

                    {/* Password (sin texto "Edit", más asteriscos) */}
                    <div className="mb-6 flex items-center gap-2 text-sm text-neutral-600">
                        <span className="select-none">Password: ************</span>
                        <button
                            type="button"
                            onClick={() => setShowPasswordModal(true)}
                            className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white p-1 text-neutral-800 hover:bg-neutral-50"
                            title="Change password"
                            aria-label="Change password"
                        >
                            <Pencil size={12} />
                        </button>
                    </div>

                    <div className="mb-4">
                        <label className="mb-1 block text-sm font-medium text-neutral-800">Email</label>
                        {!editing ? (
                            <p className="text-sm text-neutral-700 break-all">{me?.email ?? "—"}</p>
                        ) : (
                            <div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@domain.com"
                                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                                    maxLength={120}
                                />
                                {!emailValid && (
                                    <p className="mt-1 text-xs text-red-500">Please enter a valid email.</p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="mb-2">
                        <label className="mb-1 block text-sm font-medium text-neutral-800">Phone</label>
                        {!editing ? (
                            <p className="text-sm text-neutral-700 break-all">{me?.phone?.trim() || "—"}</p>
                        ) : (
                            <div>
                                <input
                                    type="tel"
                                    inputMode="tel"
                                    value={phone}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        if (PHONE_REGEX.test(v)) setPhone(v);
                                    }}
                                    placeholder="+1 (555) 555-5555"
                                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                                    maxLength={30}
                                />
                                {!phoneValid && (
                                    <p className="mt-1 text-xs text-red-500">Only digits, +, (), spaces and -.</p>
                                )}
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    {editing && !isDirty && (
                        <p className="mt-3 text-xs text-neutral-500">Make some changes to enable Save.</p>
                    )}
                </div>
            </div>

            <ChangePasswordModal
                open={showPasswordModal}
                forceChange={false}
                onClose={() => setShowPasswordModal(false)}
                onChangePassword={handleChangePassword}
            />
        </div>
    );
}
