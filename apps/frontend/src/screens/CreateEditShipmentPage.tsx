/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Calendar } from "primereact/calendar";
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2,
  Ship,
  Plane,
  Truck,
  Globe,
  Package,
  Users,
  FileText,
  DollarSign,
  TrendingUp,
  Anchor,
  List,
  X,
  RefreshCw,
  Paperclip,
  Eye,
} from "lucide-react";

import { ShipmentsService } from "../services/shipments.service";
import { ShippingsService } from "../services/shipping.service";
import { PortsService } from "../services/ports.service";
import { ClientsService } from "../services/clients.service";
import { QuotationsService } from "../services/quotations.service";
import type { QuotationResponse } from "../utils/types/quotation.type";
import type {
  CreateShipmentDto,
  Shipment,
  ShipmentModeType,
  ShipmentStatusType,
  ContainerPackage,
  ShipmentDocItem,
  LedgerLine,
  QuotationSnapshot,
} from "../utils/types/shipment.type";
import type { ShippingLine } from "../utils/types/shipping.type";
import type { Port } from "../utils/types/port.type";
import type { Client } from "../utils/types/client.type";
import { ShipmentModeEnum, ShipmentStatusEnum, ShippingModeEnum } from "../utils/constants";
import { useAuthStore } from "../stores/auth.store";
import SearchablePortSelectWithCreate from "../components/SearchablePortSelectWithCreate";
import LedgerLineUploadDocumentModal from "../components/modals/LedgerLineUploadDocumentModal";
import LedgerLineDocumentsModal from "../components/modals/LedgerLineDocumentsModal";
import BaseModal from "../components/modals/BaseModal";

import "./QuotationsScreen.css";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type TabId =
  | "shipment"
  | "parties"
  | "transport"
  | "cargo"
  | "documents"
  | "finance"
  | "profit";

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const input =
  "block w-full rounded-md border border-neutral-200 px-3 py-2 text-sm bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400 focus:border-neutral-400 transition-colors";

const select =
  "block w-full rounded-md border border-neutral-200 px-3 py-2 text-sm bg-white text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-400 focus:border-neutral-400 transition-colors";

const label =
  "mb-1.5 block text-xs font-medium text-neutral-500 uppercase tracking-wide";

const numericInput = `${input} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const MODE_OPTIONS: {
  value: ShipmentModeType;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: ShipmentModeEnum.OCEAN, label: "Ocean", icon: <Ship size={14} /> },
  { value: ShipmentModeEnum.AIR, label: "Air", icon: <Plane size={14} /> },
  { value: ShipmentModeEnum.LAND, label: "Land", icon: <Truck size={14} /> },
  { value: ShipmentModeEnum.MULTIMODAL, label: "Multimodal", icon: <Globe size={14} /> },
];

const INCOTERMS = [
  "EXW",
  "FCA",
  "FAS",
  "FOB",
  "CFR",
  "CIF",
  "CPT",
  "CIP",
  "DAP",
  "DPU",
  "DDP",
];
const CONTAINER_TYPES = [
  "20GP",
  "40GP",
  "40HC",
  "40HQ",
  "45HC",
  "20RF",
  "40RF",
  "20OT",
  "40OT",
  "LCL",
];
const PACKAGE_TYPES = [
  "PALLETS",
  "CARTONS",
  "BOXES",
  "BAGS",
  "DRUMS",
  "CRATES",
  "ROLLS",
];

const COMMON_DOC_TYPES = [
  "COMMERCIAL_INVOICE",
  "PACKING_LIST",
  "DEBIT_PDF",
  "CREDIT_PDF",
];

const MODE_DOCS_MAP: Record<ShipmentModeType, string[]> = {
  OCEAN: ["BL", "MBL", "HBL", ...COMMON_DOC_TYPES],
  LAND: ["CARTA_PORTE", "MANIFIESTO_CARGA", ...COMMON_DOC_TYPES],
  AIR: ["HAWB", ...COMMON_DOC_TYPES],
  MULTIMODAL: [
    "BL",
    "CARTA_PORTE",
    "MANIFIESTO_CARGA",
    "HAWB",
    ...COMMON_DOC_TYPES,
  ],
};

/** Quotation API `shippingMode` → shipment `mode` */
const SHIPPING_MODE_TO_MODE: Record<ShippingModeEnum, ShipmentModeType> = {
  [ShippingModeEnum.MARITIME]: ShipmentModeEnum.OCEAN,
  [ShippingModeEnum.AIR]: ShipmentModeEnum.AIR,
  [ShippingModeEnum.ROAD]: ShipmentModeEnum.LAND,
};

const DOC_TYPE_LABELS: Record<string, string> = {
  BL: "Bill of Lading",
  MBL: "Master Bill of Lading",
  HBL: "House Bill of Lading",
  CARTA_PORTE: "Carta Porte",
  MANIFIESTO_CARGA: "Cargo Manifest",
  HAWB: "House Air Waybill",
  COMMERCIAL_INVOICE: "Commercial Invoice",
  PACKING_LIST: "Packing List",
  DEBIT_PDF: "Debit Note",
  CREDIT_PDF: "Credit Note",
};

const SHIPMENT_WORKFLOW_STATUSES: ShipmentStatusType[] = [
  ShipmentStatusEnum.DRAFT,
  ShipmentStatusEnum.READY_FOR_FINANCE,
  ShipmentStatusEnum.FINANCE_REVIEW,
  ShipmentStatusEnum.APPROVED,
  ShipmentStatusEnum.CLOSED,
];

const SHIPMENT_STATUS_LABELS: Record<ShipmentStatusType, string> = {
  [ShipmentStatusEnum.DRAFT]: "Draft",
  [ShipmentStatusEnum.READY_FOR_FINANCE]: "Ready for Finance",
  [ShipmentStatusEnum.FINANCE_REVIEW]: "Finance review",
  [ShipmentStatusEnum.APPROVED]: "Approved",
  [ShipmentStatusEnum.CLOSED]: "Closed",
};

type WorkflowPermission =
  | "shipment:update"
  | "shipment:finance"
  | "shipment:approve";

const WORKFLOW_TRANSITIONS: Partial<
  Record<
    ShipmentStatusType,
    Partial<Record<ShipmentStatusType, WorkflowPermission>>
  >
> = {
  [ShipmentStatusEnum.DRAFT]: {
    [ShipmentStatusEnum.READY_FOR_FINANCE]: "shipment:update",
  },
  [ShipmentStatusEnum.READY_FOR_FINANCE]: {
    [ShipmentStatusEnum.FINANCE_REVIEW]: "shipment:finance",
  },
  [ShipmentStatusEnum.FINANCE_REVIEW]: {
    [ShipmentStatusEnum.APPROVED]: "shipment:approve",
    [ShipmentStatusEnum.DRAFT]: "shipment:approve",
  },
  [ShipmentStatusEnum.APPROVED]: {
    [ShipmentStatusEnum.CLOSED]: "shipment:approve",
  },
};

function isWorkflowTransitionAllowed(
  from: ShipmentStatusType,
  to: ShipmentStatusType,
): boolean {
  if (from === to) return true;
  return Boolean(WORKFLOW_TRANSITIONS[from]?.[to]);
}

function workflowPermissionForTransition(
  from: ShipmentStatusType,
  to: ShipmentStatusType,
): string | null {
  if (from === to) return null;
  return WORKFLOW_TRANSITIONS[from]?.[to] ?? null;
}

function userHasWorkflowPermission(
  permissions: string[] | undefined,
  permission: string,
): boolean {
  return Boolean(permissions?.includes(permission));
}

function isWorkflowOptionDisabled(
  permissions: string[] | undefined,
  from: ShipmentStatusType,
  to: ShipmentStatusType,
): boolean {
  if (from === to) return false;
  if (!isWorkflowTransitionAllowed(from, to)) return true;
  const need = workflowPermissionForTransition(from, to);
  if (!need) return true;
  return !userHasWorkflowPermission(permissions, need);
}

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "shipment", label: "Shipment", icon: <Ship size={13} /> },
  { id: "parties", label: "Parties", icon: <Users size={13} /> },
  { id: "transport", label: "Transport", icon: <Anchor size={13} /> },
  { id: "cargo", label: "Cargo", icon: <Package size={13} /> },
  { id: "documents", label: "Documents", icon: <FileText size={13} /> },
  { id: "finance", label: "Finance", icon: <DollarSign size={13} /> },
  { id: "profit", label: "Profit", icon: <TrendingUp size={13} /> },
];

type DimUnit = "cm" | "in" | "m";

type PackageRow = {
  _key: string;
  type: string;
  quantity: string;
  length: string;
  width: string;
  height: string;
  unit: DimUnit;
};

type ContainerRow = {
  _key: string;
  containerNumber: string;
  sealNumber: string;
  containerType: string;
  packages: PackageRow[];
};

const emptyPackage = (): PackageRow => ({
  _key: Math.random().toString(36).slice(2),
  type: "",
  quantity: "",
  length: "",
  width: "",
  height: "",
  unit: "cm",
});

const emptyContainer = (): ContainerRow => ({
  _key: Math.random().toString(36).slice(2),
  containerNumber: "",
  sealNumber: "",
  containerType: "",
  packages: [],
});

function isBlankContainerRow(c: ContainerRow): boolean {
  return (
    !String(c.containerNumber ?? "").trim() &&
    !String(c.sealNumber ?? "").trim() &&
    !String(c.containerType ?? "").trim() &&
    c.packages.length === 0
  );
}

function usesContainerCargoTab(mode: ShipmentModeType): boolean {
  return (
    mode === ShipmentModeEnum.OCEAN ||
    mode === ShipmentModeEnum.MULTIMODAL ||
    mode === ShipmentModeEnum.LAND
  );
}

const DIMENSION_UNITS: { value: DimUnit; label: string }[] = [
  { value: "cm", label: "cm" },
  { value: "m", label: "m" },
  { value: "in", label: "in" },
];

function packageRowToDto(p: PackageRow): ContainerPackage | null {
  const L = parseFloat(p.length);
  const W = parseFloat(p.width);
  const H = parseFloat(p.height);
  if (!Number.isFinite(L) || !Number.isFinite(W) || !Number.isFinite(H)) {
    return null;
  }
  const q = p.quantity.trim() === "" ? undefined : Number(p.quantity);
  return {
    type: p.type.trim() || undefined,
    ...(q != null && Number.isFinite(q) ? { quantity: q } : {}),
    dimensions: {
      length: L,
      width: W,
      height: H,
      unit: p.unit,
    },
  };
}

function mapLoadedPackagesToRows(packages: unknown): PackageRow[] {
  if (!Array.isArray(packages) || packages.length === 0) return [];
  return packages.map((p: any) => ({
    _key: Math.random().toString(36).slice(2),
    type: p.type ?? "",
    quantity: p.quantity != null ? String(p.quantity) : "",
    length: p.dimensions?.length != null ? String(p.dimensions.length) : "",
    width: p.dimensions?.width != null ? String(p.dimensions.width) : "",
    height: p.dimensions?.height != null ? String(p.dimensions.height) : "",
    unit: (p.dimensions?.unit as DimUnit) || "cm",
  }));
}

function CargoPackageRowFields({
  pk,
  onFieldChange,
  onRemove,
}: {
  pk: PackageRow;
  onFieldChange: (
    field: keyof Omit<PackageRow, "_key">,
    value: string | DimUnit,
  ) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 items-end rounded border border-neutral-100 bg-neutral-50/60 p-2">
      <div className="col-span-2 sm:col-span-1">
        <span className="mb-0.5 block text-[10px] text-neutral-400">Type</span>
        <select
          value={pk.type}
          onChange={(e) => onFieldChange("type", e.target.value)}
          className={select}
        >
          <option value="">— Select —</option>
          {PACKAGE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <span className="mb-0.5 block text-[10px] text-neutral-400">Qty</span>
        <input
          type="number"
          min={0}
          value={pk.quantity}
          onChange={(e) => onFieldChange("quantity", e.target.value)}
          className={numericInput}
        />
      </div>
      <div>
        <span className="mb-0.5 block text-[10px] text-neutral-400">L</span>
        <input
          type="number"
          min={0}
          step="any"
          value={pk.length}
          onChange={(e) => onFieldChange("length", e.target.value)}
          className={numericInput}
        />
      </div>
      <div>
        <span className="mb-0.5 block text-[10px] text-neutral-400">W</span>
        <input
          type="number"
          min={0}
          step="any"
          value={pk.width}
          onChange={(e) => onFieldChange("width", e.target.value)}
          className={numericInput}
        />
      </div>
      <div>
        <span className="mb-0.5 block text-[10px] text-neutral-400">H</span>
        <input
          type="number"
          min={0}
          step="any"
          value={pk.height}
          onChange={(e) => onFieldChange("height", e.target.value)}
          className={numericInput}
        />
      </div>
      <div>
        <span className="mb-0.5 block text-[10px] text-neutral-400">Unit</span>
        <select
          value={pk.unit}
          onChange={(e) => onFieldChange("unit", e.target.value as DimUnit)}
          className={select}
        >
          {DIMENSION_UNITS.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </div>
      <div className="col-span-2 sm:col-span-1 flex justify-end pb-0.5">
        <button
          type="button"
          onClick={onRemove}
          title="Remove package"
          className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-neutral-300 bg-white px-2 text-[16px] font-bold leading-none text-neutral-700 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function Divider() {
  return <hr className="my-6 border-neutral-100" />;
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-28 gap-4 text-center px-6">
      <div className="text-neutral-200">{icon}</div>
      <div>
        <p className="text-sm font-medium text-neutral-500">{title}</p>
        <p className="mt-1 text-xs text-neutral-400 max-w-xs mx-auto">
          {description}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

export default function CreateEditShipmentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<TabId>("shipment");

  // ── Server data ──
  const [shippingLines, setShippingLines] = useState<ShippingLine[]>([]);
  const [ports, setPorts] = useState<Port[]>([]);
  const [loadingHelpers, setLoadingHelpers] = useState(false);
  const [loadingShipment, setLoadingShipment] = useState(isEdit);

  // ── Shipment tab ──
  const [mode, setMode] = useState<ShipmentModeType>("OCEAN");
  const [incoterm, setIncoterm] = useState("FOB");
  const [movementType, setMovementType] = useState("");
  const [bookingNumber, setBookingNumber] = useState("");
  const [mblNumber, setMblNumber] = useState("");
  const [hblNumber, setHblNumber] = useState("");
  const [shippingLineId, setShippingLineId] = useState("");

  // ── Parties tab ──
  const [shipperName, setShipperName] = useState("");
  const [shipperAddress, setShipperAddress] = useState("");
  const [shipperContact, setShipperContact] = useState("");
  const [shipperRtn, setShipperRtn] = useState("");
  const [consigneeName, setConsigneeName] = useState("");
  const [consigneeAddress, setConsigneeAddress] = useState("");
  const [consigneeContact, setConsigneeContact] = useState("");
  const [consigneeRtn, setConsigneeRtn] = useState("");
  const [notifyPartyText, setNotifyPartyText] = useState("");

  // ── Client selector for parties ──
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [shipperMode, setShipperMode] = useState<"client" | "free">("free");
  const [consigneeMode, setConsigneeMode] = useState<"client" | "free">("free");
  const [shipperClientId, setShipperClientId] = useState("");
  const [consigneeClientId, setConsigneeClientId] = useState("");

  // ── Transport tab ──
  const [vesselName, setVesselName] = useState("");
  const [voyageNumber, setVoyageNumber] = useState("");
  const [portOfLoadingId, setPortOfLoadingId] = useState("");
  const [portOfDischargeId, setPortOfDischargeId] = useState("");
  const [placeOfReceipt, setPlaceOfReceipt] = useState("");
  const [placeOfDelivery, setPlaceOfDelivery] = useState("");
  const [hawbNumber, setHawbNumber] = useState("");
  const [airportOfDeparture, setAirportOfDeparture] = useState("");
  const [airportOfDestination, setAirportOfDestination] = useState("");
  const [cartaPorteNumber, setCartaPorteNumber] = useState("");
  const [placeOfLoading, setPlaceOfLoading] = useState("");
  const [placeOfUnloading, setPlaceOfUnloading] = useState("");
  const [landDriver, setLandDriver] = useState("");
  const [landPlaque, setLandPlaque] = useState("");
  const [landLicense, setLandLicense] = useState("");
  const [etd, setEtd] = useState<Date | null>(null);
  const [eta, setEta] = useState<Date | null>(null);
  const [atd, setAtd] = useState<Date | null>(null);
  const [ata, setAta] = useState<Date | null>(null);

  // ── Cargo tab ──
  const [containers, setContainers] = useState<ContainerRow[]>(() =>
    isEdit ? [] : [emptyContainer()],
  );
  /** AIR: multiple package lines at cargo level (same row model as packages inside containers) */
  const [airPackages, setAirPackages] = useState<PackageRow[]>([]);
  const [goodsDescription, setGoodsDescription] = useState("");
  const [grossWeightKg, setGrossWeightKg] = useState("");
  const [volumeCbm, setVolumeCbm] = useState("");

  // ── UI ──
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // ── Documents tab ──
  const [docsData, setDocsData] = useState<{
    documents: ShipmentDocItem[];
    requiredDocumentTypes: string[];
  } | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsLoadError, setDocsLoadError] = useState<string | null>(null);
  const [docErrors, setDocErrors] = useState<Record<string, string>>({});
  const [generatingDocType, setGeneratingDocType] = useState<string | null>(
    null,
  );

  // ── Finance / Ledger tab ──
  const [ledgerLines, setLedgerLines] = useState<LedgerLine[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [quotationSnapshot, setQuotationSnapshot] =
    useState<QuotationSnapshot | null>(null);
  const [importedQuotationId, setImportedQuotationId] = useState<string | null>(
    null,
  );
  const [importingQuotation, setImportingQuotation] = useState(false);
  const [newSide, setNewSide] = useState<"DEBIT" | "CREDIT">("DEBIT");
  const [newDescription, setNewDescription] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCurrency, setNewCurrency] = useState("USD");
  const [newSupplierId, setNewSupplierId] = useState("");
  const [addingLine, setAddingLine] = useState(false);
  const [deletingLineId, setDeletingLineId] = useState<string | null>(null);

  const [shipmentStatus, setShipmentStatus] = useState<ShipmentStatusType>("DRAFT");
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [financeApproveOpen, setFinanceApproveOpen] = useState(false);
  const [financeApproveNote, setFinanceApproveNote] = useState("");
  const [financeRejectOpen, setFinanceRejectOpen] = useState(false);
  const [financeRejectNote, setFinanceRejectNote] = useState("");
  const [financeRejectError, setFinanceRejectError] = useState<string | null>(
    null,
  );

  /** Staged files for pending pricelist rows (before shipment save) — debit rows only in UI */
  const [ledgerLineAttachments, setLedgerLineAttachments] = useState<
    Record<string, { fileName: string; note: string }>
  >({});
  const [ledgerUploadModal, setLedgerUploadModal] = useState<
    | { mode: "local"; key: string; label: string }
    | { mode: "persist"; line: LedgerLine }
    | null
  >(null);

  const [ledgerDocsLine, setLedgerDocsLine] = useState<LedgerLine | null>(
    null,
  );
  const [ledgerDocsRefreshKey, setLedgerDocsRefreshKey] = useState(0);
  const [ledgerAttachmentSuccessMessage, setLedgerAttachmentSuccessMessage] =
    useState<string | null>(null);

  // ── Quotation picker (import from quotation) ──
  const [showQuotationPicker, setShowQuotationPicker] = useState(false);
  const [quotationPickerLoading, setQuotationPickerLoading] = useState(false);
  const [quotationPickerResults, setQuotationPickerResults] = useState<
    QuotationResponse[] | null
  >(null);
  const [quotationPickerError, setQuotationPickerError] = useState<
    string | null
  >(null);
  const [quotationApplied, setQuotationApplied] = useState(false);

  // ── Pending pricelist ledger items (queued when creating new shipment) ──
  const [pendingPricelistItems, setPendingPricelistItems] = useState<
    Array<{
      name: string;
      cost: number;
      price: number;
      profit: number;
      currency: string;
    }>
  >([]);

  // ── Load helpers ──
  useEffect(() => {
    const load = async () => {
      setLoadingHelpers(true);
      setClientsLoading(true);
      try {
        const [lines, portList, clientList] = await Promise.all([
          ShippingsService.findAll(),
          PortsService.findAll(),
          ClientsService.findAll().catch(() => [] as Client[]),
        ]);
        setShippingLines(lines ?? []);
        setPorts(portList ?? []);
        setClients(clientList ?? []);
      } catch {
        /* non-blocking */
      } finally {
        setLoadingHelpers(false);
        setClientsLoading(false);
      }
    };
    void load();
  }, []);

  // ── Load existing shipment ──
  useEffect(() => {
    if (!isEdit || !id) return;
    const load = async () => {
      setLoadingShipment(true);
      try {
        const s = await ShipmentsService.getOne(id);
        setShipmentStatus(s.status ?? "DRAFT");
        setMode(s.mode);
        setIncoterm(s.incoterm ?? "FOB");
        setMovementType(s.movementType ?? "");
        setBookingNumber(s.bookingNumber ?? "");
        setMblNumber(s.mblNumber ?? "");
        setHblNumber(s.hblNumber ?? "");
        setShippingLineId(s.shippingLineId ? String(s.shippingLineId) : "");
        setShipperName(s.parties?.shipper?.name ?? "");
        setShipperAddress(s.parties?.shipper?.address ?? "");
        setShipperContact(s.parties?.shipper?.contact ?? "");
        setShipperRtn(s.parties?.shipper?.rtn ?? "");
        if (s.parties?.shipper?.clientId) {
          setShipperClientId(String(s.parties.shipper.clientId));
          setShipperMode("client");
        }
        setConsigneeName(s.parties?.consignee?.name ?? "");
        setConsigneeAddress(s.parties?.consignee?.address ?? "");
        setConsigneeContact(s.parties?.consignee?.contact ?? "");
        setConsigneeRtn(s.parties?.consignee?.rtn ?? "");
        if (s.parties?.consignee?.clientId) {
          setConsigneeClientId(String(s.parties.consignee.clientId));
          setConsigneeMode("client");
        }
        setNotifyPartyText(s.parties?.notifyPartyText ?? "");
        setVesselName(s.transport?.vesselName ?? "");
        setVoyageNumber(s.transport?.voyageNumber ?? "");
        setPortOfLoadingId(
          s.transport?.portOfLoadingId
            ? String(s.transport.portOfLoadingId)
            : "",
        );
        setPortOfDischargeId(
          s.transport?.portOfDischargeId
            ? String(s.transport.portOfDischargeId)
            : "",
        );
        setPlaceOfReceipt(s.transport?.placeOfReceipt ?? "");
        setPlaceOfDelivery(s.transport?.placeOfDelivery ?? "");
        const air = s.transport?.air;
        setHawbNumber(air?.hawbNumber ?? "");
        setAirportOfDeparture(air?.airportOfDeparture ?? "");
        setAirportOfDestination(air?.airportOfDestination ?? "");
        const land = s.transport?.land;
        setCartaPorteNumber(land?.cartaPorteNumber ?? "");
        setPlaceOfLoading(land?.placeOfLoading ?? "");
        setPlaceOfUnloading(land?.placeOfUnloading ?? "");
        setLandDriver(land?.driver ?? land?.driverName ?? "");
        setLandPlaque(land?.plaque ?? land?.truckPlate ?? "");
        setLandLicense(land?.license ?? land?.driverLicense ?? "");
        if (s.dates?.etd) setEtd(new Date(s.dates.etd));
        if (s.dates?.eta) setEta(new Date(s.dates.eta));
        if (s.dates?.atd) setAtd(new Date(s.dates.atd));
        if (s.dates?.ata) setAta(new Date(s.dates.ata));
        if (s.mode === "AIR") {
          setContainers([]);
        } else {
          const mappedContainers = (s.cargo?.containers ?? []).map(
            (c: any) => ({
              _key: Math.random().toString(36).slice(2),
              containerNumber: c.containerNumber ?? "",
              sealNumber: c.sealNumber ?? "",
              containerType: c.containerType ?? "",
              packages: (c.packages ?? []).map((p: any) => ({
                _key: Math.random().toString(36).slice(2),
                type: p.type ?? "",
                quantity: p.quantity != null ? String(p.quantity) : "",
                length:
                  p.dimensions?.length != null
                    ? String(p.dimensions.length)
                    : "",
                width:
                  p.dimensions?.width != null ? String(p.dimensions.width) : "",
                height:
                  p.dimensions?.height != null
                    ? String(p.dimensions.height)
                    : "",
                unit: (p.dimensions?.unit as DimUnit) || "cm",
              })),
            }),
          );
          setContainers(
            mappedContainers.length > 0
              ? mappedContainers
              : [emptyContainer()],
          );
        }
        if (s.mode === "AIR") {
          const rootPkgs = mapLoadedPackagesToRows(
            (s.cargo as { packages?: unknown })?.packages,
          );
          if (rootPkgs.length > 0) {
            setAirPackages(rootPkgs);
          } else if (
            s.cargo?.packagesQuantity != null ||
            (s.cargo?.packagesType &&
              String(s.cargo.packagesType).trim() !== "")
          ) {
            setAirPackages([
              {
                _key: Math.random().toString(36).slice(2),
                type: s.cargo?.packagesType ?? "",
                quantity:
                  s.cargo?.packagesQuantity != null
                    ? String(s.cargo.packagesQuantity)
                    : "",
                length: "",
                width: "",
                height: "",
                unit: "cm",
              },
            ]);
          } else {
            setAirPackages([]);
          }
        } else {
          setAirPackages([]);
        }
        setGoodsDescription(s.cargo?.goodsDescription ?? "");
        setGrossWeightKg(
          s.cargo?.grossWeightKg != null ? String(s.cargo.grossWeightKg) : "",
        );
        setVolumeCbm(
          s.cargo?.volumeCbm != null ? String(s.cargo.volumeCbm) : "",
        );
        if (s.quotationSnapshot) {
          setQuotationSnapshot(s.quotationSnapshot);
          if (s.quotationId) setImportedQuotationId(s.quotationId);
        }
      } catch {
        setError("Failed to load shipment data.");
      } finally {
        setLoadingShipment(false);
      }
    };
    void load();
  }, [id, isEdit]);

  // Keep at least one container row when using Ocean / Multimodal / Land cargo UI
  useEffect(() => {
    if (!usesContainerCargoTab(mode)) return;
    setContainers((prev) =>
      prev.length === 0 ? [emptyContainer()] : prev,
    );
  }, [mode]);

  // ── Container / package helpers ──
  const addContainer = () => setContainers((p) => [...p, emptyContainer()]);
  const removeContainer = (key: string) =>
    setContainers((p) =>
      p.length <= 1 ? p : p.filter((c) => c._key !== key),
    );
  const updateContainer = (
    key: string,
    field: keyof Omit<ContainerRow, "_key" | "packages">,
    value: string,
  ) =>
    setContainers((p) =>
      p.map((c) => (c._key === key ? { ...c, [field]: value } : c)),
    );
  const addPackageToContainer = (containerKey: string) =>
    setContainers((p) =>
      p.map((c) =>
        c._key === containerKey
          ? { ...c, packages: [...c.packages, emptyPackage()] }
          : c,
      ),
    );
  const removePackageFromContainer = (
    containerKey: string,
    packageKey: string,
  ) =>
    setContainers((p) =>
      p.map((c) =>
        c._key === containerKey
          ? {
              ...c,
              packages: c.packages.filter((pk) => pk._key !== packageKey),
            }
          : c,
      ),
    );
  const updatePackageRow = (
    containerKey: string,
    packageKey: string,
    field: keyof Omit<PackageRow, "_key">,
    value: string | DimUnit,
  ) =>
    setContainers((p) =>
      p.map((c) => {
        if (c._key !== containerKey) return c;
        return {
          ...c,
          packages: c.packages.map((pk) =>
            pk._key === packageKey ? { ...pk, [field]: value } : pk,
          ),
        };
      }),
    );

  const addAirPackage = () => setAirPackages((p) => [...p, emptyPackage()]);
  const removeAirPackage = (packageKey: string) =>
    setAirPackages((p) => p.filter((pk) => pk._key !== packageKey));
  const updateAirPackageRow = (
    packageKey: string,
    field: keyof Omit<PackageRow, "_key">,
    value: string | DimUnit,
  ) =>
    setAirPackages((p) =>
      p.map((pk) => (pk._key === packageKey ? { ...pk, [field]: value } : pk)),
    );

  const handlePortCreated = useCallback((newPort: Port) => {
    setPorts((p) => [...p, newPort]);
  }, []);

  const fetchQuotations = useCallback(async () => {
    setQuotationPickerLoading(true);
    setQuotationPickerError(null);
    try {
      const res = await QuotationsService.findAll({
        limit: 100,
        sort: "createdAt",
        order: "DESC" as any,
        status: "sent" as any,
      });
      setQuotationPickerResults(res.items ?? []);
    } catch {
      setQuotationPickerError("Could not load quotations.");
      setQuotationPickerResults(null);
    } finally {
      setQuotationPickerLoading(false);
    }
  }, []);

  const applyQuotation = useCallback(
    async (quotation: QuotationResponse) => {
      if (quotation.incoterm) setIncoterm(quotation.incoterm);
      if (quotation.shippingMode) {
        setMode(SHIPPING_MODE_TO_MODE[quotation.shippingMode] ?? "OCEAN");
      }
      if (quotation.shippingLineId) setShippingLineId(quotation.shippingLineId);
      if (quotation.portOfOrigin) setPortOfLoadingId(quotation.portOfOrigin);
      if (quotation.portOfDestination)
        setPortOfDischargeId(quotation.portOfDestination);

      // Auto-populate shipper from quotation client
      if (quotation.clientId) {
        const client = clients.find((c) => c.id === quotation.clientId);
        setShipperMode("client");
        setShipperClientId(quotation.clientId);
        if (client) {
          setShipperName(client.name);
          const addr = client.address
            ? [
                client.address.street,
                client.address.city,
                client.address.state,
                client.address.country,
              ]
                .filter(Boolean)
                .join(", ")
            : "";
          setShipperAddress(addr);
          setShipperContact(client.contactPerson ?? client.phone ?? "");
          setShipperRtn(client.taxId ?? "");
        }
      }

      // Auto-populate cargo description and containers from quotation items
      const allItems = (quotation as any).items?.length
        ? (quotation as any).items
        : ((quotation as any).legacyItems ?? []);
      if (allItems.length > 0) {
        const desc = allItems
          .map((item: any) => item.description)
          .filter(Boolean)
          .join(", ");
        if (desc) setGoodsDescription(desc);
        const containerItems = allItems.filter(
          (item: any) => item.equipmentType,
        );
        if (containerItems.length > 0) {
          const importedRows: ContainerRow[] = containerItems.map(
            (item: any) => ({
              _key: Math.random().toString(36).slice(2),
              containerNumber: "",
              sealNumber: "",
              containerType: item.equipmentType,
              packages: [] as PackageRow[],
            }),
          );
          setContainers((prev) => {
            const onlyBlank =
              prev.length === 1 && isBlankContainerRow(prev[0]);
            if (onlyBlank) return importedRows;
            return [...prev, ...importedRows];
          });
        }
      }

      setShowQuotationPicker(false);
      setQuotationApplied(true);
      setTimeout(() => setQuotationApplied(false), 4000);

      // Build and persist quotation snapshot
      const currency = quotation.pricingConfig?.currency ?? "USD";
      const snapshot: QuotationSnapshot = {
        quotationId: quotation.id,
        serviceType: quotation.serviceType,
        incoterm: quotation.incoterm,
        shippingMode: quotation.shippingMode,
        clientId: quotation.clientId,
        agentId: quotation.agentId,
        shippingLineId: quotation.shippingLineId,
        portOfOrigin: quotation.portOfOrigin,
        portOfDestination: quotation.portOfDestination,
        currency,
        total: quotation.total,
        validUntil: quotation.validUntil
          ? String(quotation.validUntil)
          : undefined,
        items: ((quotation as any).items?.length
          ? (quotation as any).items
          : ((quotation as any).legacyItems ?? [])
        ).map((item: any, idx: number) => ({
          itemId: String(idx),
          description: item.description,
          price: item.price,
          profit:
            item.price != null && item.cost != null
              ? item.price - item.cost
              : undefined,
          quantity: item.quantity ?? 1,
        })),
      };
      setQuotationSnapshot(snapshot);
      setImportedQuotationId(quotation.id);

      const items = (quotation as any).items?.length
        ? (quotation as any).items
        : ((quotation as any).legacyItems ?? []);
      if (items.length === 0) return;

      if (!id) {
        const pending = items.map((item: any) => ({
          name: item.description,
          cost: item.cost ?? 0,
          price: item.price ?? 0,
          profit: (item.price ?? 0) - (item.cost ?? 0),
          currency,
        }));
        setPendingPricelistItems((prev) => [...prev, ...pending]);
        return;
      }

      setLedgerError(null);
      try {
        const newLines: LedgerLine[] = [];
        for (const item of items as any[]) {
          const cost = item.cost ?? 0;
          const price = item.price ?? 0;
          if (cost > 0) {
            const debit = await ShipmentsService.createLedgerLine(id, {
              side: "DEBIT",
              description: item.description,
              amount: cost,
              currency,
            });
            newLines.push(debit);
          }
          if (price > 0) {
            const credit = await ShipmentsService.createLedgerLine(id, {
              side: "CREDIT",
              description: item.description,
              amount: price,
              currency,
            });
            newLines.push(credit);
          }
        }
        if (newLines.length > 0)
          setLedgerLines((prev) => [...prev, ...newLines]);
      } catch (err: any) {
        setLedgerError(
          err?.response?.data?.message ?? "Failed to import quotation items.",
        );
      }
    },
    [id, clients],
  );

  // ── Client selector helpers ──
  const handleShipperClientSelect = useCallback(
    (clientId: string) => {
      setShipperClientId(clientId);
      const client = clients.find((c) => c.id === clientId);
      if (client) {
        setShipperName(client.name);
        const addr = client.address
          ? [
              client.address.street,
              client.address.city,
              client.address.state,
              client.address.country,
            ]
              .filter(Boolean)
              .join(", ")
          : "";
        setShipperAddress(addr);
        setShipperContact(client.contactPerson ?? client.phone ?? "");
        setShipperRtn(client.taxId ?? "");
      }
    },
    [clients],
  );

  const handleConsigneeClientSelect = useCallback(
    (clientId: string) => {
      setConsigneeClientId(clientId);
      const client = clients.find((c) => c.id === clientId);
      if (client) {
        setConsigneeName(client.name);
        const addr = client.address
          ? [
              client.address.street,
              client.address.city,
              client.address.state,
              client.address.country,
            ]
              .filter(Boolean)
              .join(", ")
          : "";
        setConsigneeAddress(addr);
        setConsigneeContact(client.contactPerson ?? client.phone ?? "");
        setConsigneeRtn(client.taxId ?? "");
      }
    },
    [clients],
  );

  // ── Initial tab from navigation state ──
  useEffect(() => {
    const tab = (location.state as any)?.tab as TabId | undefined;
    if (tab) setActiveTab(tab);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load documents when documents tab is active ──
  useEffect(() => {
    if (activeTab !== "documents" || !isEdit || !id) return;
    const load = async () => {
      setDocsLoading(true);
      setDocsLoadError(null);
      setDocErrors({});
      try {
        const data = await ShipmentsService.getDocuments(id);
        setDocsData(data);
      } catch {
        setDocsLoadError("Failed to load documents.");
      } finally {
        setDocsLoading(false);
      }
    };
    void load();
  }, [activeTab, isEdit, id]);

  // ── Load ledger when finance/profit tab is active ──
  useEffect(() => {
    if (activeTab !== "finance" && activeTab !== "profit") return;
    if (!isEdit || !id) return;
    const load = async () => {
      setLedgerLoading(true);
      setLedgerError(null);
      try {
        const lines = await ShipmentsService.getLedgerLines(id);
        setLedgerLines(lines);
        // Auto-import from quotation snapshot if no lines exist yet
        if (lines.length === 0 && quotationSnapshot) {
          await importFromSnapshot(id, quotationSnapshot);
        }
      } catch {
        setLedgerError("Failed to load ledger lines.");
      } finally {
        setLedgerLoading(false);
      }
    };
    void load();
  }, [activeTab, isEdit, id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ledgerAttachmentSuccessMessage) return;
    const t = window.setTimeout(
      () => setLedgerAttachmentSuccessMessage(null),
      4500,
    );
    return () => window.clearTimeout(t);
  }, [ledgerAttachmentSuccessMessage]);

  const importFromSnapshot = async (
    shipmentId: string,
    snapshot: QuotationSnapshot,
  ) => {
    if (importingQuotation) return;
    setImportingQuotation(true);
    try {
      const currency = snapshot.currency ?? "USD";
      const newLines: LedgerLine[] = [];
      for (const item of snapshot.items ?? []) {
        const qty = item.quantity ?? 1;
        const price = item.price ?? 0;
        const profit = item.profit ?? 0;
        const cost = price - profit;
        const desc = item.description ?? `Item ${item.itemId}`;
        if (price > 0) {
          const credit = await ShipmentsService.createLedgerLine(shipmentId, {
            side: "CREDIT",
            description: desc,
            amount: price * qty,
            currency,
          });
          newLines.push(credit);
        }
        if (cost > 0) {
          const debit = await ShipmentsService.createLedgerLine(shipmentId, {
            side: "DEBIT",
            description: `Cost: ${desc}`,
            amount: cost * qty,
            currency,
          });
          newLines.push(debit);
        }
      }
      for (const eq of snapshot.equipmentItems ?? []) {
        const qty = eq.quantity ?? 1;
        const price = eq.price ?? 0;
        const desc = eq.label ?? `Equipment ${eq.equipmentItemId}`;
        if (price > 0) {
          const credit = await ShipmentsService.createLedgerLine(shipmentId, {
            side: "CREDIT",
            description: desc,
            amount: price * qty,
            currency,
          });
          newLines.push(credit);
        }
      }
      if (newLines.length > 0) setLedgerLines(newLines);
    } catch {
      /* silent */
    } finally {
      setImportingQuotation(false);
    }
  };

  const handleAddLedgerLine = useCallback(async () => {
    if (!id || !newDescription.trim() || !newAmount || addingLine) return;
    setAddingLine(true);
    setLedgerError(null);
    try {
      const line = await ShipmentsService.createLedgerLine(id, {
        side: newSide,
        description: newDescription.trim(),
        amount: Number(newAmount),
        currency: newCurrency || "USD",
        ...(newSupplierId ? { supplierId: newSupplierId } : {}),
      });
      setLedgerLines((prev) => [...prev, line]);
      setNewDescription("");
      setNewAmount("");
    } catch (err: any) {
      setLedgerError(err?.response?.data?.message ?? "Failed to add line.");
    } finally {
      setAddingLine(false);
    }
  }, [
    id,
    newSide,
    newDescription,
    newAmount,
    newCurrency,
    newSupplierId,
    addingLine,
  ]);

  const handleDeleteLedgerLine = useCallback(
    async (lineId: string) => {
      if (!id || deletingLineId) return;
      setDeletingLineId(lineId);
      try {
        await ShipmentsService.deleteLedgerLine(id, lineId);
        setLedgerLines((prev) => prev.filter((l) => l._id !== lineId));
      } catch (err: any) {
        setLedgerError(
          err?.response?.data?.message ?? "Failed to delete line.",
        );
      } finally {
        setDeletingLineId(null);
      }
    },
    [id, deletingLineId],
  );

  const refreshLedgerAfterDocumentUpload = useCallback(async () => {
    if (!id) return;
    setLedgerError(null);
    try {
      const lines = await ShipmentsService.getLedgerLines(id);
      setLedgerLines(lines);
      setLedgerDocsRefreshKey((k) => k + 1);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Failed to refresh ledger.";
      setLedgerError(Array.isArray(msg) ? msg.join(", ") : String(msg));
    }
  }, [id]);

  const openLedgerDocumentsModal = useCallback((line: LedgerLine) => {
    setLedgerDocsLine(line);
  }, []);

  // ── Document handlers ──
  const handleGenerateDocument = useCallback(
    async (docType: string) => {
      if (!id || generatingDocType) return;
      setGeneratingDocType(docType);
      setDocErrors((prev) => {
        const next = { ...prev };
        delete next[docType];
        return next;
      });
      try {
        await ShipmentsService.generateDocument(id, docType);
        const data = await ShipmentsService.getDocuments(id);
        setDocsData(data);
      } catch (err: any) {
        const msg =
          err?.response?.data?.message ?? err?.message ?? "Generation failed.";
        setDocErrors((prev) => ({
          ...prev,
          [docType]: Array.isArray(msg) ? msg.join(", ") : msg,
        }));
      } finally {
        setGeneratingDocType(null);
      }
    },
    [id, generatingDocType],
  );

  const handleDownloadDocument = useCallback(
    async (docType: string, version: number) => {
      if (!id) return;
      try {
        const blob = await ShipmentsService.downloadDocumentBlob(
          id,
          docType,
          version,
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${docType}-${id}-v${version}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        setDocErrors((prev) => ({ ...prev, [docType]: "Download failed." }));
      }
    },
    [id],
  );

  // ── Build DTO ──
  const buildDto = useCallback((): CreateShipmentDto => {
    const companyId =
      (user?.company as any)?._id ?? (user?.company as any)?.id ?? "";
    const officeId =
      (user?.offices?.[0] as any)?._id ?? (user?.offices?.[0] as any)?.id ?? "";
    const operationalUserId = (user as any)?._id ?? (user as any)?.id ?? "";
    const isAirMode = mode === "AIR";
    const isOceanOrMultiForDto =
      mode === "OCEAN" || mode === "MULTIMODAL";

    const containerPayload = containers.map((c) => {
      const pkgs = c.packages
        .map((p) => packageRowToDto(p))
        .filter((x): x is ContainerPackage => x != null);
      return {
        containerNumber: c.containerNumber,
        sealNumber: c.sealNumber || undefined,
        containerType: c.containerType || undefined,
        ...(pkgs.length > 0 ? { packages: pkgs } : {}),
      };
    });

    const dto: CreateShipmentDto = {
      companyId,
      officeId,
      mode,
      incoterm: incoterm.trim(),
      parties: {
        shipper: {
          clientId:
            shipperMode === "client" && shipperClientId
              ? shipperClientId
              : undefined,
          name: shipperName.trim(),
          address: shipperAddress.trim() || undefined,
          contact: shipperContact.trim() || undefined,
          rtn: shipperRtn.trim() || undefined,
        },
        consignee: {
          clientId:
            consigneeMode === "client" && consigneeClientId
              ? consigneeClientId
              : undefined,
          name: consigneeName.trim(),
          address: consigneeAddress.trim() || undefined,
          contact: consigneeContact.trim() || undefined,
          rtn: consigneeRtn.trim() || undefined,
        },
        notifyPartyText: notifyPartyText.trim() || undefined,
      },
      cargo: {
        containers: isAirMode ? [] : containerPayload,
        ...(isAirMode
          ? {
              packages: airPackages
                .map((p) => packageRowToDto(p))
                .filter((x): x is ContainerPackage => x != null),
            }
          : {}),
        goodsDescription: goodsDescription.trim() || undefined,
        ...(isOceanOrMultiForDto
          ? {
              grossWeightKg: grossWeightKg ? Number(grossWeightKg) : undefined,
              volumeCbm: volumeCbm ? Number(volumeCbm) : undefined,
            }
          : {}),
      },
      operationalUserId,
    };

    if (movementType.trim()) dto.movementType = movementType.trim();
    if (bookingNumber.trim()) dto.bookingNumber = bookingNumber.trim();
    if (mblNumber.trim()) dto.mblNumber = mblNumber.trim();
    if (hblNumber.trim()) dto.hblNumber = hblNumber.trim();
    if (shippingLineId) dto.shippingLineId = shippingLineId;
    if (importedQuotationId) dto.quotationId = importedQuotationId;
    if (quotationSnapshot) dto.quotationSnapshot = quotationSnapshot;

    if (isAirMode) {
      const air = {
        hawbNumber: hawbNumber.trim() || undefined,
        airportOfDeparture: airportOfDeparture.trim() || undefined,
        airportOfDestination: airportOfDestination.trim() || undefined,
      };
      if (
        air.hawbNumber ||
        air.airportOfDeparture ||
        air.airportOfDestination
      ) {
        dto.transport = { air };
      }
    } else if (mode === "LAND") {
      const driver = landDriver.trim();
      const plaque = landPlaque.trim();
      const license = landLicense.trim();
      dto.transport = {
        land: {
          cartaPorteNumber: cartaPorteNumber.trim() || undefined,
          placeOfLoading: placeOfLoading.trim() || undefined,
          placeOfUnloading: placeOfUnloading.trim() || undefined,
          ...(driver ? { driver, driverName: driver } : {}),
          ...(plaque ? { plaque, truckPlate: plaque } : {}),
          ...(license ? { license, driverLicense: license } : {}),
        },
      };
    } else if (
      vesselName ||
      voyageNumber ||
      portOfLoadingId ||
      portOfDischargeId ||
      placeOfReceipt ||
      placeOfDelivery
    ) {
      dto.transport = {
        vesselName: vesselName.trim() || undefined,
        voyageNumber: voyageNumber.trim() || undefined,
        portOfLoadingId: portOfLoadingId || undefined,
        portOfDischargeId: portOfDischargeId || undefined,
        placeOfReceipt: placeOfReceipt.trim() || undefined,
        placeOfDelivery: placeOfDelivery.trim() || undefined,
      };
    }

    const hasDates = etd || eta || atd || ata;
    if (hasDates) {
      dto.dates = {
        etd: etd ? etd.toISOString() : undefined,
        eta: eta ? eta.toISOString() : undefined,
        atd: atd ? atd.toISOString() : undefined,
        ata: ata ? ata.toISOString() : undefined,
      };
    }

    return dto;
  }, [
    user,
    mode,
    incoterm,
    movementType,
    bookingNumber,
    mblNumber,
    hblNumber,
    shippingLineId,
    shipperMode,
    shipperClientId,
    shipperName,
    shipperAddress,
    shipperContact,
    shipperRtn,
    consigneeMode,
    consigneeClientId,
    consigneeName,
    consigneeAddress,
    consigneeContact,
    consigneeRtn,
    notifyPartyText,
    vesselName,
    voyageNumber,
    portOfLoadingId,
    portOfDischargeId,
    placeOfReceipt,
    placeOfDelivery,
    hawbNumber,
    airportOfDeparture,
    airportOfDestination,
    cartaPorteNumber,
    placeOfLoading,
    placeOfUnloading,
    landDriver,
    landPlaque,
    landLicense,
    etd,
    eta,
    atd,
    ata,
    containers,
    airPackages,
    goodsDescription,
    grossWeightKg,
    volumeCbm,
    importedQuotationId,
    quotationSnapshot,
  ]);

  const userId = (user as any)?._id ?? (user as any)?.id ?? "";
  const isFormTab = ["shipment", "parties", "transport", "cargo"].includes(
    activeTab,
  );
  const canSubmit =
    mode &&
    incoterm.trim() &&
    shipperName.trim() &&
    consigneeName.trim() &&
    userId &&
    !submitting;
  const isDocumentsUnlocked = Boolean(canSubmit);

  const navigateToTab = useCallback(
    async (tabId: TabId) => {
      if (tabId === "documents") {
        if (!isDocumentsUnlocked) return;
        if (!isEdit) {
          setError(
            "You must save the shipment first before accessing documents.",
          );
          return;
        }
      }
      setActiveTab(tabId);
    },
    [isDocumentsUnlocked, isEdit],
  );

  // ── Tab navigation ──
  const tabIndex = TABS.findIndex((t) => t.id === activeTab);
  const prevTab = tabIndex > 0 ? TABS[tabIndex - 1] : null;
  const nextTab = tabIndex < TABS.length - 1 ? TABS[tabIndex + 1] : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (!userId) {
      setError(
        "Could not resolve current user ID. Please log out and log in again.",
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const dto = buildDto();
      if (isEdit && id) {
        await ShipmentsService.update(id, dto);
      } else {
        const created = await ShipmentsService.create(dto);
        const newId = (created as any)._id ?? (created as any).id;
        // Create pending pricelist ledger lines on newly created shipment
        if (newId && pendingPricelistItems.length > 0) {
          for (const item of pendingPricelistItems) {
            if (item.cost > 0) {
              await ShipmentsService.createLedgerLine(newId, {
                side: "DEBIT",
                description: item.name,
                amount: item.cost,
                currency: item.currency,
              }).catch(() => null);
            }
            if (item.price > 0) {
              await ShipmentsService.createLedgerLine(newId, {
                side: "CREDIT",
                description: item.name,
                amount: item.price,
                currency: item.currency,
              }).catch(() => null);
            }
          }
          setPendingPricelistItems([]);
        }
      }
      setSuccess(true);
      setTimeout(() => navigate("/shipments"), 700);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ?? err?.message ?? "An error occurred.";
      setError(Array.isArray(msg) ? msg.join(", ") : msg);
    } finally {
      setSubmitting(false);
    }
  };

  const formatWorkflowError = (err: unknown): string => {
    const e = err as {
      response?: { data?: { message?: unknown } };
      message?: string;
    };
    const raw =
      e?.response?.data?.message ?? e?.message ?? "An error occurred.";
    return Array.isArray(raw) ? raw.join(", ") : String(raw);
  };

  const runDirectWorkflowTransition = async (next: ShipmentStatusType) => {
    if (!id) return;
    setWorkflowBusy(true);
    setError(null);
    try {
      let updated: Shipment;
      if (next === "READY_FOR_FINANCE") {
        updated = await ShipmentsService.readyForFinance(id);
      } else if (next === "FINANCE_REVIEW") {
        updated = await ShipmentsService.financeReview(id);
      } else if (next === "CLOSED") {
        updated = await ShipmentsService.close(id);
      } else {
        return;
      }
      setShipmentStatus(updated.status);
    } catch (err) {
      setError(formatWorkflowError(err));
    } finally {
      setWorkflowBusy(false);
    }
  };

  const handleWorkflowStatusChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const next = e.target.value as ShipmentStatusType;
    if (!id || next === shipmentStatus) return;

    if (shipmentStatus === "FINANCE_REVIEW" && next === "APPROVED") {
      setFinanceApproveNote("");
      setFinanceApproveOpen(true);
      return;
    }
    if (shipmentStatus === "FINANCE_REVIEW" && next === "DRAFT") {
      setFinanceRejectNote("");
      setFinanceRejectError(null);
      setFinanceRejectOpen(true);
      return;
    }

    void runDirectWorkflowTransition(next);
  };

  const handleConfirmFinanceApprove = async () => {
    if (!id) return;
    setWorkflowBusy(true);
    setError(null);
    try {
      const updated = await ShipmentsService.approve(id, {
        note: financeApproveNote.trim() || undefined,
      });
      setShipmentStatus(updated.status);
      setFinanceApproveOpen(false);
    } catch (err) {
      setError(formatWorkflowError(err));
    } finally {
      setWorkflowBusy(false);
    }
  };

  const handleConfirmFinanceReject = async () => {
    const trimmed = financeRejectNote.trim();
    if (!trimmed) {
      setFinanceRejectError("A note is required when rejecting.");
      return;
    }
    if (!id) return;
    setWorkflowBusy(true);
    setFinanceRejectError(null);
    setError(null);
    try {
      const updated = await ShipmentsService.rejectFinanceReview(id, trimmed);
      setShipmentStatus(updated.status);
      setFinanceRejectOpen(false);
    } catch (err) {
      setError(formatWorkflowError(err));
    } finally {
      setWorkflowBusy(false);
    }
  };

  if (loadingShipment) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center bg-white">
        <Loader2 size={24} className="animate-spin text-neutral-300" />
      </div>
    );
  }

  const isOceanOrMulti =
    mode === ShipmentModeEnum.OCEAN || mode === ShipmentModeEnum.MULTIMODAL;
  const isLandMode = mode === ShipmentModeEnum.LAND;
  /** Cargo tab: multi-container + packages (not AIR). */
  const showContainersCargoUi =
    isOceanOrMulti || isLandMode;
  const isAirMode = mode === ShipmentModeEnum.AIR;

  return (
    <>
    <form
      onSubmit={handleSubmit}
      className="h-[calc(100vh-56px)] flex flex-col bg-white text-neutral-900"
    >
      {/* ════════════════════ HEADER ════════════════════ */}
      <div className="flex-shrink-0 bg-white border-b border-neutral-100">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-neutral-200 bg-white text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 transition-colors [&_svg]:block [&_svg]:shrink-0"
            >
              <ArrowLeft size={18} strokeWidth={2} />
            </button>
            <div>
              <h1 className="text-base font-semibold text-neutral-900 leading-none">
                {isEdit ? "Edit Shipment" : "New Shipment"}
              </h1>
              <p className="mt-0.5 text-xs text-neutral-400">
                {isEdit
                  ? "Update shipment details"
                  : "Fill in the shipment information below"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {success && (
              <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                <CheckCircle2 size={14} />
                Saved
              </span>
            )}
            <button
              type="button"
              onClick={() => navigate("/shipments")}
              className="px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition-colors bg-white border-0"
            >
              Cancel
            </button>
            {isFormTab && (
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                {isEdit ? "Save" : "Create"}
              </button>
            )}
          </div>
        </div>

        {/* Tab bar + workflow status (status aligned right) */}
        <div className="flex items-center gap-3 px-6">
          <div className="flex min-w-0 flex-1 overflow-x-auto gap-0">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const isDocsTab = tab.id === "documents";
              const isLocked = isDocsTab && !isDocumentsUnlocked;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => void navigateToTab(tab.id)}
                  disabled={isLocked}
                  title={
                    isLocked
                      ? "Completa los campos requeridos antes de acceder a documentos"
                      : undefined
                  }
                  className={[
                    "inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 bg-white outline-none focus:outline-none border-0",
                    isActive
                      ? "text-blue-600"
                      : isLocked
                        ? "text-neutral-400 cursor-not-allowed"
                        : "text-neutral-500 hover:text-neutral-700",
                  ].join(" ")}
                  style={{
                    border: "none",
                    boxShadow: isActive ? "inset 0 -2px 0 #3B82F6" : "none",
                  }}
                >
                  <span
                    className={[
                      "inline-flex shrink-0 [&_svg]:shrink-0",
                      isActive
                        ? "text-blue-500"
                        : isLocked
                          ? "text-neutral-400"
                          : "text-neutral-500",
                    ].join(" ")}
                  >
                    {tab.icon}
                  </span>
                  {tab.label}
                </button>
              );
            })}
          </div>
          {isEdit && id && (
            <div className="flex shrink-0 items-center gap-2 py-1.5 pl-3 border-l border-neutral-100">
              <label
                htmlFor="shipment-workflow-status"
                className="text-xs text-neutral-500 whitespace-nowrap"
              >
                Status
              </label>
              <select
                id="shipment-workflow-status"
                value={shipmentStatus}
                onChange={handleWorkflowStatusChange}
                disabled={workflowBusy}
                className="min-w-[10.5rem] rounded-md border border-neutral-200 px-2 py-1.5 text-xs bg-white text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-400 disabled:opacity-50"
              >
                {SHIPMENT_WORKFLOW_STATUSES.map((st) => (
                  <option
                    key={st}
                    value={st}
                    disabled={isWorkflowOptionDisabled(
                      user?.permissions,
                      shipmentStatus,
                      st,
                    )}
                  >
                    {SHIPMENT_STATUS_LABELS[st]}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════ ERROR ════════════════════ */}
      {error && (
        <div className="mx-6 mt-4 flex items-start gap-2 rounded-md border border-red-100 bg-red-50 px-3 py-2.5 text-xs text-red-600 flex-shrink-0">
          <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ════════════════════ CONTENT ════════════════════ */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto max-w-3xl px-6 py-8">
          {/* ─── TAB: SHIPMENT ─── */}
          {activeTab === "shipment" && (
            <div className="flex flex-col gap-5">
              {/* Quotation applied banner */}
              {quotationApplied && (
                <div className="flex items-center gap-2 rounded-md border border-green-100 bg-green-50 px-3 py-2.5 text-xs text-green-700">
                  <CheckCircle2 size={13} className="flex-shrink-0" />
                  <span>
                    Pricelist applied — review the Shipment and Transport tabs
                    to confirm.
                  </span>
                </div>
              )}

              {/* Import from Quotation button */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuotationPicker(true);
                    setQuotationPickerResults(null);
                    setQuotationPickerError(null);
                    void fetchQuotations();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:border-neutral-400 hover:text-neutral-900 transition-colors"
                >
                  <List size={13} />
                  Import from Quotation
                </button>
              </div>

              {/* Mode */}
              <div>
                <p className={label}>Mode</p>
                <div className="flex flex-wrap gap-2">
                  {MODE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMode(opt.value)}
                      className={[
                        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-all bg-white",
                        mode === opt.value
                          ? "border-neutral-900 text-neutral-900 bg-neutral-50"
                          : "border-neutral-200 text-neutral-500 hover:border-neutral-400 hover:text-neutral-700",
                      ].join(" ")}
                    >
                      {opt.icon}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <Divider />

              {/* References */}
              <div>
                <p className={label}>References</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <span className="mb-1.5 block text-xs text-neutral-500">
                      Incoterm *
                    </span>
                    <select
                      value={incoterm}
                      onChange={(e) => setIncoterm(e.target.value)}
                      className={select}
                      required
                    >
                      {INCOTERMS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className="mb-1.5 block text-xs text-neutral-500">
                      Movement type
                    </span>
                    <input
                      value={movementType}
                      onChange={(e) => setMovementType(e.target.value)}
                      placeholder="FCL/FCL"
                      className={input}
                    />
                  </div>
                  <div>
                    <span className="mb-1.5 block text-xs text-neutral-500">
                      Carrier
                    </span>
                    <select
                      value={shippingLineId}
                      onChange={(e) => setShippingLineId(e.target.value)}
                      className={select}
                      disabled={loadingHelpers}
                    >
                      <option value="">— Select —</option>
                      {shippingLines.map((sl) => (
                        <option key={sl._id} value={sl._id}>
                          {sl.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className="mb-1.5 block text-xs text-neutral-500">
                      Booking #
                    </span>
                    <input
                      value={bookingNumber}
                      onChange={(e) => setBookingNumber(e.target.value)}
                      placeholder="BK-2026-001234"
                      className={input}
                    />
                  </div>
                  <div>
                    <span className="mb-1.5 block text-xs text-neutral-500">
                      MBL #
                    </span>
                    <input
                      value={mblNumber}
                      onChange={(e) => setMblNumber(e.target.value)}
                      placeholder="MAEU123456789"
                      className={input}
                    />
                  </div>
                  <div>
                    <span className="mb-1.5 block text-xs text-neutral-500">
                      HBL #
                    </span>
                    <input
                      value={hblNumber}
                      onChange={(e) => setHblNumber(e.target.value)}
                      placeholder="HBL-2026-001234"
                      className={input}
                    />
                  </div>
                </div>
              </div>

              {!userId && (
                <div className="flex items-start gap-2 rounded-md border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
                  <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
                  <span>
                    Could not detect current user. Log out and log back in
                    before creating a shipment.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ─── TAB: PARTIES ─── */}
          {activeTab === "parties" && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Shipper */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className={label} style={{ marginBottom: 0 }}>
                      Shipper
                    </p>
                    <div className="flex items-center gap-1 rounded-md border border-neutral-200 p-0.5 bg-white">
                      <button
                        type="button"
                        onClick={() => setShipperMode("client")}
                        className={[
                          "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                          shipperMode === "client"
                            ? "bg-neutral-100 text-neutral-700 border border-neutral-300"
                            : "text-neutral-400 hover:text-neutral-600 border border-transparent",
                        ].join(" ")}
                      >
                        Existing client
                      </button>
                      <button
                        type="button"
                        onClick={() => setShipperMode("free")}
                        className={[
                          "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                          shipperMode === "free"
                            ? "bg-neutral-100 text-neutral-700 border border-neutral-300"
                            : "text-neutral-400 hover:text-neutral-600 border border-transparent",
                        ].join(" ")}
                      >
                        Free input
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    {shipperMode === "client" && (
                      <div>
                        <span className="mb-1.5 block text-xs text-neutral-500">
                          Select client
                        </span>
                        <select
                          value={shipperClientId}
                          onChange={(e) =>
                            handleShipperClientSelect(e.target.value)
                          }
                          className={select}
                          disabled={clientsLoading}
                        >
                          <option value="">— Select existing client —</option>
                          {clients.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        {shipperClientId && (
                          <p className="mt-1 text-[10px] text-neutral-400">
                            Fields below auto-filled. You can edit them.
                          </p>
                        )}
                      </div>
                    )}
                    <div>
                      <span className="mb-1.5 block text-xs text-neutral-500">
                        Name *
                      </span>
                      <input
                        value={shipperName}
                        onChange={(e) => setShipperName(e.target.value)}
                        placeholder="Company name"
                        className={input}
                        required
                      />
                    </div>
                    <div>
                      <span className="mb-1.5 block text-xs text-neutral-500">
                        Address
                      </span>
                      <textarea
                        value={shipperAddress}
                        onChange={(e) => setShipperAddress(e.target.value)}
                        placeholder="Full address"
                        rows={2}
                        className={`${input} resize-none`}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="mb-1.5 block text-xs text-neutral-500">
                          Contact
                        </span>
                        <input
                          value={shipperContact}
                          onChange={(e) => setShipperContact(e.target.value)}
                          placeholder="Name / phone"
                          className={input}
                        />
                      </div>
                      <div>
                        <span className="mb-1.5 block text-xs text-neutral-500">
                          RTN / Tax ID
                        </span>
                        <input
                          value={shipperRtn}
                          onChange={(e) => setShipperRtn(e.target.value)}
                          placeholder="12-3456789"
                          className={input}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Consignee */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className={label} style={{ marginBottom: 0 }}>
                      Consignee
                    </p>
                    <div className="flex items-center gap-1 rounded-md border border-neutral-200 p-0.5 bg-white">
                      <button
                        type="button"
                        onClick={() => setConsigneeMode("client")}
                        className={[
                          "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                          consigneeMode === "client"
                            ? "bg-neutral-100 text-neutral-700 border border-neutral-300"
                            : "text-neutral-400 hover:text-neutral-600 border border-transparent",
                        ].join(" ")}
                      >
                        Existing client
                      </button>
                      <button
                        type="button"
                        onClick={() => setConsigneeMode("free")}
                        className={[
                          "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                          consigneeMode === "free"
                            ? "bg-neutral-100 text-neutral-700 border border-neutral-300"
                            : "text-neutral-400 hover:text-neutral-600 border border-transparent",
                        ].join(" ")}
                      >
                        Free input
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    {consigneeMode === "client" && (
                      <div>
                        <span className="mb-1.5 block text-xs text-neutral-500">
                          Select client
                        </span>
                        <select
                          value={consigneeClientId}
                          onChange={(e) =>
                            handleConsigneeClientSelect(e.target.value)
                          }
                          className={select}
                          disabled={clientsLoading}
                        >
                          <option value="">— Select existing client —</option>
                          {clients.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        {consigneeClientId && (
                          <p className="mt-1 text-[10px] text-neutral-400">
                            Fields below auto-filled. You can edit them.
                          </p>
                        )}
                      </div>
                    )}
                    <div>
                      <span className="mb-1.5 block text-xs text-neutral-500">
                        Name *
                      </span>
                      <input
                        value={consigneeName}
                        onChange={(e) => setConsigneeName(e.target.value)}
                        placeholder="Company name"
                        className={input}
                        required
                      />
                    </div>
                    <div>
                      <span className="mb-1.5 block text-xs text-neutral-500">
                        Address
                      </span>
                      <textarea
                        value={consigneeAddress}
                        onChange={(e) => setConsigneeAddress(e.target.value)}
                        placeholder="Full address"
                        rows={2}
                        className={`${input} resize-none`}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="mb-1.5 block text-xs text-neutral-500">
                          Contact
                        </span>
                        <input
                          value={consigneeContact}
                          onChange={(e) => setConsigneeContact(e.target.value)}
                          placeholder="Name / phone"
                          className={input}
                        />
                      </div>
                      <div>
                        <span className="mb-1.5 block text-xs text-neutral-500">
                          RTN / Tax ID
                        </span>
                        <input
                          value={consigneeRtn}
                          onChange={(e) => setConsigneeRtn(e.target.value)}
                          placeholder="12-3456789"
                          className={input}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Divider />

              <div>
                <p className={label}>Notify Party</p>
                <textarea
                  value={notifyPartyText}
                  onChange={(e) => setNotifyPartyText(e.target.value)}
                  placeholder="Notify party details…"
                  rows={3}
                  className={`${input} resize-none`}
                />
              </div>
            </div>
          )}

          {/* ─── TAB: TRANSPORT ─── */}
          {activeTab === "transport" && (
            <div className="flex flex-col gap-6">
              {isOceanOrMulti ? (
                <div>
                  <p className={label}>Vessel & Route</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="mb-1.5 block text-xs text-neutral-500">
                        Vessel name
                      </span>
                      <input
                        value={vesselName}
                        onChange={(e) => setVesselName(e.target.value)}
                        placeholder="MSC OSCAR"
                        className={input}
                      />
                    </div>
                    <div>
                      <span className="mb-1.5 block text-xs text-neutral-500">
                        Voyage #
                      </span>
                      <input
                        value={voyageNumber}
                        onChange={(e) => setVoyageNumber(e.target.value)}
                        placeholder="V123W"
                        className={input}
                      />
                    </div>
                    <SearchablePortSelectWithCreate
                      label="Port of loading"
                      value={portOfLoadingId}
                      onChange={setPortOfLoadingId}
                      ports={ports}
                      loading={loadingHelpers}
                      disabled={loadingHelpers}
                      placeholder="Search port…"
                      onPortCreated={handlePortCreated}
                    />
                    <SearchablePortSelectWithCreate
                      label="Port of discharge"
                      value={portOfDischargeId}
                      onChange={setPortOfDischargeId}
                      ports={ports}
                      loading={loadingHelpers}
                      disabled={loadingHelpers}
                      placeholder="Search port…"
                      onPortCreated={handlePortCreated}
                    />
                    <div>
                      <span className="mb-1.5 block text-xs text-neutral-500">
                        Place of receipt
                      </span>
                      <input
                        value={placeOfReceipt}
                        onChange={(e) => setPlaceOfReceipt(e.target.value)}
                        placeholder="Miami, FL"
                        className={input}
                      />
                    </div>
                    <div>
                      <span className="mb-1.5 block text-xs text-neutral-500">
                        Place of delivery
                      </span>
                      <input
                        value={placeOfDelivery}
                        onChange={(e) => setPlaceOfDelivery(e.target.value)}
                        placeholder="San Pedro Sula"
                        className={input}
                      />
                    </div>
                  </div>
                </div>
              ) : isAirMode ? (
                <div>
                  <p className={label}>Air transport</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <span className="mb-1.5 block text-xs text-neutral-500">
                        HAWB number
                      </span>
                      <input
                        value={hawbNumber}
                        onChange={(e) => setHawbNumber(e.target.value)}
                        placeholder="House Air Waybill #"
                        className={input}
                      />
                    </div>
                    <div>
                      <span className="mb-1.5 block text-xs text-neutral-500">
                        Airport of departure
                      </span>
                      <input
                        value={airportOfDeparture}
                        onChange={(e) => setAirportOfDeparture(e.target.value)}
                        placeholder="e.g. MIA or airport name"
                        className={input}
                      />
                    </div>
                    <div>
                      <span className="mb-1.5 block text-xs text-neutral-500">
                        Airport of destination
                      </span>
                      <input
                        value={airportOfDestination}
                        onChange={(e) =>
                          setAirportOfDestination(e.target.value)
                        }
                        placeholder="e.g. SAP or airport name"
                        className={input}
                      />
                    </div>
                  </div>
                </div>
              ) : isLandMode ? (
                <div>
                  <p className={label}>Land transport</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <span className="mb-1.5 block text-xs text-neutral-500">
                        Carta porte number
                      </span>
                      <input
                        value={cartaPorteNumber}
                        onChange={(e) => setCartaPorteNumber(e.target.value)}
                        placeholder="Carta porte #"
                        className={input}
                      />
                    </div>
                    <div>
                      <span className="mb-1.5 block text-xs text-neutral-500">
                        Place of loading
                      </span>
                      <input
                        value={placeOfLoading}
                        onChange={(e) => setPlaceOfLoading(e.target.value)}
                        placeholder="e.g. warehouse / city"
                        className={input}
                      />
                    </div>
                    <div>
                      <span className="mb-1.5 block text-xs text-neutral-500">
                        Place of unloading
                      </span>
                      <input
                        value={placeOfUnloading}
                        onChange={(e) => setPlaceOfUnloading(e.target.value)}
                        placeholder="e.g. warehouse / city"
                        className={input}
                      />
                    </div>
                    <div>
                      <span className="mb-1.5 block text-xs text-neutral-500">
                        Driver
                      </span>
                      <input
                        value={landDriver}
                        onChange={(e) => setLandDriver(e.target.value)}
                        placeholder="Driver name"
                        className={input}
                      />
                    </div>
                    <div>
                      <span className="mb-1.5 block text-xs text-neutral-500">
                        Plaque
                      </span>
                      <input
                        value={landPlaque}
                        onChange={(e) => setLandPlaque(e.target.value)}
                        placeholder="Vehicle plate"
                        className={input}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <span className="mb-1.5 block text-xs text-neutral-500">
                        License
                      </span>
                      <input
                        value={landLicense}
                        onChange={(e) => setLandLicense(e.target.value)}
                        placeholder="Driver license #"
                        className={input}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 py-8 text-center text-xs text-neutral-400">
                  No mode-specific transport fields for{" "}
                  <span className="font-medium">{mode}</span> — use dates below.
                </div>
              )}

              <Divider />

              <div>
                <p className={label}>Dates</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { lbl: "ETD", val: etd, set: setEtd, ph: "Est. departure" },
                    { lbl: "ETA", val: eta, set: setEta, ph: "Est. arrival" },
                    { lbl: "ATD", val: atd, set: setAtd, ph: "Act. departure" },
                    { lbl: "ATA", val: ata, set: setAta, ph: "Act. arrival" },
                  ].map(({ lbl, val, set, ph }) => (
                    <div key={lbl}>
                      <span className="mb-1.5 block text-xs text-neutral-500">
                        {lbl}
                      </span>
                      <Calendar
                        value={val}
                        onChange={(e) => set(e.value as Date | null)}
                        showIcon
                        className="w-full quotation-datepicker"
                        panelClassName="quotation-datepicker-panel"
                        placeholder={ph}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── TAB: CARGO ─── */}
          {activeTab === "cargo" && (
            <div className="flex flex-col gap-6">
              {showContainersCargoUi && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className={label} style={{ marginBottom: 0 }}>
                      Containers
                    </p>
                    <button
                      type="button"
                      onClick={addContainer}
                      className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-800 transition-colors bg-white border-0"
                    >
                      <Plus size={13} />
                      Add container
                    </button>
                  </div>

                  {containers.length === 0 ? (
                    <div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 py-8 text-center text-xs text-neutral-400 space-y-2">
                      <p>No containers in this view yet.</p>
                      <p className="text-[10px] text-neutral-400">
                        At least one container is required — click Add container
                        below.
                      </p>
                      <button
                        type="button"
                        onClick={addContainer}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900"
                      >
                        <Plus size={13} />
                        Add container
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {containers.map((c, idx) => (
                        <div
                          key={c._key}
                          className="rounded-md border border-neutral-200 bg-white p-4 space-y-4"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                              Container {idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeContainer(c._key)}
                              disabled={containers.length <= 1}
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-red-600 transition-colors bg-white border-0 disabled:opacity-40 disabled:pointer-events-none disabled:hover:text-neutral-600"
                              title={
                                containers.length <= 1
                                  ? "At least one container is required"
                                  : "Remove this container from the shipment"
                              }
                              aria-label={`Remove container ${idx + 1}`}
                            >
                              <Trash2 size={13} />
                              Remove container
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <span className="mb-1 block text-[10px] text-neutral-400">
                                Container #
                              </span>
                              <input
                                value={c.containerNumber}
                                onChange={(e) =>
                                  updateContainer(
                                    c._key,
                                    "containerNumber",
                                    e.target.value,
                                  )
                                }
                                placeholder="MSKU1234567"
                                className={input}
                              />
                            </div>
                            <div>
                              <span className="mb-1 block text-[10px] text-neutral-400">
                                Seal #
                              </span>
                              <input
                                value={c.sealNumber ?? ""}
                                onChange={(e) =>
                                  updateContainer(
                                    c._key,
                                    "sealNumber",
                                    e.target.value,
                                  )
                                }
                                placeholder="SL-001234"
                                className={input}
                              />
                            </div>
                            <div>
                              <span className="mb-1 block text-[10px] text-neutral-400">
                                Type
                              </span>
                              <select
                                value={c.containerType ?? ""}
                                onChange={(e) =>
                                  updateContainer(
                                    c._key,
                                    "containerType",
                                    e.target.value,
                                  )
                                }
                                className={select}
                              >
                                <option value="">— Type —</option>
                                {CONTAINER_TYPES.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="border-t border-neutral-100 pt-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                                Packages in this container
                              </span>
                              <button
                                type="button"
                                onClick={() => addPackageToContainer(c._key)}
                                className="inline-flex items-center gap-1 text-[10px] text-neutral-500 hover:text-neutral-800 transition-colors bg-white border-0"
                              >
                                <Plus size={12} />
                                Add package
                              </button>
                            </div>
                            {c.packages.length === 0 ? (
                              <p className="text-xs text-neutral-400">
                                Optional — add rows with length, width, height
                                for each package.
                              </p>
                            ) : (
                              <div className="space-y-3">
                                {c.packages.map((pk) => (
                                  <CargoPackageRowFields
                                    key={pk._key}
                                    pk={pk}
                                    onFieldChange={(field, value) =>
                                      updatePackageRow(
                                        c._key,
                                        pk._key,
                                        field,
                                        value,
                                      )
                                    }
                                    onRemove={() =>
                                      removePackageFromContainer(
                                        c._key,
                                        pk._key,
                                      )
                                    }
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {isAirMode && (
                <div>
                  <p className={label}>Air cargo</p>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                      Packages
                    </span>
                    <button
                      type="button"
                      onClick={addAirPackage}
                      className="inline-flex items-center gap-1 text-[10px] text-neutral-500 hover:text-neutral-800 transition-colors bg-white border-0"
                    >
                      <Plus size={12} />
                      Add package
                    </button>
                  </div>
                  {airPackages.length === 0 ? (
                    <p className="text-xs text-neutral-400 mb-3">
                      Optional — add one row per package with type, quantity,
                      and L × W × H.
                    </p>
                  ) : (
                    <div className="space-y-3 mb-4">
                      {airPackages.map((pk) => (
                        <CargoPackageRowFields
                          key={pk._key}
                          pk={pk}
                          onFieldChange={(field, value) =>
                            updateAirPackageRow(pk._key, field, value)
                          }
                          onRemove={() => removeAirPackage(pk._key)}
                        />
                      ))}
                    </div>
                  )}
                  <div>
                    <span className="mb-1.5 block text-xs text-neutral-500">
                      Goods description
                    </span>
                    <input
                      value={goodsDescription}
                      onChange={(e) => setGoodsDescription(e.target.value)}
                      placeholder="Commodity / goods description"
                      className={input}
                    />
                  </div>
                </div>
              )}

              {showContainersCargoUi && <Divider />}

              {showContainersCargoUi && (
                <div>
                  <p className={label}>Cargo summary</p>
                  <div>
                    <span className="mb-1.5 block text-xs text-neutral-500">
                      Goods description
                    </span>
                    <input
                      value={goodsDescription}
                      onChange={(e) => setGoodsDescription(e.target.value)}
                      placeholder="Electronics — Consumer Goods"
                      className={input}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── TAB: DOCUMENTS ─── */}
          {activeTab === "documents" && (
            <div className="flex flex-col gap-5">
              <div>
                <p className={label}>Documents</p>
                <p className="text-xs text-neutral-400 -mt-2">
                  Generate and download shipment documents
                </p>
              </div>

              {docsLoading && (
                <div className="flex items-center justify-center py-16">
                  <Loader2
                    size={20}
                    className="animate-spin text-neutral-300"
                  />
                </div>
              )}

              {docsLoadError && (
                <div className="flex items-center gap-2 rounded-md border border-red-100 bg-red-50 px-3 py-2.5 text-xs text-red-600">
                  <AlertCircle size={13} className="flex-shrink-0" />
                  {docsLoadError}
                </div>
              )}

              {!docsLoading &&
                docsData &&
                (() => {
                  const modeTypes = MODE_DOCS_MAP[mode] ?? [];
                  const generatedTypes = docsData.documents.map(
                    (d) => d.documentType,
                  );
                  const allTypes = [
                    ...new Set([...modeTypes, ...generatedTypes]),
                  ];
                  return allTypes.length === 0 ? (
                    <EmptyState
                      icon={<FileText size={40} strokeWidth={1} />}
                      title="No document types available"
                      description="No document types are configured for this shipment mode."
                    />
                  ) : (
                    <div className="flex flex-col gap-3">
                      {allTypes.map((docType) => {
                        const doc = docsData.documents.find(
                          (d) => d.documentType === docType,
                        );
                        const isRequired =
                          docsData.requiredDocumentTypes.includes(docType);
                        const isGenerating = generatingDocType === docType;
                        const docError = docErrors[docType];
                        const isFailed = doc?.status === "FAILED";
                        return (
                          <div
                            key={docType}
                            className="rounded-md border border-neutral-200 bg-white overflow-hidden"
                          >
                            <div className="p-4 flex items-center justify-between gap-4">
                              <div className="flex flex-col gap-0.5 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium text-neutral-800">
                                    {DOC_TYPE_LABELS[docType] ?? docType}
                                  </span>
                                  {isRequired && (
                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                      Required
                                    </span>
                                  )}
                                  {doc && !isFailed && (
                                    <span
                                      className={[
                                        "text-[10px] font-medium px-1.5 py-0.5 rounded border",
                                        doc.status === "LOCKED"
                                          ? "bg-green-50 text-green-700 border-green-200"
                                          : "bg-blue-50 text-blue-700 border-blue-200",
                                      ].join(" ")}
                                    >
                                      {doc.status === "LOCKED"
                                        ? "Locked"
                                        : "Generated"}
                                    </span>
                                  )}
                                </div>
                                {doc && !isFailed && (
                                  <span className="text-xs text-neutral-400">
                                    v{doc.version} ·{" "}
                                    {new Date(
                                      doc.generatedAt,
                                    ).toLocaleDateString()}
                                    {doc.fileSize
                                      ? ` · ${(doc.fileSize / 1024).toFixed(1)} KB`
                                      : ""}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {doc && !isFailed && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleDownloadDocument(
                                        docType,
                                        doc.version,
                                      )
                                    }
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-neutral-200 text-xs font-medium text-neutral-600 hover:border-neutral-400 hover:text-neutral-900 transition-colors bg-white"
                                  >
                                    Download
                                  </button>
                                )}
                                {doc?.status !== "LOCKED" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleGenerateDocument(docType)
                                    }
                                    disabled={!!generatingDocType}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 disabled:opacity-40 transition-colors"
                                  >
                                    {isGenerating && (
                                      <Loader2
                                        size={12}
                                        className="animate-spin"
                                      />
                                    )}
                                    {doc && !isFailed
                                      ? "Regenerate"
                                      : "Generate"}
                                  </button>
                                )}
                              </div>
                            </div>
                            {(docError || isFailed) && (
                              <div className="flex items-start gap-2 border-t border-red-100 bg-red-50 px-4 py-2.5 text-xs text-red-600">
                                <AlertCircle
                                  size={12}
                                  className="mt-0.5 flex-shrink-0"
                                />
                                <span>
                                  {docError ??
                                    "Generation failed — please try again."}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

              {!docsLoading && !docsData && !docsLoadError && (
                <div className="flex items-center justify-center py-16">
                  <Loader2
                    size={20}
                    className="animate-spin text-neutral-300"
                  />
                </div>
              )}
            </div>
          )}

          {/* ─── TAB: FINANCE ─── */}
          {activeTab === "finance" &&
            (!isEdit ? (
              <div className="flex flex-col gap-5">
                <div>
                  <p className={label}>Finance & Ledger</p>
                  <p className="text-xs text-neutral-400 -mt-2">
                    Debits and credits for this shipment
                  </p>
                </div>
                {ledgerAttachmentSuccessMessage && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2.5 text-xs text-green-700"
                  >
                    <CheckCircle2 size={13} className="flex-shrink-0" />
                    {ledgerAttachmentSuccessMessage}
                  </div>
                )}
                {pendingPricelistItems.length > 0 ? (
                  (() => {
                    const pendingDebits = pendingPricelistItems.filter(
                      (it) => it.cost > 0,
                    );
                    const pendingCredits = pendingPricelistItems.filter(
                      (it) => it.profit > 0,
                    );
                    const PendingTable = ({
                      items,
                      side,
                    }: {
                      items: typeof pendingPricelistItems;
                      side: "DEBIT" | "CREDIT";
                    }) => (
                      <div className="rounded-md border border-neutral-200 overflow-hidden flex flex-col">
                        <div
                          className={[
                            "flex items-center justify-between px-3 py-2 text-xs font-semibold flex-shrink-0",
                            side === "DEBIT"
                              ? "bg-red-50 text-red-700"
                              : "bg-green-50 text-green-700",
                          ].join(" ")}
                        >
                          <span>
                            {side === "DEBIT"
                              ? "Debits (Costs)"
                              : "Credits (Income)"}
                          </span>
                          <span className="font-mono">
                            {items.length} item{items.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {items.length === 0 ? (
                          <div className="px-3 py-4 text-center text-xs text-neutral-400">
                            No {side.toLowerCase()} lines
                          </div>
                        ) : (
                          <div className="overflow-y-auto max-h-56">
                            <table className="w-full text-xs">
                              <thead className="sticky top-0 z-10">
                                <tr className="border-b border-neutral-100 bg-neutral-50 text-neutral-500">
                                  <th className="px-3 py-2 text-left font-medium">
                                    Description
                                  </th>
                                  <th className="px-3 py-2 text-right font-medium">
                                    Amount
                                  </th>
                                  <th className="px-3 py-2 text-left font-medium">
                                    Currency
                                  </th>
                                  <th className="px-3 py-2 text-left font-medium">
                                    Status
                                  </th>
                                  <th className="px-3 py-2 text-left font-medium min-w-[9.5rem]">
                                    Attachments
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((item, i) => {
                                  const rowKey =
                                    side === "DEBIT"
                                      ? `pending-debit-${i}-${item.name}`
                                      : `pending-credit-${i}-${item.name}`;
                                  const att = ledgerLineAttachments[rowKey];
                                  return (
                                    <tr
                                      key={i}
                                      className="border-b border-neutral-100 last:border-0"
                                    >
                                      <td className="px-3 py-2 text-neutral-700">
                                        {item.name}
                                      </td>
                                      <td className="px-3 py-2 text-right font-mono text-neutral-800">
                                        {(side === "DEBIT"
                                          ? item.cost
                                          : item.profit
                                        ).toFixed(2)}
                                      </td>
                                      <td className="px-3 py-2 text-neutral-500">
                                        {item.currency}
                                      </td>
                                      <td className="px-3 py-2">
                                        <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-neutral-100 text-neutral-500">
                                          PENDING
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 align-middle">
                                        <div className="flex flex-col gap-1 min-w-[7rem]">
                                            {att && (
                                              <span
                                                className="text-[10px] text-blue-700 truncate max-w-[140px]"
                                                title={`${att.fileName}${att.note ? ` — ${att.note}` : ""}`}
                                              >
                                                ✓ {att.fileName}
                                              </span>
                                            )}
                                            <button
                                              type="button"
                                              title="Choose a file to attach when the shipment is saved"
                                              onClick={() =>
                                                setLedgerUploadModal({
                                                  mode: "local",
                                                  key: rowKey,
                                                  label:
                                                    side === "DEBIT"
                                                      ? `Debit: ${item.name}`
                                                      : `Credit: ${item.name}`,
                                                })
                                              }
                                              className="inline-flex items-center gap-1 justify-center self-start rounded-md border border-neutral-200 bg-white px-2 py-1 text-[10px] font-medium text-neutral-700 hover:bg-neutral-50"
                                            >
                                              <Paperclip
                                                size={12}
                                                className="flex-shrink-0 text-neutral-500"
                                                aria-hidden
                                              />
                                              Upload Document
                                            </button>
                                            <span className="text-[10px] text-neutral-400">
                                              Confirmed when you save
                                            </span>
                                          </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {items.length > 0 && (
                          <div className="flex justify-between px-3 py-2 border-t border-neutral-200 bg-neutral-50 flex-shrink-0">
                            <span className="text-xs font-semibold text-neutral-600">
                              Subtotal
                            </span>
                            <span className="text-xs font-semibold font-mono text-neutral-800">
                              {items
                                .reduce(
                                  (acc, it) =>
                                    acc +
                                    (side === "DEBIT" ? it.cost : it.profit),
                                  0,
                                )
                                .toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                    return (
                      <div className="flex flex-col gap-5">
                        <PendingTable items={pendingDebits} side="DEBIT" />
                        <PendingTable items={pendingCredits} side="CREDIT" />
                        <p className="text-xs text-neutral-400 text-center">
                          Lines will be created automatically when you save the
                          shipment.
                        </p>
                      </div>
                    );
                  })()
                ) : (
                  <EmptyState
                    icon={<DollarSign size={40} strokeWidth={1} />}
                    title="Finance & Ledger"
                    description="Save the shipment first to access ledger and financial features."
                  />
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className={label}>Finance & Ledger</p>
                    <p className="text-xs text-neutral-400 -mt-2">
                      Debits and credits for this shipment
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {quotationSnapshot && (
                      <button
                        type="button"
                        disabled={importingQuotation || ledgerLoading}
                        onClick={async () => {
                          if (!id || !quotationSnapshot) return;
                          await importFromSnapshot(id, quotationSnapshot);
                          const lines =
                            await ShipmentsService.getLedgerLines(id);
                          setLedgerLines(lines);
                        }}
                        className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
                      >
                        {importingQuotation ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <RefreshCw size={12} />
                        )}
                        Re-import from quotation
                      </button>
                    )}
                  </div>
                </div>

                {ledgerLoading && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2
                      size={20}
                      className="animate-spin text-neutral-300"
                    />
                  </div>
                )}

                {ledgerError && (
                  <div className="flex items-center gap-2 rounded-md border border-red-100 bg-red-50 px-3 py-2.5 text-xs text-red-600">
                    <AlertCircle size={13} className="flex-shrink-0" />
                    {ledgerError}
                  </div>
                )}

                {ledgerAttachmentSuccessMessage && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2.5 text-xs text-green-700"
                  >
                    <CheckCircle2 size={13} className="flex-shrink-0" />
                    {ledgerAttachmentSuccessMessage}
                  </div>
                )}

                {!ledgerLoading &&
                  (() => {
                    const debits = ledgerLines.filter(
                      (l) => l.side === "DEBIT",
                    );
                    const credits = ledgerLines.filter(
                      (l) => l.side === "CREDIT",
                    );
                    const sumLines = (lines: LedgerLine[]) =>
                      lines.reduce((acc, l) => acc + l.amount, 0);

                    const LedgerTable = ({
                      lines,
                      side,
                    }: {
                      lines: LedgerLine[];
                      side: "DEBIT" | "CREDIT";
                    }) => (
                      <div className="rounded-md border border-neutral-200 overflow-hidden flex flex-col">
                        <div
                          className={[
                            "flex items-center justify-between px-3 py-2 text-xs font-semibold flex-shrink-0",
                            side === "DEBIT"
                              ? "bg-red-50 text-red-700"
                              : "bg-green-50 text-green-700",
                          ].join(" ")}
                        >
                          <span>
                            {side === "DEBIT"
                              ? "Debits (Costs)"
                              : "Credits (Income)"}
                          </span>
                          <span className="font-mono">
                            {lines.length} item{lines.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {lines.length === 0 ? (
                          <div className="px-3 py-4 text-center text-xs text-neutral-400">
                            No {side.toLowerCase()} lines
                          </div>
                        ) : (
                          <div className="overflow-y-auto max-h-56">
                            <table className="w-full text-xs">
                              <thead className="sticky top-0 z-10">
                                <tr className="border-b border-neutral-100 bg-neutral-50 text-neutral-500">
                                  <th className="px-3 py-2 text-left font-medium">
                                    Description
                                  </th>
                                  <th className="px-3 py-2 text-left font-medium">
                                    Supplier
                                  </th>
                                  <th className="px-3 py-2 text-right font-medium">
                                    Amount
                                  </th>
                                  <th className="px-3 py-2 text-left font-medium">
                                    Currency
                                  </th>
                                  <th className="px-3 py-2 text-left font-medium">
                                    Status
                                  </th>
                                  <th className="px-3 py-2 text-left font-medium min-w-[9.5rem]">
                                    Attachments
                                  </th>
                                  <th className="w-8 px-2" />
                                </tr>
                              </thead>
                              <tbody>
                                {lines.map((line) => (
                                  <tr
                                    key={line._id}
                                    className="border-b border-neutral-100 last:border-0"
                                  >
                                    <td className="px-3 py-2 text-neutral-700">
                                      {line.description}
                                    </td>
                                    <td className="px-3 py-2 text-neutral-500 text-xs">
                                      {(line as any).supplier?.name ?? "—"}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-neutral-800">
                                      {line.amount.toFixed(2)}
                                    </td>
                                    <td className="px-3 py-2 text-neutral-500">
                                      {line.currency}
                                    </td>
                                    <td className="px-3 py-2">
                                      <span
                                        className={[
                                          "rounded px-1.5 py-0.5 text-[10px] font-medium",
                                          line.status === "APPROVED"
                                            ? "bg-green-50 text-green-700"
                                            : line.status === "REJECTED"
                                              ? "bg-red-50 text-red-600"
                                              : line.status === "SUBMITTED"
                                                ? "bg-blue-50 text-blue-700"
                                                : "bg-neutral-100 text-neutral-500",
                                        ].join(" ")}
                                      >
                                        {line.status}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                      <div className="flex flex-col gap-1">
                                        <button
                                          type="button"
                                          title="Upload supporting document (PDF or image)"
                                          onClick={() =>
                                            setLedgerUploadModal({
                                              mode: "persist",
                                              line,
                                            })
                                          }
                                          className="inline-flex items-center gap-1 justify-center rounded-md border border-neutral-200 bg-white px-2 py-1 text-[10px] font-medium text-neutral-600 hover:bg-neutral-50"
                                        >
                                          <Paperclip
                                            size={12}
                                            className="flex-shrink-0 text-neutral-500"
                                            aria-hidden
                                          />
                                          Upload Document
                                        </button>
                                        <button
                                          type="button"
                                          title="View documents attached to this ledger line"
                                          onClick={() =>
                                            openLedgerDocumentsModal(line)
                                          }
                                          className="inline-flex items-center gap-1 justify-center rounded-md border border-neutral-200 bg-white px-2 py-1 text-[10px] font-medium text-neutral-600 hover:bg-neutral-50"
                                        >
                                          <Eye
                                            size={12}
                                            className="flex-shrink-0 text-neutral-500"
                                            aria-hidden
                                          />
                                          View documents
                                        </button>
                                      </div>
                                    </td>
                                    <td className="px-3 py-2">
                                      {line.status === "DRAFT" && (
                                        <button
                                          type="button"
                                          disabled={deletingLineId === line._id}
                                          onClick={() =>
                                            handleDeleteLedgerLine(line._id)
                                          }
                                          className="inline-flex items-center justify-center border border-red-300 bg-white h-7 w-7 p-0 leading-none hover:bg-red-50 rounded-md disabled:opacity-40"
                                        >
                                          {deletingLineId === line._id ? (
                                            <Loader2
                                              size={16}
                                              strokeWidth={2}
                                              style={{
                                                color: "#DC2626",
                                                display: "block",
                                              }}
                                            />
                                          ) : (
                                            <Trash2
                                              size={16}
                                              strokeWidth={2}
                                              style={{
                                                color: "#DC2626",
                                                display: "block",
                                              }}
                                            />
                                          )}
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {lines.length > 0 && (
                          <div className="flex justify-between px-3 py-2 border-t border-neutral-200 bg-neutral-50 flex-shrink-0">
                            <span className="text-xs font-semibold text-neutral-600">
                              Subtotal
                            </span>
                            <span className="text-xs font-semibold font-mono text-neutral-800">
                              {sumLines(lines).toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    );

                    return (
                      <>
                        <LedgerTable lines={debits} side="DEBIT" />
                        <LedgerTable lines={credits} side="CREDIT" />
                      </>
                    );
                  })()}

                {/* Manual add form */}
                <div className="rounded-md border border-neutral-200 bg-white p-4">
                  <p className="text-xs font-semibold text-neutral-600 mb-3">
                    Add line manually
                  </p>
                  <div className="flex flex-wrap gap-2 items-end">
                    <div>
                      <span className="mb-1 block text-xs text-neutral-500">
                        Side
                      </span>
                      <select
                        value={newSide}
                        onChange={(e) =>
                          setNewSide(e.target.value as "DEBIT" | "CREDIT")
                        }
                        className={select}
                      >
                        <option value="DEBIT">Debit (Cost)</option>
                        <option value="CREDIT">Credit (Income)</option>
                      </select>
                    </div>
                    <div className="min-w-[160px]">
                      <span className="mb-1 block text-xs text-neutral-500">
                        Supplier
                      </span>
                      <select
                        value={newSupplierId}
                        onChange={(e) => setNewSupplierId(e.target.value)}
                        className={select}
                      >
                        <option value="">Default (shipment supplier)</option>
                        {shippingLines.map((s: any) => (
                          <option key={s._id ?? s.id} value={s._id ?? s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1 min-w-[160px]">
                      <span className="mb-1 block text-xs text-neutral-500">
                        Description
                      </span>
                      <input
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="e.g. Port handling fee"
                        className={input}
                      />
                    </div>
                    <div className="w-28">
                      <span className="mb-1 block text-xs text-neutral-500">
                        Amount
                      </span>
                      <input
                        type="number"
                        value={newAmount}
                        onChange={(e) => setNewAmount(e.target.value)}
                        placeholder="0.00"
                        min={0}
                        step="0.01"
                        className={numericInput}
                      />
                    </div>
                    <div className="w-24">
                      <span className="mb-1 block text-xs text-neutral-500">
                        Currency
                      </span>
                      <input
                        value={newCurrency}
                        onChange={(e) => setNewCurrency(e.target.value)}
                        placeholder="USD"
                        maxLength={3}
                        className={input}
                      />
                    </div>
                    <button
                      type="button"
                      disabled={
                        addingLine || !newDescription.trim() || !newAmount
                      }
                      onClick={handleAddLedgerLine}
                      className="flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
                    >
                      {addingLine ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Plus size={12} />
                      )}
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ))}

          {/* ─── TAB: PROFIT ─── */}
          {activeTab === "profit" &&
            (!isEdit ? (
              <EmptyState
                icon={<TrendingUp size={40} strokeWidth={1} />}
                title="Profit"
                description="Save the shipment first to view profit calculations."
              />
            ) : (
              <div className="flex flex-col gap-5">
                <div>
                  <p className={label}>Profit (T-Account)</p>
                  <p className="text-xs text-neutral-400 -mt-2">
                    Overview of debits vs credits
                  </p>
                </div>

                {ledgerLoading && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2
                      size={20}
                      className="animate-spin text-neutral-300"
                    />
                  </div>
                )}

                {!ledgerLoading &&
                  (() => {
                    const debits = ledgerLines.filter(
                      (l) => l.side === "DEBIT",
                    );
                    const credits = ledgerLines.filter(
                      (l) => l.side === "CREDIT",
                    );
                    const totalDebits = debits.reduce(
                      (a, l) => a + l.amount,
                      0,
                    );
                    const totalCredits = credits.reduce(
                      (a, l) => a + l.amount,
                      0,
                    );
                    const netProfit = totalCredits - totalDebits;
                    const maxRows = Math.max(debits.length, credits.length);

                    return (
                      <div className="overflow-x-auto rounded-md border border-neutral-200">
                        <table className="w-full text-xs">
                          <thead>
                            <tr>
                              <th className="w-1/2 px-3 py-1.5 text-left text-xs font-semibold text-red-700 bg-red-50 border-b border-r border-neutral-200">
                                DEBIT (Costs)
                              </th>
                              <th className="w-1/2 px-3 py-1.5 text-left text-xs font-semibold text-green-700 bg-green-50 border-b border-neutral-200">
                                CREDIT (Income)
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {maxRows === 0 ? (
                              <tr>
                                <td
                                  colSpan={2}
                                  className="px-4 py-6 text-center text-neutral-400"
                                >
                                  No ledger lines yet
                                </td>
                              </tr>
                            ) : (
                              Array.from({ length: maxRows }).map((_, i) => {
                                const d = debits[i];
                                const c = credits[i];
                                return (
                                  <tr
                                    key={i}
                                    className="border-b border-neutral-100 last:border-0"
                                  >
                                    <td className="px-3 py-1 border-r border-neutral-200 align-top max-w-0 w-1/2">
                                      {d ? (
                                        <div className="flex justify-between gap-2 min-w-0">
                                          <span className="text-neutral-700 truncate min-w-0">
                                            {d.description}
                                          </span>
                                          <span className="font-mono text-neutral-800 whitespace-nowrap flex-shrink-0">
                                            {d.amount.toFixed(2)} {d.currency}
                                          </span>
                                        </div>
                                      ) : null}
                                    </td>
                                    <td className="px-3 py-1 align-top max-w-0 w-1/2">
                                      {c ? (
                                        <div className="flex justify-between gap-2 min-w-0">
                                          <span className="text-neutral-700 truncate min-w-0">
                                            {c.description}
                                          </span>
                                          <span className="font-mono text-neutral-800 whitespace-nowrap flex-shrink-0">
                                            {c.amount.toFixed(2)} {c.currency}
                                          </span>
                                        </div>
                                      ) : null}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-neutral-300 bg-neutral-50">
                              <td className="px-3 py-1.5 border-r border-neutral-200">
                                <div className="flex justify-between">
                                  <span className="font-semibold text-neutral-600">
                                    Total Debits
                                  </span>
                                  <span className="font-mono font-semibold text-neutral-800">
                                    {totalDebits.toFixed(2)}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-1.5">
                                <div className="flex justify-between">
                                  <span className="font-semibold text-neutral-600">
                                    Total Credits
                                  </span>
                                  <span className="font-mono font-semibold text-neutral-800">
                                    {totalCredits.toFixed(2)}
                                  </span>
                                </div>
                              </td>
                            </tr>
                            <tr
                              className={[
                                "border-t border-neutral-200",
                                netProfit >= 0 ? "bg-green-50" : "bg-red-50",
                              ].join(" ")}
                            >
                              <td colSpan={2} className="px-3 py-1.5">
                                <div className="flex justify-between items-center">
                                  <span
                                    className={[
                                      "font-semibold text-sm",
                                      netProfit >= 0
                                        ? "text-green-700"
                                        : "text-red-700",
                                    ].join(" ")}
                                  >
                                    Net Profit
                                  </span>
                                  <span
                                    className={[
                                      "font-mono font-bold text-sm",
                                      netProfit >= 0
                                        ? "text-green-700"
                                        : "text-red-700",
                                    ].join(" ")}
                                  >
                                    {netProfit >= 0 ? "+" : ""}
                                    {netProfit.toFixed(2)}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    );
                  })()}
              </div>
            ))}
        </div>
      </div>

      {/* ════════════ STEP NAV (fixed) ════════════ */}
      <div className="flex-shrink-0 border-t border-neutral-100 bg-white px-6 pt-2.5 pb-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => prevTab && void navigateToTab(prevTab.id)}
          disabled={!prevTab}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-neutral-500 hover:text-red-600 hover:bg-red-50 disabled:text-neutral-400 disabled:cursor-not-allowed disabled:pointer-events-none disabled:hover:bg-transparent disabled:hover:text-neutral-400 transition-all bg-white border-0 [&_svg]:shrink-0"
        >
          <ArrowLeft size={13} strokeWidth={2} className="text-current" />
          {prevTab?.label}
        </button>

        <div className="flex items-center gap-1">
          {TABS.map((tab, i) => {
            const isCurrent = i === tabIndex;
            const isVisited = i < tabIndex;
            const isLockedDot = tab.id === "documents" && !isDocumentsUnlocked;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => void navigateToTab(tab.id)}
                disabled={isLockedDot}
                title={tab.label}
                className={[
                  "flex-shrink-0 inline-flex items-center gap-1 rounded-full text-[10px] font-medium transition-all border-0",
                  isLockedDot
                    ? "cursor-not-allowed opacity-40"
                    : "cursor-pointer",
                  isCurrent
                    ? "bg-blue-500 text-white px-2.5 py-1"
                    : isVisited
                      ? "bg-neutral-200 text-neutral-600 px-2 py-1 hover:bg-neutral-300"
                      : "bg-neutral-100 text-neutral-400 px-2 py-1 hover:bg-neutral-200",
                ].join(" ")}
              >
                <span
                  className={[
                    "inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[8px] font-bold leading-none",
                    isCurrent
                      ? "bg-white text-blue-500"
                      : isVisited
                        ? "bg-neutral-400 text-white"
                        : "bg-neutral-300 text-white",
                  ].join(" ")}
                >
                  {i + 1}
                </span>
                {isCurrent && <span>{tab.label}</span>}
              </button>
            );
          })}
        </div>

        {nextTab ? (
          <button
            type="button"
            onClick={() => void navigateToTab(nextTab.id)}
            disabled={nextTab.id === "documents" && !isDocumentsUnlocked}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-neutral-500 hover:text-red-600 hover:bg-red-50 disabled:text-neutral-400 disabled:cursor-not-allowed disabled:pointer-events-none disabled:hover:bg-transparent disabled:hover:text-neutral-400 transition-all bg-white border-0 [&_svg]:shrink-0"
          >
            {nextTab.label}
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-current"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate("/shipments")}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-700 transition-colors"
          >
            Done
          </button>
        )}
      </div>

      {/* ════════════ QUOTATION PICKER MODAL ════════════ */}
      {showQuotationPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowQuotationPicker(false)}
        >
          <div
            className="bg-white rounded-lg border border-neutral-200 shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 flex-shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">
                  Import from Quotation
                </h2>
                <p className="mt-0.5 text-xs text-neutral-400">
                  Select a quotation to auto-fill shipment data and finance
                  items
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowQuotationPicker(false)}
                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors border-0 bg-white"
              >
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
              {/* Loading */}
              {quotationPickerLoading && (
                <div className="flex items-center justify-center py-10">
                  <Loader2
                    size={20}
                    className="animate-spin text-neutral-300"
                  />
                </div>
              )}

              {/* Error */}
              {quotationPickerError && (
                <div className="flex items-center gap-2 rounded-md border border-red-100 bg-red-50 px-3 py-2.5 text-xs text-red-600">
                  <AlertCircle size={13} className="flex-shrink-0" />
                  {quotationPickerError}
                </div>
              )}

              {/* Quotation list */}
              {!quotationPickerLoading &&
                quotationPickerResults &&
                (quotationPickerResults.length === 0 ? (
                  <div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 py-10 text-center text-xs text-neutral-400">
                    No quotations found.
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-100 rounded-md border border-neutral-200 overflow-hidden">
                    {quotationPickerResults.map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => void applyQuotation(q)}
                        className="w-full text-left flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition-colors bg-white border-0 group"
                      >
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-neutral-800">
                              {q.quoteNumber ?? q.id.slice(-6).toUpperCase()}
                            </span>
                            {q.status && (
                              <span
                                className={[
                                  "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border",
                                  q.status === "accepted"
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : q.status === "sent"
                                      ? "bg-blue-50 text-blue-700 border-blue-200"
                                      : q.status === "rejected"
                                        ? "bg-red-50 text-red-600 border-red-200"
                                        : "bg-neutral-50 text-neutral-600 border-neutral-200",
                                ].join(" ")}
                              >
                                {q.status}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            {(q.client as any)?.name && (
                              <span className="text-[10px] text-neutral-500">
                                {(q.client as any).name}
                              </span>
                            )}
                            {q.incoterm && (
                              <span className="text-[10px] text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                                {q.incoterm}
                              </span>
                            )}
                            {q.shippingMode && (
                              <span className="text-[10px] text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                                {q.shippingMode}
                              </span>
                            )}
                            {q.portOfOriginData && (
                              <span className="text-[10px] text-neutral-400">
                                {q.portOfOriginData.name} →{" "}
                                {q.portOfDestinationData?.name ?? "—"}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                          {q.total != null && (
                            <span className="text-xs font-medium text-neutral-700">
                              {q.total.toLocaleString()}{" "}
                              <span className="text-neutral-400 font-normal">
                                {q.pricingConfig?.currency ?? "USD"}
                              </span>
                            </span>
                          )}
                          <span className="text-[10px] text-neutral-400 group-hover:text-neutral-700 transition-colors">
                            Import →
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </form>

    {ledgerUploadModal?.mode === "local" && (
      <LedgerLineUploadDocumentModal
        open
        mode="local"
        lineLabel={ledgerUploadModal.label}
        onHide={() => setLedgerUploadModal(null)}
        onConfirm={(file, note) => {
          setLedgerLineAttachments((prev) => ({
            ...prev,
            [ledgerUploadModal.key]: { fileName: file.name, note },
          }));
          setLedgerUploadModal(null);
          setLedgerAttachmentSuccessMessage(
            "File attached. Save the shipment to keep it.",
          );
        }}
      />
    )}
    {ledgerUploadModal?.mode === "persist" && id && (
      <LedgerLineUploadDocumentModal
        open
        mode="persist"
        shipmentId={id}
        lineId={ledgerUploadModal.line._id}
        lineLabel={ledgerUploadModal.line.description}
        onHide={() => setLedgerUploadModal(null)}
        onUploaded={async () => {
          await refreshLedgerAfterDocumentUpload();
          setLedgerAttachmentSuccessMessage(
            "Document uploaded successfully.",
          );
        }}
      />
    )}

    {id && (
      <LedgerLineDocumentsModal
        open={!!ledgerDocsLine}
        shipmentId={id}
        line={ledgerDocsLine}
        refreshKey={ledgerDocsRefreshKey}
        onClose={() => setLedgerDocsLine(null)}
        onDocumentsChanged={async () => {
          if (!id) return;
          try {
            const lines = await ShipmentsService.getLedgerLines(id);
            setLedgerLines(lines);
          } catch {
            /* ignore */
          }
        }}
        onAttachDocument={() => {
          if (!ledgerDocsLine) return;
          const line = ledgerDocsLine;
          setLedgerDocsLine(null);
          setLedgerUploadModal({ mode: "persist", line });
        }}
      />
    )}

    {financeApproveOpen && (
      <BaseModal
        className="max-w-md"
        title="Approve shipment"
        primaryActionLabel="Approve"
        primaryActionDisabled={workflowBusy}
        onPrimaryAction={handleConfirmFinanceApprove}
        secondaryActionLabel="Cancel"
        onSecondaryAction={() => setFinanceApproveOpen(false)}
        onHide={() => setFinanceApproveOpen(false)}
      >
        <p className="text-sm text-neutral-600 mb-2">
          Optional comment (stored on the shipment).
        </p>
        <textarea
          value={financeApproveNote}
          onChange={(e) => setFinanceApproveNote(e.target.value)}
          className={input}
          rows={4}
          placeholder="Add a comment (optional)"
        />
      </BaseModal>
    )}
    {financeRejectOpen && (
      <BaseModal
        className="max-w-md"
        title="Reject finance review"
        primaryActionLabel="Reject and return to Draft"
        primaryActionDisabled={workflowBusy}
        onPrimaryAction={handleConfirmFinanceReject}
        secondaryActionLabel="Cancel"
        onSecondaryAction={() => setFinanceRejectOpen(false)}
        onHide={() => setFinanceRejectOpen(false)}
      >
        <p className="text-sm text-neutral-600 mb-2">
          Explain what needs to be corrected. This note is required.
        </p>
        <textarea
          value={financeRejectNote}
          onChange={(e) => {
            setFinanceRejectNote(e.target.value);
            if (financeRejectError) setFinanceRejectError(null);
          }}
          className={input}
          rows={4}
          placeholder="Reason for rejection"
        />
        {financeRejectError && (
          <p className="mt-2 text-xs text-red-600">{financeRejectError}</p>
        )}
      </BaseModal>
    )}
    </>
  );
}
