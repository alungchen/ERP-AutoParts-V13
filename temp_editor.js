import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/pages/Documents/DocumentEditorPage.jsx");import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=5ff6c068"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
var _s = $RefreshSig$();
import __vite__cjsImport1_react from "/node_modules/.vite/deps/react.js?v=5ff6c068"; const React = __vite__cjsImport1_react.__esModule ? __vite__cjsImport1_react.default : __vite__cjsImport1_react; const useState = __vite__cjsImport1_react["useState"]; const useEffect = __vite__cjsImport1_react["useEffect"]; const useRef = __vite__cjsImport1_react["useRef"]; const useMemo = __vite__cjsImport1_react["useMemo"];
import { useSearchParams } from "/node_modules/.vite/deps/react-router-dom.js?v=5ff6c068";
import { useDocumentStore } from "/src/store/useDocumentStore.js";
import { useProductStore } from "/src/store/useProductStore.js";
import { useSupplierStore } from "/src/store/useSupplierStore.js";
import { useCustomerStore } from "/src/store/useCustomerStore.js";
import { useEmployeeStore } from "/src/store/useEmployeeStore.js";
import { useShorthandStore } from "/src/store/useShorthandStore.js";
import { useAppStore } from "/src/store/useAppStore.js";
import { useTranslation } from "/src/i18n.js";
import { canEditDocType } from "/src/utils/permissions.js";
import { X, Plus, Trash2, Save, FileText, Package, RotateCcw, Edit2, Printer } from "/node_modules/.vite/deps/lucide-react.js?v=5ff6c068";
import AutocompleteInput from "/src/components/AutocompleteInput.jsx";
import PartMappingModal from "/src/pages/PIM/PartMappingModal.jsx";
import DocumentViewer from "/src/pages/Documents/DocumentViewer.jsx";
import { useSearchFormKeyboardNav } from "/src/hooks/useSearchFormKeyboardNav.js";
import DocProductHistoryDrawer from "/src/components/DocProductHistoryDrawer.jsx";
import { isElementInDocPartEditingZone } from "/src/utils/docHistoryFocusZones.js";
import { sortedCustomersForSelect, sortedSuppliersForSelect } from "/src/utils/sortContactsForSelect.js";
import CodeLookupInput from "/src/components/CodeLookupInput.jsx";
import {
  productCarModelsSearchText,
  productPurchaseUnitPrice,
  productSalesUnitPrice,
  productLineCarModel,
  productLineYear,
  productYearSearchBlob
} from "/src/utils/productPickerSync.js";
import styles from "/src/pages/Documents/Documents.module.css";
const DocumentEditorPage = () => {
  _s();
  const [searchParams] = useSearchParams();
  const { t, language } = useTranslation();
  const { addDocument, updateDocument, deleteDocument, inquiries, purchaseOrders, quotations, salesOrders, salesReturns, purchaseReturns } = useDocumentStore();
  const { products } = useProductStore();
  const { suppliers } = useSupplierStore();
  const { customers } = useCustomerStore();
  const { employees } = useEmployeeStore();
  const { models, parts, brands } = useShorthandStore();
  const { defaultCurrency, isMultiCountryMode, enableLoginSystem, enablePermissionRole, currentUserEmpId, vatEnabled, vatRate } = useAppStore();
  const type = searchParams.get("type") || "inquiry";
  const id = searchParams.get("id");
  const mode = searchParams.get("mode");
  const isEdit = !!id;
  const isIntl = mode === "intl";
  const customerOptions = useMemo(() => sortedCustomersForSelect(customers), [customers]);
  const supplierOptions = useMemo(() => sortedSuppliersForSelect(suppliers), [suppliers]);
  const docTypeMeta = {
    quotation: { label: "報價單", color: "#2563eb" },
    sales: { label: "銷貨單", color: "#16a34a" },
    salesReturn: { label: "銷退單", color: "#0ea5e9" },
    inquiry: { label: "詢價單", color: "#8b5cf6" },
    purchase: { label: "採購單", color: "#f59e0b" },
    purchaseReturn: { label: "進退單", color: "#f97316" }
  };
  const docTypeLabelKeyMap = {
    inquiry: "docs.tabInquiry",
    purchase: "docs.tabPurchase",
    quotation: "docs.tabQuotation",
    sales: "docs.tabSales",
    salesReturn: "docs.tabSalesReturn",
    purchaseReturn: "docs.tabPurchaseReturn"
  };
  const currentDocMeta = docTypeMeta[type] || { label: t(docTypeLabelKeyMap[type] || "docs.title"), color: "#334155" };
  const currentUser = employees.find((e) => e.emp_id === currentUserEmpId);
  const canEditThisDocType = canEditDocType({
    enableLoginSystem,
    enablePermissionRole,
    currentUser,
    docType: type
  });
  const [isReadOnly, setIsReadOnly] = useState(isEdit || !canEditThisDocType);
  const [doc, setDoc] = useState({
    type,
    date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
    status: "pending",
    items: [],
    currency: defaultCurrency,
    notes: "",
    supplier_id: "",
    supplier_name: "",
    customer_id: "",
    customer_name: "",
    opener_emp_id: "",
    opener_emp_name: "",
    discount: 0
  });
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState({
    partNumber: "",
    model: "",
    part: "",
    spec: "",
    year: "",
    brand: ""
  });
  const [pickerResults, setPickerResults] = useState([]);
  const [pickerMatchTotal, setPickerMatchTotal] = useState(0);
  const [selectedPickerProductIds, setSelectedPickerProductIds] = useState([]);
  const [mappingProduct, setMappingProduct] = useState(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [focusedHeaderAction, setFocusedHeaderAction] = useState("");
  const pickerFirstInputRef = useRef(null);
  const pickerFormRef = useRef(null);
  const pickerResetBtnRef = useRef(null);
  const pickerListRef = useRef(null);
  const [activePickerRowIndex, setActivePickerRowIndex] = useState(0);
  const pickerTbodyRef = useRef(null);
  const printBtnRef = useRef(null);
  const editBtnRef = useRef(null);
  const saveBtnRef = useRef(null);
  const closeBtnRef = useRef(null);
  const selectAllRef = useRef(null);
  const pickerSelectAllRef = useRef(null);
  const addPartBtnRef = useRef(null);
  const [selectedIndexes, setSelectedIndexes] = useState([]);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [isAddPartFocused, setIsAddPartFocused] = useState(false);
  const itemTbodyRef = useRef(null);
  const docListKeyboardRef = useRef(null);
  const setProductHistoryFocusPId = useAppStore((s) => s.setProductHistoryFocusPId);
  const docHistoryFocusPId = useMemo(
    () => {
      if (isPickerOpen && pickerResults.length > 0) {
        return pickerResults[activePickerRowIndex]?.p_id || null;
      }
      if (doc?.items?.length) {
        const item = doc.items[activeItemIndex];
        return item?.p_id && String(item.p_id).trim() ? item.p_id : null;
      }
      return null;
    },
    [
      isPickerOpen,
      pickerResults.length,
      activePickerRowIndex,
      pickerResults[activePickerRowIndex]?.p_id,
      doc?.items?.length,
      activeItemIndex,
      doc?.items?.[activeItemIndex]?.p_id
    ]
  );
  useEffect(() => {
    setProductHistoryFocusPId(docHistoryFocusPId);
  }, [docHistoryFocusPId, setProductHistoryFocusPId]);
  useEffect(() => () => setProductHistoryFocusPId(null), [setProductHistoryFocusPId]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat || e.code !== "F8") return;
      if (!isElementInDocPartEditingZone(document.activeElement)) return;
      e.preventDefault();
      setHistoryDrawerOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  useEffect(() => {
    setHistoryDrawerOpen(false);
  }, [isPickerOpen]);
  useEffect(() => {
    if (!isEdit) return;
    const state = useDocumentStore.getState();
    let existingDoc = null;
    if (type === "inquiry") existingDoc = (state.inquiries || []).find((d) => d.doc_id === id);
    else if (type === "purchase") existingDoc = (state.purchaseOrders || []).find((d) => d.doc_id === id);
    else if (type === "quotation") existingDoc = (state.quotations || []).find((d) => d.doc_id === id);
    else if (type === "sales") existingDoc = (state.salesOrders || []).find((d) => d.doc_id === id);
    else if (type === "salesReturn") existingDoc = (state.salesReturns || []).find((d) => d.doc_id === id);
    else if (type === "purchaseReturn") existingDoc = (state.purchaseReturns || []).find((d) => d.doc_id === id);
    if (existingDoc) {
      let updatedDoc = { ...existingDoc };
      updatedDoc.items = updatedDoc.items || [];
      if (!updatedDoc.supplier_name && updatedDoc.supplier_id) {
        updatedDoc.supplier_name = supplierOptions.find((s) => s.sup_id === updatedDoc.supplier_id)?.name || "";
      }
      if (!updatedDoc.customer_name && updatedDoc.customer_id) {
        updatedDoc.customer_name = customerOptions.find((c) => c.cust_id === updatedDoc.customer_id)?.name || "";
      }
      setDoc(updatedDoc);
    }
  }, [isEdit, id, type, customerOptions, supplierOptions]);
  useEffect(() => {
    if (!isEdit && currentUser && (!doc.opener_emp_id || !doc.opener_emp_name)) {
      setDoc((prev) => ({
        ...prev,
        opener_emp_id: currentUser.emp_id,
        opener_emp_name: currentUser.name
      }));
    }
  }, [isEdit, currentUser, doc.opener_emp_id, doc.opener_emp_name]);
  useEffect(() => {
    if (!canEditThisDocType) {
      setIsReadOnly(true);
      return;
    }
    setIsReadOnly(isEdit);
  }, [isEdit, id, type, canEditThisDocType]);
  useEffect(() => {
    if (!isReadOnly || !canEditThisDocType || !editBtnRef.current) return;
    const focusEdit = () => editBtnRef.current?.focus();
    focusEdit();
    const t1 = setTimeout(focusEdit, 100);
    const t2 = setTimeout(focusEdit, 300);
    const t3 = setTimeout(focusEdit, 500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isReadOnly, canEditThisDocType]);
  useEffect(() => {
    if (isReadOnly) return;
    if (doc.items.length > 0 && docListKeyboardRef.current) {
      setActiveItemIndex(0);
      const focusList = () => {
        const firstRow = itemTbodyRef.current?.querySelector('[data-doc-item-row-idx="0"]');
        if (firstRow) {
          firstRow.focus();
        } else {
          docListKeyboardRef.current?.focus();
        }
        setActiveItemIndex(0);
      };
      focusList();
      const t12 = setTimeout(focusList, 100);
      const t22 = setTimeout(focusList, 300);
      const t32 = setTimeout(focusList, 500);
      return () => {
        clearTimeout(t12);
        clearTimeout(t22);
        clearTimeout(t32);
      };
    }
    if (!saveBtnRef.current) return;
    const focusSave = () => saveBtnRef.current?.focus();
    focusSave();
    const t1 = setTimeout(focusSave, 100);
    const t2 = setTimeout(focusSave, 300);
    const t3 = setTimeout(focusSave, 500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isReadOnly, doc.items.length]);
  useEffect(() => {
    if (!enableLoginSystem && !isEdit && !doc.opener_emp_id && employees.length > 0) {
      setDoc((prev) => ({
        ...prev,
        opener_emp_id: employees[0].emp_id,
        opener_emp_name: employees[0].name
      }));
    }
  }, [enableLoginSystem, isEdit, doc.opener_emp_id, employees]);
  useEffect(() => {
    if (isPickerOpen && pickerResetBtnRef.current) {
      const t2 = setTimeout(() => pickerResetBtnRef.current?.focus(), 100);
      return () => clearTimeout(t2);
    }
  }, [isPickerOpen]);
  useEffect(() => {
    if (!isPickerOpen) setSelectedPickerProductIds([]);
  }, [isPickerOpen]);
  useEffect(() => {
    if (!isPickerOpen) return;
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        if (pickerFormRef.current?.contains(document.activeElement)) {
          return;
        }
        e.preventDefault();
        setIsPickerOpen(false);
      }
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isPickerOpen]);
  useEffect(() => {
    if (isPickerOpen || isViewerOpen || isReadOnly || !saveBtnRef.current) return;
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        saveBtnRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isPickerOpen, isViewerOpen, isReadOnly]);
  const isSupplier = type === "inquiry" || type === "purchase" || type === "purchaseReturn";
  const isCustomer = type === "quotation" || type === "sales" || type === "salesReturn";
  const formatAmount = (value) => Number(value || 0).toLocaleString(void 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const subtotal = doc.items.reduce((sum, item) => sum + (item.qty || 0) * (item.unit_price || 0), 0);
  const vatAmount = vatEnabled ? subtotal * ((Number(vatRate) || 0) / 100) : 0;
  const grandTotal = subtotal + vatAmount;
  const isCurrencyLocked = isSupplier && !isIntl || isCustomer && !isMultiCountryMode;
  useEffect(() => {
    if (isCurrencyLocked && doc.currency !== defaultCurrency) {
      setDoc((prev) => ({ ...prev, currency: defaultCurrency }));
    }
  }, [isCurrencyLocked, defaultCurrency, doc.currency]);
  const handleSave = () => {
    if (!canEditThisDocType) {
      alert("您沒有權限編輯此單據。");
      return;
    }
    let savedDoc;
    if (isEdit) {
      savedDoc = updateDocument(type, doc);
    } else {
      savedDoc = addDocument(type, doc);
      const url = new URL(window.location);
      url.searchParams.set("id", savedDoc.doc_id);
      window.history.replaceState({}, "", url);
    }
    localStorage.setItem("erp-last-doc-type", type);
    setDoc(savedDoc);
    setIsReadOnly(true);
  };
  const handleClose = () => {
    const targetDocId = doc.doc_id || id;
    if (targetDocId && (doc.items || []).length === 0) {
      const shouldDelete = window.confirm("此單據目前沒有品項，是否刪除後離開？");
      if (shouldDelete) {
        deleteDocument(type, targetDocId);
        const state = useDocumentStore.getState();
        const getListByType = (docType) => {
          if (docType === "inquiry") return state.inquiries || [];
          if (docType === "purchase") return state.purchaseOrders || [];
          if (docType === "quotation") return state.quotations || [];
          if (docType === "sales") return state.salesOrders || [];
          if (docType === "salesReturn") return state.salesReturns || [];
          if (docType === "purchaseReturn") return state.purchaseReturns || [];
          return [];
        };
        const stillExists = getListByType(type).some((d) => d.doc_id === targetDocId);
        if (stillExists) {
          state.deleteDocument(type, targetDocId);
        }
      } else {
        return;
      }
    }
    let fallbackUrl = `/documents?tab=${encodeURIComponent(type)}`;
    let returnFromHub = false;
    try {
      const ret = sessionStorage.getItem("erp-doc-hub-return");
      if (ret && ret.startsWith("/documents")) {
        const u = new URL(ret, window.location.origin);
        u.searchParams.set("tab", type);
        fallbackUrl = `${u.pathname}?${u.searchParams.toString()}`;
        returnFromHub = true;
        sessionStorage.removeItem("erp-doc-hub-return");
      }
    } catch {
    }
    try {
      let isPopup = false;
      try {
        isPopup = !!(window.opener && window.opener !== window);
      } catch (e) {
        isPopup = true;
      }
      if (isPopup) {
        window.close();
        setTimeout(() => {
          let isStillOpen = true;
          try {
            isStillOpen = !window.closed;
          } catch (e) {
            isStillOpen = true;
          }
          if (isStillOpen) {
            window.location.href = fallbackUrl;
          }
        }, 150);
        return;
      }
    } catch (e) {
      window.close();
      setTimeout(() => {
        window.location.href = fallbackUrl;
      }, 150);
      return;
    }
    if (!returnFromHub && window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = fallbackUrl;
    }
  };
  const handlePrint = () => {
    setIsViewerOpen(true);
  };
  const handleCloseViewerAndFocusPrint = () => {
    setIsViewerOpen(false);
    const focusPrint = () => printBtnRef.current?.focus();
    setTimeout(focusPrint, 0);
    setTimeout(focusPrint, 80);
  };
  const focusActionButtonByArrow = (currentRef, direction) => {
    const actionButtonRefs = [
      isEdit ? printBtnRef : null,
      isReadOnly ? editBtnRef : saveBtnRef,
      closeBtnRef
    ].filter(Boolean).filter((refObj) => refObj.current);
    if (actionButtonRefs.length === 0) return;
    const currentIndex = actionButtonRefs.findIndex((refObj) => refObj === currentRef);
    if (currentIndex === -1) return;
    const nextIndex = direction === "right" ? (currentIndex + 1) % actionButtonRefs.length : (currentIndex - 1 + actionButtonRefs.length) % actionButtonRefs.length;
    actionButtonRefs[nextIndex].current?.focus();
  };
  const handleHeaderActionKeyDown = (e, currentRef) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();
      focusActionButtonByArrow(currentRef, "right");
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      e.stopPropagation();
      focusActionButtonByArrow(currentRef, "left");
    }
  };
  const getHeaderActionStyle = (baseStyle, actionKey) => {
    if (focusedHeaderAction !== actionKey) return baseStyle;
    return {
      ...baseStyle,
      outline: "2px solid #60a5fa",
      outlineOffset: "2px",
      boxShadow: "0 0 0 3px rgba(96, 165, 250, 0.28)",
      transform: "translateY(-1px)"
    };
  };
  const addEmptyItem = () => {
    if (isReadOnly) return;
    const emptyItem = {
      p_id: "",
      name: "",
      part_number: "",
      car_model: "",
      brand: "",
      year: "",
      spec: "",
      qty: 1,
      unit_price: 0,
      unit: "PCS",
      stock: 0
    };
    const nextLen = (doc.items || []).length + 1;
    setDoc((prev) => ({ ...prev, items: [...prev.items || [], emptyItem] }));
    setActiveItemIndex(nextLen - 1);
  };
  const removeItem = (index) => {
    const newItems = [...doc.items];
    newItems.splice(index, 1);
    setDoc({ ...doc, items: newItems });
    setSelectedIndexes([]);
  };
  const updateItem = (index, field, value) => {
    const newItems = [...doc.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setDoc({ ...doc, items: newItems });
  };
  const toggleItemSelection = (index, checked) => {
    setSelectedIndexes((prev) => {
      if (checked) {
        if (prev.includes(index)) return prev;
        return [...prev, index];
      }
      return prev.filter((itemIndex) => itemIndex !== index);
    });
  };
  const toggleSelectAllItems = (checked) => {
    if (!checked) {
      setSelectedIndexes([]);
      return;
    }
    setSelectedIndexes(doc.items.map((_, index) => index));
  };
  const handleDeleteSelected = () => {
    if (selectedIndexes.length === 0) return;
    const selectedSet = new Set(selectedIndexes);
    const newItems = doc.items.filter((_, index) => !selectedSet.has(index));
    setDoc({ ...doc, items: newItems });
    setSelectedIndexes([]);
  };
  const isAllSelected = doc.items.length > 0 && selectedIndexes.length === doc.items.length;
  const isPartiallySelected = selectedIndexes.length > 0 && selectedIndexes.length < doc.items.length;
  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = isPartiallySelected;
  }, [isPartiallySelected]);
  useEffect(() => {
    if (doc.items.length === 0) {
      setActiveItemIndex(0);
      return;
    }
    if (activeItemIndex > doc.items.length - 1) {
      setActiveItemIndex(doc.items.length - 1);
    }
  }, [doc.items, activeItemIndex]);
  useEffect(() => {
    if (isReadOnly || isPickerOpen || isViewerOpen || doc.items.length === 0 || !docListKeyboardRef.current) return;
    setActiveItemIndex(0);
    docListKeyboardRef.current.focus();
  }, [isReadOnly, isPickerOpen, isViewerOpen, doc.doc_id, doc.items.length]);
  useEffect(() => {
    if (!itemTbodyRef.current) return;
    const rowEl = itemTbodyRef.current.querySelector(`[data-doc-item-row-idx="${activeItemIndex}"]`);
    if (rowEl) rowEl.scrollIntoView({ block: "nearest" });
  }, [activeItemIndex]);
  useEffect(() => {
    if (isReadOnly || isPickerOpen || isViewerOpen || doc.items.length === 0) return;
    const isTypingTarget = (el) => {
      if (!el || !el.tagName) return false;
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute?.("role");
      return tag === "input" || tag === "textarea" || tag === "select" || role === "combobox" || role === "listbox";
    };
    const handleGlobal = (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const listEl = docListKeyboardRef.current;
      if (!listEl) return;
      if (listEl.contains(document.activeElement)) return;
      if (isTypingTarget(document.activeElement)) return;
      e.preventDefault();
      listEl.focus();
      setActiveItemIndex(e.key === "ArrowDown" ? 0 : doc.items.length - 1);
    };
    document.addEventListener("keydown", handleGlobal);
    return () => document.removeEventListener("keydown", handleGlobal);
  }, [isReadOnly, isPickerOpen, isViewerOpen, doc.items.length]);
  const isTypingInList = () => {
    const el = document.activeElement;
    if (!el || !docListKeyboardRef.current?.contains?.(el)) return false;
    const tag = el.tagName?.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select";
  };
  const focusItemRow = (rowIdx) => {
    const row = itemTbodyRef.current?.querySelector(`[data-doc-item-row-idx="${rowIdx}"]`);
    row?.focus();
  };
  const focusQtyInput = (rowIdx) => {
    const row = itemTbodyRef.current?.querySelector(`[data-doc-item-row-idx="${rowIdx}"]`);
    row?.querySelector("[data-doc-item-qty]")?.focus();
  };
  const focusPriceInput = (rowIdx) => {
    const row = itemTbodyRef.current?.querySelector(`[data-doc-item-row-idx="${rowIdx}"]`);
    row?.querySelector("[data-doc-item-price]")?.focus();
  };
  const handleDocListKeyDown = (e) => {
    if (isReadOnly || doc.items.length === 0) return;
    if (e.key === "Enter" && document.activeElement === addPartBtnRef.current) {
      e.preventDefault();
      setIsPickerOpen(true);
      return;
    }
    const isInInput = document.activeElement?.closest?.("input, textarea, select");
    if (e.key === "Enter") {
      if (isInInput) return;
      e.preventDefault();
      const rowEl = document.activeElement?.closest?.("[data-doc-item-row-idx]");
      const rowIdx = rowEl != null ? parseInt(rowEl.getAttribute("data-doc-item-row-idx"), 10) : activeItemIndex;
      if (!isNaN(rowIdx)) {
        const row = itemTbodyRef.current?.querySelector(`[data-doc-item-row-idx="${rowIdx}"]`);
        row?.querySelector("[data-doc-item-qty]")?.focus();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (activeItemIndex === doc.items.length - 1) {
        addPartBtnRef.current?.focus();
      } else {
        const nextIdx = Math.min(activeItemIndex + 1, doc.items.length - 1);
        setActiveItemIndex(nextIdx);
        focusItemRow(nextIdx);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (document.activeElement === addPartBtnRef.current) {
        const lastIdx = doc.items.length - 1;
        setActiveItemIndex(lastIdx);
        focusItemRow(lastIdx);
      } else if (activeItemIndex === 0) {
        saveBtnRef.current?.focus();
      } else {
        const prevIdx = Math.max(activeItemIndex - 1, 0);
        setActiveItemIndex(prevIdx);
        focusItemRow(prevIdx);
      }
    } else if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      const checked = selectedIndexes.includes(activeItemIndex);
      toggleItemSelection(activeItemIndex, !checked);
    }
  };
  const handlePickProduct = (p) => {
    const pnObj = p.part_numbers?.[0] || {};
    const isPurch = type === "purchase" || type === "purchaseReturn";
    const newItem = {
      p_id: p.p_id,
      name: p.name,
      part_number: pnObj.part_number || p.part_number || "",
      car_model: productLineCarModel(p),
      brand: pnObj.brand || p.brand || "",
      year: productLineYear(p),
      spec: p.specifications || "",
      qty: 1,
      unit_price: isPurch ? productPurchaseUnitPrice(p) : productSalesUnitPrice(p),
      unit: "PCS",
      stock: p.stock,
      // Attach original product info for "Applicability" link in main list
      _full_product: p
    };
    setDoc({ ...doc, items: [...doc.items, newItem] });
    setIsPickerOpen(false);
  };
  const isPickerAllSelected = selectedPickerProductIds.length === pickerResults.length && pickerResults.length > 0;
  const isPickerPartiallySelected = selectedPickerProductIds.length > 0 && selectedPickerProductIds.length < pickerResults.length;
  const togglePickerSelection = (pId, checked) => {
    setSelectedPickerProductIds((prev) => {
      if (checked) return prev.includes(pId) ? prev : [...prev, pId];
      return prev.filter((id2) => id2 !== pId);
    });
  };
  const togglePickerSelectAll = (checked) => {
    if (!checked) {
      setSelectedPickerProductIds([]);
      return;
    }
    setSelectedPickerProductIds(pickerResults.map((p) => p.p_id));
  };
  useEffect(() => {
    if (!pickerSelectAllRef.current || !isPickerOpen) return;
    pickerSelectAllRef.current.indeterminate = isPickerPartiallySelected;
  }, [isPickerPartiallySelected, isPickerOpen]);
  const handlePickSelectedProducts = () => {
    if (selectedPickerProductIds.length === 0) return;
    const selectedProducts = pickerResults.filter((p) => selectedPickerProductIds.includes(p.p_id));
    const isPurch = type === "purchase" || type === "purchaseReturn";
    const newItems = selectedProducts.map((p) => {
      const pnObj = p.part_numbers?.[0] || {};
      return {
        p_id: p.p_id,
        name: p.name,
        part_number: pnObj.part_number || p.part_number || "",
        car_model: productLineCarModel(p),
        brand: pnObj.brand || p.brand || "",
        year: productLineYear(p),
        spec: p.specifications || "",
        qty: 1,
        unit_price: isPurch ? productPurchaseUnitPrice(p) : productSalesUnitPrice(p),
        unit: "PCS",
        stock: p.stock,
        _full_product: p
      };
    });
    setDoc({ ...doc, items: [...doc.items, ...newItems] });
    setSelectedPickerProductIds([]);
    setIsPickerOpen(false);
  };
  const handleClearPicker = () => {
    setPickerQuery({
      partNumber: "",
      model: "",
      part: "",
      spec: "",
      year: "",
      brand: ""
    });
    requestAnimationFrame(() => pickerFirstInputRef.current?.focus());
  };
  const handlePickerListKeyDown = (e) => {
    if (pickerResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivePickerRowIndex((prev) => Math.min(prev + 1, pickerResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (activePickerRowIndex === 0) {
        pickerResetBtnRef.current?.focus();
        return;
      }
      setActivePickerRowIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      const p = pickerResults[activePickerRowIndex];
      if (p) {
        const checked = selectedPickerProductIds.includes(p.p_id);
        togglePickerSelection(p.p_id, !checked);
      }
    } else if (e.key === "Enter") {
      if (selectedPickerProductIds.length > 0) {
        e.preventDefault();
        handlePickSelectedProducts();
      }
    }
  };
  useSearchFormKeyboardNav(pickerFormRef, null, pickerResetBtnRef, { enabled: isPickerOpen, searchEscapeGoesToReset: true });
  const handlePickerFormKeyDown = (e) => {
    if (e.defaultPrevented) return;
    if (e.key !== "ArrowDown") return;
    const active = document.activeElement;
    if (!pickerFormRef.current?.contains(active)) return;
    if (active?.closest?.("ul")) return;
    if (pickerResults.length === 0) return;
    e.preventDefault();
    setActivePickerRowIndex(0);
    pickerListRef.current?.focus();
  };
  useEffect(() => {
    let filtered = products;
    if (pickerQuery.model) {
      const q = pickerQuery.model.toLowerCase();
      filtered = filtered.filter((p) => {
        const cm = productCarModelsSearchText(p).toLowerCase();
        return cm.includes(q) || (p.part_numbers || []).some((pn) => (pn.car_model || "").toLowerCase().includes(q));
      });
    }
    if (pickerQuery.part) {
      const q = pickerQuery.part.toLowerCase();
      filtered = filtered.filter(
        (p) => (p.name || "").toLowerCase().includes(q) || (p.notes || "").toLowerCase().includes(q) || (p.specifications || "").toLowerCase().includes(q)
      );
    }
    if (pickerQuery.partNumber) {
      const q = pickerQuery.partNumber.toLowerCase();
      filtered = filtered.filter(
        (p) => (p.p_id || "").toLowerCase().includes(q) || (p.part_number || "").toLowerCase().includes(q) || (p.part_numbers || []).some((pn) => (pn.part_number || "").toLowerCase().includes(q))
      );
    }
    if (pickerQuery.year) {
      const y = pickerQuery.year.trim();
      filtered = filtered.filter((p) => productYearSearchBlob(p).includes(y));
    }
    if (pickerQuery.spec) {
      const q = pickerQuery.spec.toLowerCase();
      filtered = filtered.filter(
        (p) => (p.specifications || "").toLowerCase().includes(q) || (p.name || "").toLowerCase().includes(q)
      );
    }
    if (pickerQuery.brand) {
      const normalize = (v) => String(v ?? "").toLowerCase();
      const q = normalize(pickerQuery.brand).trim();
      const matchedBrandPhrases = brands.filter((item) => {
        const shorthand = normalize(item?.shorthand);
        const fullname = normalize(item?.fullname);
        return shorthand.includes(q) || fullname.includes(q);
      });
      const brandKeywords = /* @__PURE__ */ new Set([q]);
      matchedBrandPhrases.forEach((item) => {
        brandKeywords.add(normalize(item?.shorthand));
        brandKeywords.add(normalize(item?.fullname));
      });
      filtered = filtered.filter((p) => {
        const brandText = normalize(
          `${p.brand || ""} ${(p.part_numbers || []).map((pn) => pn?.brand || "").join(" ")}`
        );
        return Array.from(brandKeywords).some((keyword) => keyword && brandText.includes(keyword));
      });
    }
    setPickerMatchTotal(filtered.length);
    setPickerResults(filtered.slice(0, 50));
  }, [pickerQuery, products, brands]);
  useEffect(() => {
    if (!isPickerOpen) return;
    if (pickerResults.length === 0) {
      setActivePickerRowIndex(0);
      return;
    }
    setActivePickerRowIndex((prev) => Math.min(prev, pickerResults.length - 1));
  }, [isPickerOpen, pickerResults.length]);
  useEffect(() => {
    if (!isPickerOpen || pickerResults.length === 0) return;
    const list = pickerListRef.current;
    if (!list?.contains(document.activeElement)) return;
    const row = list.querySelector(`[data-picker-row-idx="${activePickerRowIndex}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [activePickerRowIndex, isPickerOpen, pickerResults.length]);
  return /* @__PURE__ */ jsxDEV("div", { style: { backgroundColor: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)", display: "flex", flexDirection: "column", overflow: "hidden" }, children: [
    /* @__PURE__ */ jsxDEV("div", { style: { padding: "1rem 1.5rem", backgroundColor: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)", flexShrink: 0 }, children: [
      /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }, children: [
        /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", gap: "1.5rem", alignItems: "center" }, children: [
          /* @__PURE__ */ jsxDEV("div", { style: { background: currentDocMeta.color, color: "white", padding: "0.4rem 0.8rem", borderRadius: "4px", fontWeight: 800 }, children: currentDocMeta.label }, void 0, false, {
            fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
            lineNumber: 889,
            columnNumber: 25
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", flexDirection: "column" }, children: [
            /* @__PURE__ */ jsxDEV("span", { style: { fontSize: "1rem", fontWeight: 800, color: "var(--text-primary)" }, children: isEdit ? `單號: ${id}` : "新單據預覽" }, void 0, false, {
              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
              lineNumber: 893,
              columnNumber: 29
            }, this),
            /* @__PURE__ */ jsxDEV("span", { style: { fontSize: "0.7rem", color: "var(--text-secondary)" }, children: isEdit ? isReadOnly ? "檢視模式" : "編輯中.." : "建立新單據中" }, void 0, false, {
              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
              lineNumber: 896,
              columnNumber: 29
            }, this)
          ] }, void 0, true, {
            fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
            lineNumber: 892,
            columnNumber: 25
          }, this)
        ] }, void 0, true, {
          fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
          lineNumber: 888,
          columnNumber: 21
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", gap: "0.75rem" }, children: [
          isEdit && /* @__PURE__ */ jsxDEV(
            "button",
            {
              ref: printBtnRef,
              onClick: handlePrint,
              onKeyDown: (e) => handleHeaderActionKeyDown(e, printBtnRef),
              onFocus: () => setFocusedHeaderAction("print"),
              onBlur: () => setFocusedHeaderAction(""),
              style: getHeaderActionStyle(
                { backgroundColor: "var(--bg-tertiary)", color: "var(--text-primary)", border: "1px solid var(--border-color)", padding: "0.6rem 1rem", borderRadius: "6px", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" },
                "print"
              ),
              title: "列印單據",
              children: /* @__PURE__ */ jsxDEV(Printer, { size: 18 }, void 0, false, {
                fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                lineNumber: 916,
                columnNumber: 33
              }, this)
            },
            void 0,
            false,
            {
              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
              lineNumber: 904,
              columnNumber: 13
            },
            this
          ),
          isReadOnly ? /* @__PURE__ */ jsxDEV(
            "button",
            {
              ref: editBtnRef,
              autoFocus: true,
              onClick: () => canEditThisDocType && setIsReadOnly(false),
              onKeyDown: (e) => handleHeaderActionKeyDown(e, editBtnRef),
              onFocus: () => setFocusedHeaderAction("edit"),
              onBlur: () => setFocusedHeaderAction(""),
              disabled: !canEditThisDocType,
              style: getHeaderActionStyle(
                { backgroundColor: "#f59e0b", color: "white", border: "none", padding: "0.6rem 1.25rem", borderRadius: "6px", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" },
                "edit"
              ),
              children: [
                /* @__PURE__ */ jsxDEV(Edit2, { size: 18 }, void 0, false, {
                  fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                  lineNumber: 935,
                  columnNumber: 33
                }, this),
                " ",
                "編輯"
              ]
            },
            void 0,
            true,
            {
              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
              lineNumber: 922,
              columnNumber: 13
            },
            this
          ) : /* @__PURE__ */ jsxDEV(
            "button",
            {
              ref: saveBtnRef,
              autoFocus: doc.items.length === 0,
              onClick: handleSave,
              onKeyDown: (e) => handleHeaderActionKeyDown(e, saveBtnRef),
              onFocus: () => setFocusedHeaderAction("save"),
              onBlur: () => setFocusedHeaderAction(""),
              style: getHeaderActionStyle(
                { backgroundColor: "#10b981", color: "white", border: "none", padding: "0.6rem 1.25rem", borderRadius: "6px", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" },
                "save"
              ),
              children: [
                /* @__PURE__ */ jsxDEV(Save, { size: 18 }, void 0, false, {
                  fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                  lineNumber: 950,
                  columnNumber: 33
                }, this),
                " ",
                "儲存"
              ]
            },
            void 0,
            true,
            {
              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
              lineNumber: 938,
              columnNumber: 13
            },
            this
          ),
          /* @__PURE__ */ jsxDEV(
            "button",
            {
              ref: closeBtnRef,
              onClick: handleClose,
              onKeyDown: (e) => handleHeaderActionKeyDown(e, closeBtnRef),
              onFocus: () => setFocusedHeaderAction("close"),
              onBlur: () => setFocusedHeaderAction(""),
              style: getHeaderActionStyle(
                { backgroundColor: "#ef4444", color: "white", border: "none", padding: "0.6rem 0.8rem", borderRadius: "6px", cursor: "pointer" },
                "close"
              ),
              children: /* @__PURE__ */ jsxDEV(X, { size: 20 }, void 0, false, {
                fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                lineNumber: 964,
                columnNumber: 29
              }, this)
            },
            void 0,
            false,
            {
              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
              lineNumber: 953,
              columnNumber: 25
            },
            this
          )
        ] }, void 0, true, {
          fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
          lineNumber: 901,
          columnNumber: 21
        }, this)
      ] }, void 0, true, {
        fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
        lineNumber: 887,
        columnNumber: 17
      }, this),
      /* @__PURE__ */ jsxDEV("div", { style: { display: "grid", gridTemplateColumns: "1.2fr 2fr 1.1fr 1fr 1.7fr", gap: "0.85rem", alignItems: "end", padding: "0.7rem", border: "1px solid var(--border-color)", borderRadius: "8px", background: "var(--bg-primary)" }, children: [
        /* @__PURE__ */ jsxDEV("div", { children: [
          /* @__PURE__ */ jsxDEV("label", { style: { fontSize: "0.85rem", color: "var(--accent-primary)", display: "block", marginBottom: "6px", fontWeight: 800, letterSpacing: "0.03em" }, children: "日期" }, void 0, false, {
            fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
            lineNumber: 971,
            columnNumber: 25
          }, this),
          /* @__PURE__ */ jsxDEV(
            "input",
            {
              type: "date",
              disabled: isReadOnly,
              value: doc.date,
              onChange: (e) => setDoc({ ...doc, date: e.target.value }),
              style: {
                width: "100%",
                padding: "0.5rem",
                backgroundColor: isReadOnly ? "var(--bg-secondary)" : "var(--bg-tertiary)",
                border: "1px solid var(--border-color)",
                borderRadius: "4px",
                color: "var(--text-primary)",
                fontSize: "1rem",
                fontWeight: 700
              }
            },
            void 0,
            false,
            {
              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
              lineNumber: 972,
              columnNumber: 25
            },
            this
          )
        ] }, void 0, true, {
          fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
          lineNumber: 970,
          columnNumber: 21
        }, this),
        /* @__PURE__ */ jsxDEV("div", { children: [
          /* @__PURE__ */ jsxDEV("label", { style: { fontSize: "0.85rem", color: "var(--accent-primary)", display: "block", marginBottom: "6px", fontWeight: 800, letterSpacing: "0.03em" }, children: isSupplier ? "供應商" : "客戶" }, void 0, false, {
            fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
            lineNumber: 990,
            columnNumber: 25
          }, this),
          isSupplier ? /* @__PURE__ */ jsxDEV(
            CodeLookupInput,
            {
              value: doc.supplier_id || "",
              nameValue: doc.supplier_name || "",
              suggestions: supplierOptions,
              idKey: "sup_id",
              disabled: isReadOnly,
              inputStyle: {
                padding: "0.5rem",
                backgroundColor: isReadOnly ? "var(--bg-secondary)" : "var(--bg-tertiary)",
                border: "1px solid var(--border-color)",
                borderRadius: "4px",
                color: "var(--text-primary)",
                fontSize: "1rem",
                fontWeight: 700
              },
              onSelect: (sup) => setDoc({
                ...doc,
                supplier_id: sup.sup_id,
                supplier_name: sup.name,
                currency: isCurrencyLocked ? defaultCurrency : sup.currency || "USD"
              })
            },
            void 0,
            false,
            {
              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
              lineNumber: 992,
              columnNumber: 13
            },
            this
          ) : /* @__PURE__ */ jsxDEV(
            CodeLookupInput,
            {
              value: doc.customer_id || "",
              nameValue: doc.customer_name || "",
              suggestions: customerOptions,
              idKey: "cust_id",
              disabled: isReadOnly,
              inputStyle: {
                padding: "0.5rem",
                backgroundColor: isReadOnly ? "var(--bg-secondary)" : "var(--bg-tertiary)",
                border: "1px solid var(--border-color)",
                borderRadius: "4px",
                color: "var(--text-primary)",
                fontSize: "1rem",
                fontWeight: 700
              },
              onSelect: (cust) => setDoc({
                ...doc,
                customer_id: cust.cust_id,
                customer_name: cust.name,
                currency: isCurrencyLocked ? defaultCurrency : cust.currency || "TWD"
              })
            },
            void 0,
            false,
            {
              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
              lineNumber: 1015,
              columnNumber: 13
            },
            this
          )
        ] }, void 0, true, {
          fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
          lineNumber: 989,
          columnNumber: 21
        }, this),
        /* @__PURE__ */ jsxDEV("div", { children: [
          /* @__PURE__ */ jsxDEV("label", { style: { fontSize: "0.85rem", color: "var(--accent-primary)", display: "block", marginBottom: "6px", fontWeight: 800, letterSpacing: "0.03em" }, children: type === "sales" ? "狀態（暫不開放）" : "狀態" }, void 0, false, {
            fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
            lineNumber: 1040,
            columnNumber: 25
          }, this),
          type === "sales" ? /* @__PURE__ */ jsxDEV(
            "div",
            {
              title: "銷貨單開單即入應收；狀態日後處理",
              style: {
                width: "100%",
                padding: "0.5rem",
                backgroundColor: "var(--bg-secondary)",
                border: "1px dashed var(--border-color)",
                borderRadius: "4px",
                color: "var(--text-muted)",
                fontSize: "0.9rem",
                fontWeight: 600
              },
              children: "銷貨單開單即入帳；狀態選項日後開放"
            },
            void 0,
            false,
            {
              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
              lineNumber: 1044,
              columnNumber: 13
            },
            this
          ) : /* @__PURE__ */ jsxDEV(
            "select",
            {
              disabled: isReadOnly,
              value: doc.status,
              onChange: (e) => setDoc({ ...doc, status: e.target.value }),
              style: {
                width: "100%",
                padding: "0.5rem",
                backgroundColor: isReadOnly ? "var(--bg-secondary)" : "var(--bg-tertiary)",
                border: "1px solid var(--border-color)",
                borderRadius: "4px",
                color: "var(--text-primary)",
                fontSize: "1rem",
                fontWeight: 700
              },
              children: [
                /* @__PURE__ */ jsxDEV("option", { value: "pending", children: "待處理" }, void 0, false, {
                  fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                  lineNumber: 1075,
                  columnNumber: 33
                }, this),
                /* @__PURE__ */ jsxDEV("option", { value: "accepted", children: "已核准" }, void 0, false, {
                  fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                  lineNumber: 1076,
                  columnNumber: 33
                }, this),
                /* @__PURE__ */ jsxDEV("option", { value: "received", children: "已入庫" }, void 0, false, {
                  fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                  lineNumber: 1077,
                  columnNumber: 33
                }, this)
              ]
            },
            void 0,
            true,
            {
              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
              lineNumber: 1060,
              columnNumber: 13
            },
            this
          )
        ] }, void 0, true, {
          fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
          lineNumber: 1039,
          columnNumber: 21
        }, this),
        /* @__PURE__ */ jsxDEV("div", { children: [
          /* @__PURE__ */ jsxDEV("label", { style: { fontSize: "0.85rem", color: "var(--accent-primary)", display: "block", marginBottom: "6px", fontWeight: 800, letterSpacing: "0.03em" }, children: "幣別" }, void 0, false, {
            fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
            lineNumber: 1082,
            columnNumber: 25
          }, this),
          /* @__PURE__ */ jsxDEV(
            "select",
            {
              disabled: isCurrencyLocked || isReadOnly,
              value: doc.currency,
              onChange: (e) => setDoc({ ...doc, currency: e.target.value }),
              style: {
                width: "100%",
                padding: "0.5rem",
                backgroundColor: isCurrencyLocked || isReadOnly ? "var(--bg-secondary)" : "var(--bg-tertiary)",
                border: "1px solid var(--border-color)",
                borderRadius: "4px",
                color: "var(--text-primary)",
                cursor: isCurrencyLocked || isReadOnly ? "not-allowed" : "pointer",
                fontWeight: 700,
                fontSize: "1rem"
              },
              children: [
                /* @__PURE__ */ jsxDEV("option", { value: "TWD", children: "TWD" }, void 0, false, {
                  fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                  lineNumber: 1099,
                  columnNumber: 29
                }, this),
                /* @__PURE__ */ jsxDEV("option", { value: "USD", children: "USD" }, void 0, false, {
                  fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                  lineNumber: 1100,
                  columnNumber: 29
                }, this),
                /* @__PURE__ */ jsxDEV("option", { value: "JPY", children: "JPY" }, void 0, false, {
                  fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                  lineNumber: 1101,
                  columnNumber: 29
                }, this),
                /* @__PURE__ */ jsxDEV("option", { value: "CNY", children: "CNY" }, void 0, false, {
                  fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                  lineNumber: 1102,
                  columnNumber: 29
                }, this),
                /* @__PURE__ */ jsxDEV("option", { value: "EUR", children: "EUR" }, void 0, false, {
                  fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                  lineNumber: 1103,
                  columnNumber: 29
                }, this),
                /* @__PURE__ */ jsxDEV("option", { value: "HKD", children: "HKD" }, void 0, false, {
                  fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                  lineNumber: 1104,
                  columnNumber: 29
                }, this)
              ]
            },
            void 0,
            true,
            {
              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
              lineNumber: 1083,
              columnNumber: 25
            },
            this
          )
        ] }, void 0, true, {
          fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
          lineNumber: 1081,
          columnNumber: 21
        }, this),
        /* @__PURE__ */ jsxDEV("div", { children: [
          /* @__PURE__ */ jsxDEV("label", { style: { fontSize: "0.85rem", color: "var(--accent-primary)", display: "block", marginBottom: "6px", fontWeight: 800, letterSpacing: "0.03em" }, children: "開單人員" }, void 0, false, {
            fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
            lineNumber: 1108,
            columnNumber: 25
          }, this),
          /* @__PURE__ */ jsxDEV(
            "select",
            {
              disabled: isReadOnly,
              value: doc.opener_emp_id || "",
              onChange: (e) => {
                const emp = employees.find((item) => item.emp_id === e.target.value);
                setDoc({
                  ...doc,
                  opener_emp_id: emp?.emp_id || "",
                  opener_emp_name: emp?.name || ""
                });
              },
              style: {
                width: "100%",
                padding: "0.5rem",
                backgroundColor: isReadOnly ? "var(--bg-secondary)" : "var(--bg-tertiary)",
                border: "1px solid var(--border-color)",
                borderRadius: "4px",
                color: "var(--text-primary)",
                fontSize: "1rem",
                fontWeight: 700
              },
              children: [
                /* @__PURE__ */ jsxDEV("option", { value: "", children: [
                  "-- ",
                  "請選擇",
                  " --"
                ] }, void 0, true, {
                  fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                  lineNumber: 1131,
                  columnNumber: 29
                }, this),
                employees.map(
                  (emp) => /* @__PURE__ */ jsxDEV("option", { value: emp.emp_id, children: [
                    emp.emp_id,
                    " | ",
                    emp.name
                  ] }, emp.emp_id, true, {
                    fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                    lineNumber: 1133,
                    columnNumber: 15
                  }, this)
                )
              ]
            },
            void 0,
            true,
            {
              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
              lineNumber: 1109,
              columnNumber: 25
            },
            this
          )
        ] }, void 0, true, {
          fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
          lineNumber: 1107,
          columnNumber: 21
        }, this)
      ] }, void 0, true, {
        fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
        lineNumber: 969,
        columnNumber: 17
      }, this),
      !canEditThisDocType && /* @__PURE__ */ jsxDEV("div", { style: { marginTop: "0.6rem", color: "var(--warning)", fontSize: "0.8rem", fontWeight: 700 }, children: "您沒有權限編輯此單據。" }, void 0, false, {
        fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
        lineNumber: 1139,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
      lineNumber: 886,
      columnNumber: 13
    }, this),
    !isPickerOpen && /* @__PURE__ */ jsxDEV(
      DocProductHistoryDrawer,
      {
        open: historyDrawerOpen,
        onClose: () => setHistoryDrawerOpen(false),
        focusPId: docHistoryFocusPId
      },
      void 0,
      false,
      {
        fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
        lineNumber: 1146,
        columnNumber: 7
      },
      this
    ),
    /* @__PURE__ */ jsxDEV(
      "div",
      {
        className: "custom-scrollbar",
        "data-doc-items-zone": true,
        style: { flex: 1, minHeight: 0, overflowY: "auto", overflowX: "auto", padding: "1.5rem" },
        children: /* @__PURE__ */ jsxDEV(
          "div",
          {
            style: { background: "var(--bg-secondary)", borderRadius: "8px", border: "1px solid var(--border-color)", overflow: "hidden" },
            ref: docListKeyboardRef,
            tabIndex: !isReadOnly ? 0 : -1,
            onKeyDown: handleDocListKeyDown,
            children: [
              !isReadOnly && /* @__PURE__ */ jsxDEV("div", { style: { padding: "0.75rem 1rem", borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-secondary)" }, children: /* @__PURE__ */ jsxDEV(
                "button",
                {
                  onClick: handleDeleteSelected,
                  disabled: selectedIndexes.length === 0,
                  style: {
                    backgroundColor: selectedIndexes.length === 0 ? "var(--bg-tertiary)" : "#ef4444",
                    color: selectedIndexes.length === 0 ? "var(--text-muted)" : "white",
                    border: "none",
                    padding: "0.45rem 0.8rem",
                    borderRadius: "6px",
                    cursor: selectedIndexes.length === 0 ? "not-allowed" : "pointer",
                    fontWeight: 700
                  },
                  children: "刪除"
                },
                void 0,
                false,
                {
                  fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                  lineNumber: 1167,
                  columnNumber: 29
                },
                this
              ) }, void 0, false, {
                fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                lineNumber: 1166,
                columnNumber: 11
              }, this),
              /* @__PURE__ */ jsxDEV("table", { style: { width: "100%", borderCollapse: "collapse", textAlign: "left" }, children: [
                /* @__PURE__ */ jsxDEV("thead", { style: { backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)", fontSize: "0.75rem", textTransform: "uppercase" }, children: /* @__PURE__ */ jsxDEV("tr", { children: [
                  /* @__PURE__ */ jsxDEV("th", { style: { padding: "1rem", width: "54px" }, children: !isReadOnly && /* @__PURE__ */ jsxDEV(
                    "input",
                    {
                      ref: selectAllRef,
                      type: "checkbox",
                      checked: isAllSelected,
                      onChange: (e) => toggleSelectAllItems(e.target.checked)
                    },
                    void 0,
                    false,
                    {
                      fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                      lineNumber: 1189,
                      columnNumber: 19
                    },
                    this
                  ) }, void 0, false, {
                    fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                    lineNumber: 1187,
                    columnNumber: 33
                  }, this),
                  /* @__PURE__ */ jsxDEV("th", { style: { padding: "1rem" }, children: [
                    "零件號碼",
                    " (ID)"
                  ] }, void 0, true, {
                    fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                    lineNumber: 1197,
                    columnNumber: 33
                  }, this),
                  /* @__PURE__ */ jsxDEV("th", { style: { padding: "1rem" }, children: [
                    "車型",
                    " / ",
                    "年份"
                  ] }, void 0, true, {
                    fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                    lineNumber: 1198,
                    columnNumber: 33
                  }, this),
                  /* @__PURE__ */ jsxDEV("th", { style: { padding: "1rem" }, children: [
                    "品名",
                    " / ",
                    "規格"
                  ] }, void 0, true, {
                    fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                    lineNumber: 1199,
                    columnNumber: 33
                  }, this),
                  /* @__PURE__ */ jsxDEV("th", { style: { padding: "1rem" }, children: "品牌" }, void 0, false, {
                    fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                    lineNumber: 1200,
                    columnNumber: 33
                  }, this),
                  /* @__PURE__ */ jsxDEV("th", { style: { padding: "1rem", width: "80px", textAlign: "center" }, children: "庫存" }, void 0, false, {
                    fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                    lineNumber: 1201,
                    columnNumber: 33
                  }, this),
                  /* @__PURE__ */ jsxDEV("th", { style: { padding: "1rem", width: "100px" }, children: "數量" }, void 0, false, {
                    fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                    lineNumber: 1202,
                    columnNumber: 33
                  }, this),
                  /* @__PURE__ */ jsxDEV("th", { style: { padding: "1rem", width: "120px" }, children: "單價" }, void 0, false, {
                    fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                    lineNumber: 1203,
                    columnNumber: 33
                  }, this),
                  /* @__PURE__ */ jsxDEV("th", { style: { padding: "1rem", width: "120px" }, children: "小計" }, void 0, false, {
                    fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                    lineNumber: 1204,
                    columnNumber: 33
                  }, this),
                  /* @__PURE__ */ jsxDEV("th", { style: { padding: "1rem", width: "50px" } }, void 0, false, {
                    fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                    lineNumber: 1205,
                    columnNumber: 33
                  }, this)
                ] }, void 0, true, {
                  fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                  lineNumber: 1186,
                  columnNumber: 29
                }, this) }, void 0, false, {
                  fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                  lineNumber: 1185,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV("tbody", { ref: itemTbodyRef, children: [
                  doc.items.map((item, idx) => {
                    const associatedProduct = item._full_product || products.find((p) => p.p_id === item.p_id || item.part_number && (p.part_number === item.part_number || p.part_numbers?.some((pn) => pn.part_number === item.part_number)));
                    const mappingCount = associatedProduct?.part_numbers?.length || 0;
                    const displayCarModel = item.car_model || (associatedProduct ? productLineCarModel(associatedProduct) : "-");
                    const displayYear = item.year || (associatedProduct ? productLineYear(associatedProduct) : "-");
                    const displayName = item.name || associatedProduct?.name || "-";
                    const displaySpec = item.spec || associatedProduct?.specifications || "-";
                    const displayBrand = item.brand || associatedProduct?.brand || associatedProduct?.part_numbers?.[0]?.brand || "-";
                    return /* @__PURE__ */ jsxDEV(
                      "tr",
                      {
                        "data-doc-item-row-idx": idx,
                        tabIndex: !isReadOnly ? -1 : void 0,
                        style: {
                          borderBottom: "1px solid var(--border-color)",
                          fontSize: "0.85rem",
                          backgroundColor: !isReadOnly && activeItemIndex === idx ? "var(--bg-tertiary)" : void 0
                        },
                        onClick: (ev) => {
                          if (!isReadOnly) {
                            setActiveItemIndex(idx);
                            ev.currentTarget.focus();
                          }
                        },
                        children: [
                          /* @__PURE__ */ jsxDEV("td", { style: { padding: "1rem", textAlign: "center" }, children: !isReadOnly && /* @__PURE__ */ jsxDEV(
                            "input",
                            {
                              type: "checkbox",
                              checked: selectedIndexes.includes(idx),
                              onChange: (e) => toggleItemSelection(idx, e.target.checked)
                            },
                            void 0,
                            false,
                            {
                              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                              lineNumber: 1239,
                              columnNumber: 23
                            },
                            this
                          ) }, void 0, false, {
                            fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                            lineNumber: 1237,
                            columnNumber: 41
                          }, this),
                          /* @__PURE__ */ jsxDEV("td", { style: { padding: "1rem" }, children: [
                            /* @__PURE__ */ jsxDEV("div", { style: { color: "#60a5fa", fontWeight: 800, fontFamily: "monospace" }, children: item.part_number || item.p_id }, void 0, false, {
                              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                              lineNumber: 1247,
                              columnNumber: 45
                            }, this),
                            /* @__PURE__ */ jsxDEV("div", { style: { fontSize: "0.7rem", color: "var(--text-muted)" }, children: item.p_id !== item.part_number ? item.p_id : associatedProduct?.p_id || "" }, void 0, false, {
                              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                              lineNumber: 1248,
                              columnNumber: 45
                            }, this),
                            mappingCount > 0 && /* @__PURE__ */ jsxDEV(
                              "div",
                              {
                                style: { mt: "4px", fontSize: "10px", backgroundColor: "var(--bg-tertiary)", padding: "2px 6px", borderRadius: "4px", color: "#60a5fa", cursor: "pointer", display: "inline-block", border: "1px solid var(--border-color)" },
                                onClick: (e) => {
                                  e.stopPropagation();
                                  setMappingProduct(associatedProduct);
                                },
                                children: [
                                  "+",
                                  mappingCount,
                                  " ",
                                  "適用"
                                ]
                              },
                              void 0,
                              true,
                              {
                                fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                                lineNumber: 1250,
                                columnNumber: 23
                              },
                              this
                            )
                          ] }, void 0, true, {
                            fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                            lineNumber: 1246,
                            columnNumber: 41
                          }, this),
                          /* @__PURE__ */ jsxDEV("td", { style: { padding: "1rem" }, children: [
                            /* @__PURE__ */ jsxDEV("div", { style: { fontWeight: 800, color: "var(--text-primary)" }, children: displayCarModel }, void 0, false, {
                              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                              lineNumber: 1258,
                              columnNumber: 45
                            }, this),
                            /* @__PURE__ */ jsxDEV("div", { style: { fontSize: "0.75rem", color: "var(--text-muted)" }, children: displayYear }, void 0, false, {
                              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                              lineNumber: 1259,
                              columnNumber: 45
                            }, this)
                          ] }, void 0, true, {
                            fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                            lineNumber: 1257,
                            columnNumber: 41
                          }, this),
                          /* @__PURE__ */ jsxDEV("td", { style: { padding: "1rem" }, children: [
                            /* @__PURE__ */ jsxDEV("div", { style: { fontWeight: 800, color: "var(--text-primary)" }, children: displayName }, void 0, false, {
                              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                              lineNumber: 1262,
                              columnNumber: 45
                            }, this),
                            /* @__PURE__ */ jsxDEV("div", { style: { fontSize: "0.75rem", color: "var(--text-muted)" }, children: displaySpec }, void 0, false, {
                              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                              lineNumber: 1263,
                              columnNumber: 45
                            }, this)
                          ] }, void 0, true, {
                            fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                            lineNumber: 1261,
                            columnNumber: 41
                          }, this),
                          /* @__PURE__ */ jsxDEV("td", { style: { padding: "1rem" }, children: /* @__PURE__ */ jsxDEV("div", { style: { fontWeight: 800, color: "var(--text-primary)" }, children: displayBrand }, void 0, false, {
                            fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                            lineNumber: 1266,
                            columnNumber: 45
                          }, this) }, void 0, false, {
                            fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                            lineNumber: 1265,
                            columnNumber: 41
                          }, this),
                          /* @__PURE__ */ jsxDEV("td", { style: { padding: "1rem", textAlign: "center" }, children: /* @__PURE__ */ jsxDEV("div", { style: { fontWeight: 700, fontSize: "0.85rem", color: (associatedProduct?.stock ?? item.stock ?? 0) > 0 ? "#10b981" : "#ef4444" }, children: associatedProduct?.stock ?? item.stock ?? "-" }, void 0, false, {
                            fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                            lineNumber: 1269,
                            columnNumber: 45
                          }, this) }, void 0, false, {
                            fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                            lineNumber: 1268,
                            columnNumber: 41
                          }, this),
                          /* @__PURE__ */ jsxDEV("td", { style: { padding: "0.5rem 1rem" }, children: /* @__PURE__ */ jsxDEV(
                            "input",
                            {
                              "data-doc-item-qty": true,
                              type: "number",
                              disabled: isReadOnly,
                              value: item.qty,
                              onChange: (e) => updateItem(idx, "qty", parseInt(e.target.value)),
                              onKeyDown: (e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  focusPriceInput(idx);
                                }
                              },
                              style: {
                                width: "100%",
                                padding: "0.4rem",
                                backgroundColor: isReadOnly ? "transparent" : "var(--bg-tertiary)",
                                border: isReadOnly ? "none" : "1px solid var(--border-color)",
                                borderRadius: "4px",
                                color: "var(--text-primary)",
                                textAlign: "center"
                              }
                            },
                            void 0,
                            false,
                            {
                              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                              lineNumber: 1274,
                              columnNumber: 45
                            },
                            this
                          ) }, void 0, false, {
                            fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                            lineNumber: 1273,
                            columnNumber: 41
                          }, this),
                          /* @__PURE__ */ jsxDEV("td", { style: { padding: "0.5rem 1rem" }, children: /* @__PURE__ */ jsxDEV(
                            "input",
                            {
                              "data-doc-item-price": true,
                              type: "number",
                              disabled: isReadOnly,
                              value: item.unit_price,
                              onChange: (e) => updateItem(idx, "unit_price", parseFloat(e.target.value)),
                              onKeyDown: (e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (idx < doc.items.length - 1) {
                                    focusQtyInput(idx + 1);
                                    setActiveItemIndex(idx + 1);
                                  } else {
                                    addPartBtnRef.current?.focus();
                                  }
                                }
                              },
                              style: {
                                width: "100%",
                                padding: "0.4rem",
                                backgroundColor: isReadOnly ? "transparent" : "var(--bg-tertiary)",
                                border: isReadOnly ? "none" : "1px solid var(--border-color)",
                                borderRadius: "4px",
                                color: "var(--text-primary)",
                                textAlign: "center"
                              }
                            },
                            void 0,
                            false,
                            {
                              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                              lineNumber: 1298,
                              columnNumber: 45
                            },
                            this
                          ) }, void 0, false, {
                            fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                            lineNumber: 1297,
                            columnNumber: 41
                          }, this),
                          /* @__PURE__ */ jsxDEV("td", { style: { padding: "1rem", fontWeight: 800 }, children: (item.qty * item.unit_price).toLocaleString() }, void 0, false, {
                            fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                            lineNumber: 1326,
                            columnNumber: 41
                          }, this),
                          /* @__PURE__ */ jsxDEV("td", { style: { padding: "1rem" }, children: !isReadOnly && /* @__PURE__ */ jsxDEV("button", { onClick: () => removeItem(idx), style: { color: "#ef4444", border: "none", background: "none", cursor: "pointer" }, children: /* @__PURE__ */ jsxDEV(Trash2, { size: 16 }, void 0, false, {
                            fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                            lineNumber: 1328,
                            columnNumber: 185
                          }, this) }, void 0, false, {
                            fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                            lineNumber: 1328,
                            columnNumber: 61
                          }, this) }, void 0, false, {
                            fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                            lineNumber: 1327,
                            columnNumber: 41
                          }, this)
                        ]
                      },
                      idx,
                      true,
                      {
                        fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                        lineNumber: 1221,
                        columnNumber: 19
                      },
                      this
                    );
                  }),
                  !isReadOnly && /* @__PURE__ */ jsxDEV("tr", { children: /* @__PURE__ */ jsxDEV("td", { colSpan: 10, style: { padding: "1rem" }, children: /* @__PURE__ */ jsxDEV(
                    "button",
                    {
                      type: "button",
                      ref: addPartBtnRef,
                      onClick: () => setIsPickerOpen(true),
                      onFocus: () => setIsAddPartFocused(true),
                      onBlur: () => setIsAddPartFocused(false),
                      style: {
                        color: "#3b82f6",
                        border: isAddPartFocused ? "2px solid #3b82f6" : "1px dashed #3b82f6",
                        background: isAddPartFocused ? "rgba(59, 130, 246, 0.2)" : "rgba(59, 130, 246, 0.1)",
                        boxShadow: isAddPartFocused ? "0 0 0 3px rgba(59, 130, 246, 0.25)" : "none",
                        width: "100%",
                        padding: "0.5rem",
                        borderRadius: "6px",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: "0.5rem",
                        fontWeight: 700,
                        outline: "none",
                        transition: "border 0.15s ease, background 0.15s ease, box-shadow 0.15s ease"
                      },
                      children: [
                        /* @__PURE__ */ jsxDEV(Plus, { size: 16 }, void 0, false, {
                          fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                          lineNumber: 1360,
                          columnNumber: 45
                        }, this),
                        " ",
                        "新增零件"
                      ]
                    },
                    void 0,
                    true,
                    {
                      fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                      lineNumber: 1336,
                      columnNumber: 41
                    },
                    this
                  ) }, void 0, false, {
                    fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                    lineNumber: 1335,
                    columnNumber: 37
                  }, this) }, void 0, false, {
                    fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                    lineNumber: 1334,
                    columnNumber: 15
                  }, this)
                ] }, void 0, true, {
                  fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                  lineNumber: 1208,
                  columnNumber: 25
                }, this)
              ] }, void 0, true, {
                fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                lineNumber: 1184,
                columnNumber: 21
              }, this)
            ]
          },
          void 0,
          true,
          {
            fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
            lineNumber: 1159,
            columnNumber: 17
          },
          this
        )
      },
      void 0,
      false,
      {
        fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
        lineNumber: 1154,
        columnNumber: 13
      },
      this
    ),
    /* @__PURE__ */ jsxDEV("div", { style: { padding: "1rem 2rem", backgroundColor: "var(--bg-secondary)", display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--border-color)" }, children: /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", gap: "3rem", alignItems: "center" }, children: [
      /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", gap: "1.5rem", color: "var(--text-secondary)", fontSize: "0.9rem" }, children: [
        /* @__PURE__ */ jsxDEV("span", { children: [
          "總項數",
          ": ",
          /* @__PURE__ */ jsxDEV("b", { children: doc.items.length }, void 0, false, {
            fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
            lineNumber: 1374,
            columnNumber: 55
          }, this)
        ] }, void 0, true, {
          fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
          lineNumber: 1374,
          columnNumber: 25
        }, this),
        /* @__PURE__ */ jsxDEV("span", { children: [
          "總件數",
          ": ",
          /* @__PURE__ */ jsxDEV("b", { children: doc.items.reduce((sum, item) => sum + (item.qty || 0), 0) }, void 0, false, {
            fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
            lineNumber: 1375,
            columnNumber: 55
          }, this)
        ] }, void 0, true, {
          fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
          lineNumber: 1375,
          columnNumber: 25
        }, this)
      ] }, void 0, true, {
        fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
        lineNumber: 1373,
        columnNumber: 21
      }, this),
      /* @__PURE__ */ jsxDEV("div", { style: { textAlign: "right" }, children: [
        /* @__PURE__ */ jsxDEV("div", { style: { color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: "0.25rem" }, children: [
          "未稅小計",
          ": ",
          formatAmount(subtotal)
        ] }, void 0, true, {
          fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
          lineNumber: 1378,
          columnNumber: 25
        }, this),
        vatEnabled && /* @__PURE__ */ jsxDEV("div", { style: { color: "var(--accent-hover)", fontSize: "0.95rem", marginBottom: "0.3rem", fontWeight: 700 }, children: [
          "VAT (",
          Number(vatRate || 0).toFixed(2),
          "%): ",
          formatAmount(vatAmount),
          " (",
          "稅額",
          ")"
        ] }, void 0, true, {
          fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
          lineNumber: 1382,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { fontSize: "1.8rem", fontWeight: 900, color: "var(--warning)" }, children: [
          vatEnabled ? "含稅總計" : "未稅總計",
          " (",
          doc.currency,
          "): ",
          formatAmount(grandTotal)
        ] }, void 0, true, {
          fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
          lineNumber: 1386,
          columnNumber: 25
        }, this)
      ] }, void 0, true, {
        fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
        lineNumber: 1377,
        columnNumber: 21
      }, this)
    ] }, void 0, true, {
      fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
      lineNumber: 1372,
      columnNumber: 17
    }, this) }, void 0, false, {
      fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
      lineNumber: 1371,
      columnNumber: 13
    }, this),
    isPickerOpen && /* @__PURE__ */ jsxDEV(
      "div",
      {
        role: "dialog",
        "data-doc-picker-zone": true,
        style: { position: "fixed", inset: 0, backgroundColor: "rgba(0, 0, 0, 0.55)", zIndex: 1e3, display: "flex", flexDirection: "column", padding: "1.5rem" },
        children: [
          /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }, children: [
            /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", alignItems: "center", gap: "0.75rem" }, children: [
              /* @__PURE__ */ jsxDEV(Package, { size: 24, style: { color: "#3b82f6" } }, void 0, false, {
                fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                lineNumber: 1402,
                columnNumber: 29
              }, this),
              /* @__PURE__ */ jsxDEV("h2", { style: { fontSize: "1.5rem", fontWeight: 800 }, children: "產品資料中心" }, void 0, false, {
                fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                lineNumber: 1403,
                columnNumber: 29
              }, this)
            ] }, void 0, true, {
              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
              lineNumber: 1401,
              columnNumber: 25
            }, this),
            /* @__PURE__ */ jsxDEV("button", { onClick: () => setIsPickerOpen(false), style: { background: "#ef4444", color: "white", border: "none", padding: "0.5rem 1rem", borderRadius: "4px", cursor: "pointer", fontWeight: 600 }, children: [
              "[X] ",
              "關閉"
            ] }, void 0, true, {
              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
              lineNumber: 1405,
              columnNumber: 25
            }, this)
          ] }, void 0, true, {
            fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
            lineNumber: 1400,
            columnNumber: 21
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { background: "var(--bg-secondary)", padding: "1.25rem", borderRadius: "12px", border: "1px solid var(--border-color)", marginBottom: "1rem", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }, children: /* @__PURE__ */ jsxDEV("form", { ref: pickerFormRef, onSubmit: (e) => e.preventDefault(), onKeyDown: handlePickerFormKeyDown, style: { display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end", overflow: "visible", paddingBottom: "0.15rem" }, children: [
            /* @__PURE__ */ jsxDEV(
              "button",
              {
                ref: pickerResetBtnRef,
                type: "button",
                onClick: handleClearPicker,
                className: styles.searchResetBtn,
                style: { background: "var(--bg-tertiary)", color: "var(--text-primary)", border: "1px solid var(--border-color)", padding: "0 12px", borderRadius: "8px", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", height: "36px", flexShrink: 0 },
                title: "重設條件",
                children: /* @__PURE__ */ jsxDEV(RotateCcw, { size: 16 }, void 0, false, {
                  fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                  lineNumber: 1419,
                  columnNumber: 33
                }, this)
              },
              void 0,
              false,
              {
                fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                lineNumber: 1411,
                columnNumber: 29
              },
              this
            ),
            /* @__PURE__ */ jsxDEV("div", { "data-picker-field": "0", style: { display: "flex", flexDirection: "column", minWidth: "120px", flex: 1 }, children: [
              /* @__PURE__ */ jsxDEV("label", { style: { fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.45rem", whiteSpace: "nowrap" }, children: [
                "零件號碼",
                " (Part No.)"
              ] }, void 0, true, {
                fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                lineNumber: 1422,
                columnNumber: 33
              }, this),
              /* @__PURE__ */ jsxDEV(
                "input",
                {
                  ref: pickerFirstInputRef,
                  type: "text",
                  placeholder: "輸入關鍵字",
                  value: pickerQuery.partNumber,
                  onChange: (e) => setPickerQuery({ ...pickerQuery, partNumber: e.target.value }),
                  style: { padding: "8px 12px", background: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: "8px", color: "var(--text-primary)", width: "100%", fontSize: "0.85rem" }
                },
                void 0,
                false,
                {
                  fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                  lineNumber: 1423,
                  columnNumber: 33
                },
                this
              )
            ] }, void 0, true, {
              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
              lineNumber: 1421,
              columnNumber: 29
            }, this),
            /* @__PURE__ */ jsxDEV("div", { "data-picker-field": "1", style: { display: "flex", flexDirection: "column", minWidth: "130px", flex: 1 }, children: [
              /* @__PURE__ */ jsxDEV("label", { style: { fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.45rem", whiteSpace: "nowrap" }, children: "車型" }, void 0, false, {
                fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                lineNumber: 1434,
                columnNumber: 33
              }, this),
              /* @__PURE__ */ jsxDEV(
                AutocompleteInput,
                {
                  value: pickerQuery.model,
                  onChange: (val) => setPickerQuery({ ...pickerQuery, model: val }),
                  placeholder: "輸入搜尋",
                  data: models,
                  filterKey: "shorthand",
                  labelKey: "fullname",
                  compact: true
                },
                void 0,
                false,
                {
                  fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                  lineNumber: 1435,
                  columnNumber: 33
                },
                this
              )
            ] }, void 0, true, {
              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
              lineNumber: 1433,
              columnNumber: 29
            }, this),
            /* @__PURE__ */ jsxDEV("div", { "data-picker-field": "2", style: { display: "flex", flexDirection: "column", minWidth: "130px", flex: 1 }, children: [
              /* @__PURE__ */ jsxDEV("label", { style: { fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.45rem", whiteSpace: "nowrap" }, children: "品名" }, void 0, false, {
                fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                lineNumber: 1447,
                columnNumber: 33
              }, this),
              /* @__PURE__ */ jsxDEV(
                AutocompleteInput,
                {
                  value: pickerQuery.part,
                  onChange: (val) => setPickerQuery({ ...pickerQuery, part: val }),
                  placeholder: "輸入搜尋",
                  data: parts,
                  filterKey: "shorthand",
                  labelKey: "fullname",
                  compact: true
                },
                void 0,
                false,
                {
                  fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                  lineNumber: 1448,
                  columnNumber: 33
                },
                this
              )
            ] }, void 0, true, {
              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
              lineNumber: 1446,
              columnNumber: 29
            }, this),
            /* @__PURE__ */ jsxDEV("div", { "data-picker-field": "3", style: { display: "flex", flexDirection: "column", minWidth: "90px", flex: 1 }, children: [
              /* @__PURE__ */ jsxDEV("label", { style: { fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.45rem", whiteSpace: "nowrap" }, children: "規格" }, void 0, false, {
                fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                lineNumber: 1460,
                columnNumber: 33
              }, this),
              /* @__PURE__ */ jsxDEV("input", { type: "text", placeholder: "CC或規格", value: pickerQuery.spec, onChange: (e) => setPickerQuery({ ...pickerQuery, spec: e.target.value }), style: { padding: "8px 12px", background: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: "8px", color: "var(--text-primary)", width: "100%", fontSize: "0.85rem" } }, void 0, false, {
                fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                lineNumber: 1461,
                columnNumber: 33
              }, this)
            ] }, void 0, true, {
              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
              lineNumber: 1459,
              columnNumber: 29
            }, this),
            /* @__PURE__ */ jsxDEV("div", { "data-picker-field": "4", style: { display: "flex", flexDirection: "column", minWidth: "80px", flex: 1 }, children: [
              /* @__PURE__ */ jsxDEV("label", { style: { fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.45rem", whiteSpace: "nowrap" }, children: "年份" }, void 0, false, {
                fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                lineNumber: 1465,
                columnNumber: 33
              }, this),
              /* @__PURE__ */ jsxDEV("input", { type: "text", placeholder: "例如 18-22", value: pickerQuery.year, onChange: (e) => setPickerQuery({ ...pickerQuery, year: e.target.value }), style: { padding: "8px 12px", background: "var(--bg-tertiary)", border: "1px solid var(--border-color)", borderRadius: "8px", color: "var(--text-primary)", width: "100%", fontSize: "0.85rem" } }, void 0, false, {
                fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                lineNumber: 1466,
                columnNumber: 33
              }, this)
            ] }, void 0, true, {
              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
              lineNumber: 1464,
              columnNumber: 29
            }, this),
            /* @__PURE__ */ jsxDEV("div", { "data-picker-field": "5", style: { display: "flex", flexDirection: "column", minWidth: "110px", flex: 1 }, children: [
              /* @__PURE__ */ jsxDEV("label", { style: { fontSize: "0.75rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.45rem", whiteSpace: "nowrap" }, children: "品牌" }, void 0, false, {
                fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                lineNumber: 1470,
                columnNumber: 33
              }, this),
              /* @__PURE__ */ jsxDEV(
                AutocompleteInput,
                {
                  value: pickerQuery.brand,
                  onChange: (val) => setPickerQuery({ ...pickerQuery, brand: val }),
                  placeholder: "輸入搜尋",
                  data: brands,
                  filterKey: "shorthand",
                  labelKey: "fullname",
                  compact: true
                },
                void 0,
                false,
                {
                  fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                  lineNumber: 1471,
                  columnNumber: 33
                },
                this
              )
            ] }, void 0, true, {
              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
              lineNumber: 1469,
              columnNumber: 29
            }, this)
          ] }, void 0, true, {
            fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
            lineNumber: 1410,
            columnNumber: 25
          }, this) }, void 0, false, {
            fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
            lineNumber: 1409,
            columnNumber: 21
          }, this),
          /* @__PURE__ */ jsxDEV(
            DocProductHistoryDrawer,
            {
              open: historyDrawerOpen,
              onClose: () => setHistoryDrawerOpen(false),
              focusPId: docHistoryFocusPId
            },
            void 0,
            false,
            {
              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
              lineNumber: 1484,
              columnNumber: 21
            },
            this
          ),
          /* @__PURE__ */ jsxDEV(
            "div",
            {
              ref: pickerListRef,
              tabIndex: 0,
              onKeyDown: handlePickerListKeyDown,
              style: { flex: 1, overflowY: "auto", background: "var(--bg-secondary)", borderRadius: "12px", border: "1px solid var(--border-color)", outline: "none" },
              children: [
                /* @__PURE__ */ jsxDEV(
                  "div",
                  {
                    style: {
                      padding: "0.75rem 1rem",
                      borderBottom: "1px solid var(--border-color)",
                      backgroundColor: "var(--bg-tertiary)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "1rem",
                      flexShrink: 0
                    },
                    children: [
                      /* @__PURE__ */ jsxDEV(
                        "button",
                        {
                          onClick: handlePickSelectedProducts,
                          disabled: selectedPickerProductIds.length === 0,
                          style: {
                            background: selectedPickerProductIds.length === 0 ? "var(--bg-tertiary)" : "#dc2626",
                            color: selectedPickerProductIds.length === 0 ? "var(--text-muted)" : "white",
                            border: "none",
                            borderRadius: "8px",
                            padding: "0.45rem 0.85rem",
                            fontWeight: 700,
                            cursor: selectedPickerProductIds.length === 0 ? "not-allowed" : "pointer"
                          },
                          children: "批次確認取回"
                        },
                        void 0,
                        false,
                        {
                          fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                          lineNumber: 1508,
                          columnNumber: 29
                        },
                        this
                      ),
                      /* @__PURE__ */ jsxDEV(
                        "span",
                        {
                          style: {
                            fontSize: "0.8125rem",
                            fontWeight: 600,
                            color: "var(--text-secondary)",
                            whiteSpace: "nowrap"
                          },
                          "aria-live": "polite",
                          children: pickerMatchTotal > 50 ? `搜尋結果：共 ${pickerMatchTotal} 筆（顯示前 50 筆）` : `搜尋結果：${pickerMatchTotal} 筆`
                        },
                        void 0,
                        false,
                        {
                          fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                          lineNumber: 1523,
                          columnNumber: 29
                        },
                        this
                      )
                    ]
                  },
                  void 0,
                  true,
                  {
                    fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                    lineNumber: 1496,
                    columnNumber: 25
                  },
                  this
                ),
                /* @__PURE__ */ jsxDEV("table", { style: { width: "100%", borderCollapse: "collapse", textAlign: "left" }, children: [
                  /* @__PURE__ */ jsxDEV("thead", { style: { position: "sticky", top: 0, backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)", fontSize: "0.75rem" }, children: /* @__PURE__ */ jsxDEV("tr", { children: [
                    /* @__PURE__ */ jsxDEV("th", { style: { padding: "1rem", width: "48px", textAlign: "center" }, children: /* @__PURE__ */ jsxDEV(
                      "input",
                      {
                        ref: pickerSelectAllRef,
                        type: "checkbox",
                        checked: isPickerAllSelected,
                        onChange: (e) => togglePickerSelectAll(e.target.checked)
                      },
                      void 0,
                      false,
                      {
                        fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                        lineNumber: 1541,
                        columnNumber: 41
                      },
                      this
                    ) }, void 0, false, {
                      fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                      lineNumber: 1540,
                      columnNumber: 37
                    }, this),
                    /* @__PURE__ */ jsxDEV("th", { style: { padding: "1rem" }, children: [
                      "零件號碼",
                      " (ID)"
                    ] }, void 0, true, {
                      fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                      lineNumber: 1548,
                      columnNumber: 37
                    }, this),
                    /* @__PURE__ */ jsxDEV("th", { style: { padding: "1rem" }, children: [
                      "車型",
                      " / ",
                      "年份"
                    ] }, void 0, true, {
                      fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                      lineNumber: 1549,
                      columnNumber: 37
                    }, this),
                    /* @__PURE__ */ jsxDEV("th", { style: { padding: "1rem" }, children: [
                      "品名",
                      " / ",
                      "規格"
                    ] }, void 0, true, {
                      fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                      lineNumber: 1550,
                      columnNumber: 37
                    }, this),
                    /* @__PURE__ */ jsxDEV("th", { style: { padding: "1rem" }, children: "品牌" }, void 0, false, {
                      fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                      lineNumber: 1551,
                      columnNumber: 37
                    }, this),
                    /* @__PURE__ */ jsxDEV("th", { style: { padding: "1rem" }, children: "庫存" }, void 0, false, {
                      fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                      lineNumber: 1552,
                      columnNumber: 37
                    }, this),
                    /* @__PURE__ */ jsxDEV("th", { style: { padding: "1rem" }, children: "單價" }, void 0, false, {
                      fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                      lineNumber: 1553,
                      columnNumber: 37
                    }, this),
                    /* @__PURE__ */ jsxDEV("th", { style: { padding: "1rem", textAlign: "center" }, children: "操作" }, void 0, false, {
                      fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                      lineNumber: 1554,
                      columnNumber: 37
                    }, this)
                  ] }, void 0, true, {
                    fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                    lineNumber: 1539,
                    columnNumber: 33
                  }, this) }, void 0, false, {
                    fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                    lineNumber: 1538,
                    columnNumber: 29
                  }, this),
                  /* @__PURE__ */ jsxDEV("tbody", { children: [
                    pickerResults.map((p, idx) => {
                      const pnObj = p.part_numbers?.[0] || {};
                      const isPurch = type === "purchase" || type === "purchaseReturn";
                      const isActive = idx === activePickerRowIndex;
                      return /* @__PURE__ */ jsxDEV(
                        "tr",
                        {
                          "data-picker-row-idx": idx,
                          style: {
                            borderBottom: "1px solid var(--border-color)",
                            backgroundColor: isActive ? "rgba(59, 130, 246, 0.15)" : void 0
                          },
                          children: [
                            /* @__PURE__ */ jsxDEV("td", { style: { padding: "1rem", textAlign: "center" }, children: /* @__PURE__ */ jsxDEV(
                              "input",
                              {
                                type: "checkbox",
                                checked: selectedPickerProductIds.includes(p.p_id),
                                onChange: (e) => {
                                  togglePickerSelection(p.p_id, e.target.checked);
                                  setActivePickerRowIndex(idx);
                                  requestAnimationFrame(() => pickerListRef.current?.focus());
                                }
                              },
                              void 0,
                              false,
                              {
                                fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                                lineNumber: 1572,
                                columnNumber: 49
                              },
                              this
                            ) }, void 0, false, {
                              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                              lineNumber: 1571,
                              columnNumber: 45
                            }, this),
                            /* @__PURE__ */ jsxDEV("td", { style: { padding: "1rem" }, children: [
                              /* @__PURE__ */ jsxDEV("div", { style: { color: "#60a5fa", fontWeight: 800, fontFamily: "monospace" }, children: pnObj.part_number || p.part_number || p.p_id }, void 0, false, {
                                fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                                lineNumber: 1583,
                                columnNumber: 49
                              }, this),
                              /* @__PURE__ */ jsxDEV("div", { style: { fontSize: "0.7rem", color: "var(--text-muted)" }, children: p.p_id }, void 0, false, {
                                fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                                lineNumber: 1584,
                                columnNumber: 49
                              }, this),
                              (p.part_numbers || []).length > 0 && /* @__PURE__ */ jsxDEV(
                                "div",
                                {
                                  style: { mt: "4px", fontSize: "10px", backgroundColor: "var(--bg-tertiary)", padding: "2px 6px", borderRadius: "4px", color: "#60a5fa", cursor: "pointer", display: "inline-block", border: "1px solid var(--border-color)" },
                                  onClick: (e) => {
                                    e.stopPropagation();
                                    setMappingProduct(p);
                                  },
                                  children: [
                                    "+",
                                    p.part_numbers.length,
                                    " ",
                                    "適用"
                                  ]
                                },
                                void 0,
                                true,
                                {
                                  fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                                  lineNumber: 1586,
                                  columnNumber: 23
                                },
                                this
                              )
                            ] }, void 0, true, {
                              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                              lineNumber: 1582,
                              columnNumber: 45
                            }, this),
                            /* @__PURE__ */ jsxDEV("td", { style: { padding: "1rem" }, children: [
                              /* @__PURE__ */ jsxDEV("div", { style: { fontWeight: 800, color: "var(--text-primary)" }, children: productLineCarModel(p) || "-" }, void 0, false, {
                                fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                                lineNumber: 1595,
                                columnNumber: 49
                              }, this),
                              /* @__PURE__ */ jsxDEV("div", { style: { fontSize: "0.75rem", color: "var(--text-muted)" }, children: productLineYear(p) || "年份未知" }, void 0, false, {
                                fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                                lineNumber: 1596,
                                columnNumber: 49
                              }, this)
                            ] }, void 0, true, {
                              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                              lineNumber: 1594,
                              columnNumber: 45
                            }, this),
                            /* @__PURE__ */ jsxDEV("td", { style: { padding: "1rem" }, children: [
                              /* @__PURE__ */ jsxDEV("div", { style: { fontWeight: 800, color: "var(--text-primary)" }, children: p.name }, void 0, false, {
                                fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                                lineNumber: 1599,
                                columnNumber: 49
                              }, this),
                              /* @__PURE__ */ jsxDEV("div", { style: { fontSize: "0.75rem", color: "var(--text-muted)" }, children: p.specifications || "-" }, void 0, false, {
                                fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                                lineNumber: 1600,
                                columnNumber: 49
                              }, this)
                            ] }, void 0, true, {
                              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                              lineNumber: 1598,
                              columnNumber: 45
                            }, this),
                            /* @__PURE__ */ jsxDEV("td", { style: { padding: "1rem" }, children: /* @__PURE__ */ jsxDEV("div", { style: { fontWeight: 800, color: "var(--text-primary)" }, children: p.brand || pnObj.brand || "-" }, void 0, false, {
                              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                              lineNumber: 1603,
                              columnNumber: 49
                            }, this) }, void 0, false, {
                              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                              lineNumber: 1602,
                              columnNumber: 45
                            }, this),
                            /* @__PURE__ */ jsxDEV("td", { style: { padding: "1rem" }, children: /* @__PURE__ */ jsxDEV("div", { style: { fontWeight: 700, color: p.stock > 0 ? "#10b981" : "#ef4444" }, children: p.stock ?? 0 }, void 0, false, {
                              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                              lineNumber: 1606,
                              columnNumber: 49
                            }, this) }, void 0, false, {
                              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                              lineNumber: 1605,
                              columnNumber: 45
                            }, this),
                            /* @__PURE__ */ jsxDEV("td", { style: { padding: "1rem" }, children: /* @__PURE__ */ jsxDEV("div", { style: { fontWeight: 800 }, children: [
                              "NT$ ",
                              (isPurch ? productPurchaseUnitPrice(p) : productSalesUnitPrice(p)).toLocaleString()
                            ] }, void 0, true, {
                              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                              lineNumber: 1609,
                              columnNumber: 49
                            }, this) }, void 0, false, {
                              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                              lineNumber: 1608,
                              columnNumber: 45
                            }, this),
                            /* @__PURE__ */ jsxDEV("td", { style: { padding: "1rem", textAlign: "center" }, children: /* @__PURE__ */ jsxDEV(
                              "button",
                              {
                                onClick: () => handlePickProduct(p),
                                style: { backgroundColor: "#3b82f6", color: "white", border: "none", padding: "0.5rem 1rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem", fontWeight: 700 },
                                children: "選取"
                              },
                              void 0,
                              false,
                              {
                                fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                                lineNumber: 1612,
                                columnNumber: 49
                              },
                              this
                            ) }, void 0, false, {
                              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                              lineNumber: 1611,
                              columnNumber: 45
                            }, this)
                          ]
                        },
                        p.p_id,
                        true,
                        {
                          fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                          lineNumber: 1563,
                          columnNumber: 19
                        },
                        this
                      );
                    }),
                    pickerResults.length === 0 && /* @__PURE__ */ jsxDEV("tr", { children: /* @__PURE__ */ jsxDEV("td", { colSpan: 8, style: { textAlign: "center", padding: "3rem", color: "var(--text-muted)" }, children: "查無符合資料" }, void 0, false, {
                      fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                      lineNumber: 1624,
                      columnNumber: 41
                    }, this) }, void 0, false, {
                      fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                      lineNumber: 1623,
                      columnNumber: 15
                    }, this)
                  ] }, void 0, true, {
                    fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                    lineNumber: 1557,
                    columnNumber: 29
                  }, this)
                ] }, void 0, true, {
                  fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
                  lineNumber: 1537,
                  columnNumber: 25
                }, this)
              ]
            },
            void 0,
            true,
            {
              fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
              lineNumber: 1490,
              columnNumber: 21
            },
            this
          )
        ]
      },
      void 0,
      true,
      {
        fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
        lineNumber: 1395,
        columnNumber: 7
      },
      this
    ),
    mappingProduct && /* @__PURE__ */ jsxDEV(
      PartMappingModal,
      {
        product: mappingProduct,
        onClose: () => setMappingProduct(null)
      },
      void 0,
      false,
      {
        fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
        lineNumber: 1634,
        columnNumber: 7
      },
      this
    ),
    isViewerOpen && /* @__PURE__ */ jsxDEV(
      DocumentViewer,
      {
        doc,
        type,
        onClose: handleCloseViewerAndFocusPrint,
        onEdit: () => {
          setIsViewerOpen(false);
          if (canEditThisDocType) setIsReadOnly(false);
        }
      },
      void 0,
      false,
      {
        fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
        lineNumber: 1640,
        columnNumber: 7
      },
      this
    )
  ] }, void 0, true, {
    fileName: "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx",
    lineNumber: 884,
    columnNumber: 5
  }, this);
};
_s(DocumentEditorPage, "+xsEE2QSZL58JzjBRBaYabiywwM=", false, function() {
  return [useSearchParams, useTranslation, useDocumentStore, useProductStore, useSupplierStore, useCustomerStore, useEmployeeStore, useShorthandStore, useAppStore, useAppStore, useSearchFormKeyboardNav];
});
_c = DocumentEditorPage;
export default DocumentEditorPage;
var _c;
$RefreshReg$(_c, "DocumentEditorPage");
import * as RefreshRuntime from "/@react-refresh";
const inWebWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong."
    );
  }
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
function $RefreshReg$(type, id) {
  return RefreshRuntime.register(type, "D:/OneDrive/YTEC/AI-Gernated/ERP-AutoParts-V13/src/pages/Documents/DocumentEditorPage.jsx " + id);
}
function $RefreshSig$() {
  return RefreshRuntime.createSignatureFunctionForTransform();
}

//# sourceMappingURL=data:application/json;base64,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O0FBQUE7QUFBQTtBQUFBLHlCQXNFQTtBQUFBLHFCQTFGSjtBQUFBO0FBQUE7QUFBQTtBQUFBLHVCQTJGQTtBQUFBO0FBQUE7QUFBQSxZQTFJSjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsVUEySUE7QUFBQTtBQUFBO0FBQUEsTUExT0o7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBMk9BO0FBQUEsSUFHSGlELGtCQUNHO0FBQUEsTUFBQztBQUFBO0FBQUEsUUFDRyxTQUFTQTtBQUFBQSxRQUNULFNBQVMsTUFBTUMsa0JBQWtCLElBQUk7QUFBQTtBQUFBLE1BRnpDO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUUyQztBQUFBLElBRzlDQyxnQkFDRztBQUFBLE1BQUM7QUFBQTtBQUFBLFFBQ0c7QUFBQSxRQUNBO0FBQUEsUUFDQSxTQUFTK0g7QUFBQUEsUUFDVCxRQUFRLE1BQU07QUFDVjlILDBCQUFnQixLQUFLO0FBQ3JCLGNBQUl4QyxtQkFBb0JHLGVBQWMsS0FBSztBQUFBLFFBQy9DO0FBQUE7QUFBQSxNQVBKO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQU9NO0FBQUEsT0EzdkJkO0FBQUE7QUFBQTtBQUFBO0FBQUEsU0E4dkJBO0FBRVI7QUFBRXJELEdBcmxESUQsb0JBQWtCO0FBQUEsVUFDR25DLGlCQUNDUSxnQkFDbUhQLGtCQUN0SEMsaUJBQ0NDLGtCQUNBQyxrQkFDQUMsa0JBQ1lDLG1CQUM4RkMsYUF1RjlGQSxhQTRvQmxDZSx3QkFBd0I7QUFBQTtBQUFBLEtBNXVCdEJhO0FBdWxETixlQUFlQTtBQUFtQixJQUFBMlk7QUFBQSxhQUFBQSxJQUFBIiwibmFtZXMiOlsiUmVhY3QiLCJ1c2VTdGF0ZSIsInVzZUVmZmVjdCIsInVzZVJlZiIsInVzZU1lbW8iLCJ1c2VTZWFyY2hQYXJhbXMiLCJ1c2VEb2N1bWVudFN0b3JlIiwidXNlUHJvZHVjdFN0b3JlIiwidXNlU3VwcGxpZXJTdG9yZSIsInVzZUN1c3RvbWVyU3RvcmUiLCJ1c2VFbXBsb3llZVN0b3JlIiwidXNlU2hvcnRoYW5kU3RvcmUiLCJ1c2VBcHBTdG9yZSIsInVzZVRyYW5zbGF0aW9uIiwiY2FuRWRpdERvY1R5cGUiLCJYIiwiUGx1cyIsIlRyYXNoMiIsIlNhdmUiLCJGaWxlVGV4dCIsIlBhY2thZ2UiLCJSb3RhdGVDY3ciLCJFZGl0MiIsIlByaW50ZXIiLCJBdXRvY29tcGxldGVJbnB1dCIsIlBhcnRNYXBwaW5nTW9kYWwiLCJEb2N1bWVudFZpZXdlciIsInVzZVNlYXJjaEZvcm1LZXlib2FyZE5hdiIsIkRvY1Byb2R1Y3RIaXN0b3J5RHJhd2VyIiwiaXNFbGVtZW50SW5Eb2NQYXJ0RWRpdGluZ1pvbmUiLCJzb3J0ZWRDdXN0b21lcnNGb3JTZWxlY3QiLCJzb3J0ZWRTdXBwbGllcnNGb3JTZWxlY3QiLCJDb2RlTG9va3VwSW5wdXQiLCJwcm9kdWN0Q2FyTW9kZWxzU2VhcmNoVGV4dCIsInByb2R1Y3RQdXJjaGFzZVVuaXRQcmljZSIsInByb2R1Y3RTYWxlc1VuaXRQcmljZSIsInByb2R1Y3RMaW5lQ2FyTW9kZWwiLCJwcm9kdWN0TGluZVllYXIiLCJwcm9kdWN0WWVhclNlYXJjaEJsb2IiLCJzdHlsZXMiLCJEb2N1bWVudEVkaXRvclBhZ2UiLCJfcyIsInNlYXJjaFBhcmFtcyIsInQiLCJsYW5ndWFnZSIsImFkZERvY3VtZW50IiwidXBkYXRlRG9jdW1lbnQiLCJkZWxldGVEb2N1bWVudCIsImlucXVpcmllcyIsInB1cmNoYXNlT3JkZXJzIiwicXVvdGF0aW9ucyIsInNhbGVzT3JkZXJzIiwic2FsZXNSZXR1cm5zIiwicHVyY2hhc2VSZXR1cm5zIiwicHJvZHVjdHMiLCJzdXBwbGllcnMiLCJjdXN0b21lcnMiLCJlbXBsb3llZXMiLCJtb2RlbHMiLCJwYXJ0cyIsImJyYW5kcyIsImRlZmF1bHRDdXJyZW5jeSIsImlzTXVsdGlDb3VudHJ5TW9kZSIsImVuYWJsZUxvZ2luU3lzdGVtIiwiZW5hYmxlUGVybWlzc2lvblJvbGUiLCJjdXJyZW50VXNlckVtcElkIiwidmF0RW5hYmxlZCIsInZhdFJhdGUiLCJ0eXBlIiwiZ2V0IiwiaWQiLCJtb2RlIiwiaXNFZGl0IiwiaXNJbnRsIiwiY3VzdG9tZXJPcHRpb25zIiwic3VwcGxpZXJPcHRpb25zIiwiZG9jVHlwZU1ldGEiLCJxdW90YXRpb24iLCJsYWJlbCIsImNvbG9yIiwic2FsZXMiLCJzYWxlc1JldHVybiIsImlucXVpcnkiLCJwdXJjaGFzZSIsInB1cmNoYXNlUmV0dXJuIiwiZG9jVHlwZUxhYmVsS2V5TWFwIiwiY3VycmVudERvY01ldGEiLCJjdXJyZW50VXNlciIsImZpbmQiLCJlIiwiZW1wX2lkIiwiY2FuRWRpdFRoaXNEb2NUeXBlIiwiZG9jVHlwZSIsImlzUmVhZE9ubHkiLCJzZXRJc1JlYWRPbmx5IiwiZG9jIiwic2V0RG9jIiwiZGF0ZSIsIkRhdGUiLCJ0b0lTT1N0cmluZyIsInNwbGl0Iiwic3RhdHVzIiwiaXRlbXMiLCJjdXJyZW5jeSIsIm5vdGVzIiwic3VwcGxpZXJfaWQiLCJzdXBwbGllcl9uYW1lIiwiY3VzdG9tZXJfaWQiLCJjdXN0b21lcl9uYW1lIiwib3BlbmVyX2VtcF9pZCIsIm9wZW5lcl9lbXBfbmFtZSIsImRpc2NvdW50IiwiaXNQaWNrZXJPcGVuIiwic2V0SXNQaWNrZXJPcGVuIiwicGlja2VyUXVlcnkiLCJzZXRQaWNrZXJRdWVyeSIsInBhcnROdW1iZXIiLCJtb2RlbCIsInBhcnQiLCJzcGVjIiwieWVhciIsImJyYW5kIiwicGlja2VyUmVzdWx0cyIsInNldFBpY2tlclJlc3VsdHMiLCJwaWNrZXJNYXRjaFRvdGFsIiwic2V0UGlja2VyTWF0Y2hUb3RhbCIsInNlbGVjdGVkUGlja2VyUHJvZHVjdElkcyIsInNldFNlbGVjdGVkUGlja2VyUHJvZHVjdElkcyIsIm1hcHBpbmdQcm9kdWN0Iiwic2V0TWFwcGluZ1Byb2R1Y3QiLCJpc1ZpZXdlck9wZW4iLCJzZXRJc1ZpZXdlck9wZW4iLCJmb2N1c2VkSGVhZGVyQWN0aW9uIiwic2V0Rm9jdXNlZEhlYWRlckFjdGlvbiIsInBpY2tlckZpcnN0SW5wdXRSZWYiLCJwaWNrZXJGb3JtUmVmIiwicGlja2VyUmVzZXRCdG5SZWYiLCJwaWNrZXJMaXN0UmVmIiwiYWN0aXZlUGlja2VyUm93SW5kZXgiLCJzZXRBY3RpdmVQaWNrZXJSb3dJbmRleCIsInBpY2tlclRib2R5UmVmIiwicHJpbnRCdG5SZWYiLCJlZGl0QnRuUmVmIiwic2F2ZUJ0blJlZiIsImNsb3NlQnRuUmVmIiwic2VsZWN0QWxsUmVmIiwicGlja2VyU2VsZWN0QWxsUmVmIiwiYWRkUGFydEJ0blJlZiIsInNlbGVjdGVkSW5kZXhlcyIsInNldFNlbGVjdGVkSW5kZXhlcyIsImFjdGl2ZUl0ZW1JbmRleCIsInNldEFjdGl2ZUl0ZW1JbmRleCIsImhpc3RvcnlEcmF3ZXJPcGVuIiwic2V0SGlzdG9yeURyYXdlck9wZW4iLCJpc0FkZFBhcnRGb2N1c2VkIiwic2V0SXNBZGRQYXJ0Rm9jdXNlZCIsIml0ZW1UYm9keVJlZiIsImRvY0xpc3RLZXlib2FyZFJlZiIsInNldFByb2R1Y3RIaXN0b3J5Rm9jdXNQSWQiLCJzIiwiZG9jSGlzdG9yeUZvY3VzUElkIiwibGVuZ3RoIiwicF9pZCIsIml0ZW0iLCJTdHJpbmciLCJ0cmltIiwib25LZXkiLCJyZXBlYXQiLCJjb2RlIiwiZG9jdW1lbnQiLCJhY3RpdmVFbGVtZW50IiwicHJldmVudERlZmF1bHQiLCJ2Iiwid2luZG93IiwiYWRkRXZlbnRMaXN0ZW5lciIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJzdGF0ZSIsImdldFN0YXRlIiwiZXhpc3RpbmdEb2MiLCJkIiwiZG9jX2lkIiwidXBkYXRlZERvYyIsInN1cF9pZCIsIm5hbWUiLCJjIiwiY3VzdF9pZCIsInByZXYiLCJjdXJyZW50IiwiZm9jdXNFZGl0IiwiZm9jdXMiLCJ0MSIsInNldFRpbWVvdXQiLCJ0MiIsInQzIiwiY2xlYXJUaW1lb3V0IiwiZm9jdXNMaXN0IiwiZmlyc3RSb3ciLCJxdWVyeVNlbGVjdG9yIiwiZm9jdXNTYXZlIiwiaGFuZGxlRXNjIiwia2V5IiwiY29udGFpbnMiLCJpc1N1cHBsaWVyIiwiaXNDdXN0b21lciIsImZvcm1hdEFtb3VudCIsInZhbHVlIiwiTnVtYmVyIiwidG9Mb2NhbGVTdHJpbmciLCJ1bmRlZmluZWQiLCJtaW5pbXVtRnJhY3Rpb25EaWdpdHMiLCJtYXhpbXVtRnJhY3Rpb25EaWdpdHMiLCJzdWJ0b3RhbCIsInJlZHVjZSIsInN1bSIsInF0eSIsInVuaXRfcHJpY2UiLCJ2YXRBbW91bnQiLCJncmFuZFRvdGFsIiwiaXNDdXJyZW5jeUxvY2tlZCIsImhhbmRsZVNhdmUiLCJhbGVydCIsInNhdmVkRG9jIiwidXJsIiwiVVJMIiwibG9jYXRpb24iLCJzZXQiLCJoaXN0b3J5IiwicmVwbGFjZVN0YXRlIiwibG9jYWxTdG9yYWdlIiwic2V0SXRlbSIsImhhbmRsZUNsb3NlIiwidGFyZ2V0RG9jSWQiLCJzaG91bGREZWxldGUiLCJjb25maXJtIiwiZ2V0TGlzdEJ5VHlwZSIsInN0aWxsRXhpc3RzIiwic29tZSIsImZhbGxiYWNrVXJsIiwiZW5jb2RlVVJJQ29tcG9uZW50IiwicmV0dXJuRnJvbUh1YiIsInJldCIsInNlc3Npb25TdG9yYWdlIiwiZ2V0SXRlbSIsInN0YXJ0c1dpdGgiLCJ1Iiwib3JpZ2luIiwicGF0aG5hbWUiLCJ0b1N0cmluZyIsInJlbW92ZUl0ZW0iLCJpc1BvcHVwIiwib3BlbmVyIiwiY2xvc2UiLCJpc1N0aWxsT3BlbiIsImNsb3NlZCIsImhyZWYiLCJiYWNrIiwiaGFuZGxlUHJpbnQiLCJoYW5kbGVDbG9zZVZpZXdlckFuZEZvY3VzUHJpbnQiLCJmb2N1c1ByaW50IiwiZm9jdXNBY3Rpb25CdXR0b25CeUFycm93IiwiY3VycmVudFJlZiIsImRpcmVjdGlvbiIsImFjdGlvbkJ1dHRvblJlZnMiLCJmaWx0ZXIiLCJCb29sZWFuIiwicmVmT2JqIiwiY3VycmVudEluZGV4IiwiZmluZEluZGV4IiwibmV4dEluZGV4IiwiaGFuZGxlSGVhZGVyQWN0aW9uS2V5RG93biIsInN0b3BQcm9wYWdhdGlvbiIsImdldEhlYWRlckFjdGlvblN0eWxlIiwiYmFzZVN0eWxlIiwiYWN0aW9uS2V5Iiwib3V0bGluZSIsIm91dGxpbmVPZmZzZXQiLCJib3hTaGFkb3ciLCJ0cmFuc2Zvcm0iLCJhZGRFbXB0eUl0ZW0iLCJlbXB0eUl0ZW0iLCJwYXJ0X251bWJlciIsImNhcl9tb2RlbCIsInVuaXQiLCJzdG9jayIsIm5leHRMZW4iLCJpbmRleCIsIm5ld0l0ZW1zIiwic3BsaWNlIiwidXBkYXRlSXRlbSIsImZpZWxkIiwidG9nZ2xlSXRlbVNlbGVjdGlvbiIsImNoZWNrZWQiLCJpbmNsdWRlcyIsIml0ZW1JbmRleCIsInRvZ2dsZVNlbGVjdEFsbEl0ZW1zIiwibWFwIiwiXyIsImhhbmRsZURlbGV0ZVNlbGVjdGVkIiwic2VsZWN0ZWRTZXQiLCJTZXQiLCJoYXMiLCJpc0FsbFNlbGVjdGVkIiwiaXNQYXJ0aWFsbHlTZWxlY3RlZCIsImluZGV0ZXJtaW5hdGUiLCJyb3dFbCIsInNjcm9sbEludG9WaWV3IiwiYmxvY2siLCJpc1R5cGluZ1RhcmdldCIsImVsIiwidGFnTmFtZSIsInRhZyIsInRvTG93ZXJDYXNlIiwicm9sZSIsImdldEF0dHJpYnV0ZSIsImhhbmRsZUdsb2JhbCIsImxpc3RFbCIsImlzVHlwaW5nSW5MaXN0IiwiZm9jdXNJdGVtUm93Iiwicm93SWR4Iiwicm93IiwiZm9jdXNRdHlJbnB1dCIsImZvY3VzUHJpY2VJbnB1dCIsImhhbmRsZURvY0xpc3RLZXlEb3duIiwiaXNJbklucHV0IiwiY2xvc2VzdCIsInBhcnNlSW50IiwiaXNOYU4iLCJuZXh0SWR4IiwiTWF0aCIsIm1pbiIsImxhc3RJZHgiLCJwcmV2SWR4IiwibWF4IiwiaGFuZGxlUGlja1Byb2R1Y3QiLCJwIiwicG5PYmoiLCJwYXJ0X251bWJlcnMiLCJpc1B1cmNoIiwibmV3SXRlbSIsInNwZWNpZmljYXRpb25zIiwiX2Z1bGxfcHJvZHVjdCIsImlzUGlja2VyQWxsU2VsZWN0ZWQiLCJpc1BpY2tlclBhcnRpYWxseVNlbGVjdGVkIiwidG9nZ2xlUGlja2VyU2VsZWN0aW9uIiwicElkIiwidG9nZ2xlUGlja2VyU2VsZWN0QWxsIiwiaGFuZGxlUGlja1NlbGVjdGVkUHJvZHVjdHMiLCJzZWxlY3RlZFByb2R1Y3RzIiwiaGFuZGxlQ2xlYXJQaWNrZXIiLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJoYW5kbGVQaWNrZXJMaXN0S2V5RG93biIsImVuYWJsZWQiLCJzZWFyY2hFc2NhcGVHb2VzVG9SZXNldCIsImhhbmRsZVBpY2tlckZvcm1LZXlEb3duIiwiZGVmYXVsdFByZXZlbnRlZCIsImFjdGl2ZSIsImZpbHRlcmVkIiwicSIsImNtIiwicG4iLCJ5Iiwibm9ybWFsaXplIiwibWF0Y2hlZEJyYW5kUGhyYXNlcyIsInNob3J0aGFuZCIsImZ1bGxuYW1lIiwiYnJhbmRLZXl3b3JkcyIsImZvckVhY2giLCJhZGQiLCJicmFuZFRleHQiLCJqb2luIiwiQXJyYXkiLCJmcm9tIiwia2V5d29yZCIsInNsaWNlIiwibGlzdCIsImJhY2tncm91bmRDb2xvciIsIm1pbkhlaWdodCIsImRpc3BsYXkiLCJmbGV4RGlyZWN0aW9uIiwib3ZlcmZsb3ciLCJwYWRkaW5nIiwiYm9yZGVyQm90dG9tIiwiZmxleFNocmluayIsImp1c3RpZnlDb250ZW50IiwiYWxpZ25JdGVtcyIsIm1hcmdpbkJvdHRvbSIsImdhcCIsImJhY2tncm91bmQiLCJib3JkZXJSYWRpdXMiLCJmb250V2VpZ2h0IiwiZm9udFNpemUiLCJib3JkZXIiLCJjdXJzb3IiLCJncmlkVGVtcGxhdGVDb2x1bW5zIiwibGV0dGVyU3BhY2luZyIsInRhcmdldCIsIndpZHRoIiwic3VwIiwiY3VzdCIsImVtcCIsIm1hcmdpblRvcCIsImZsZXgiLCJvdmVyZmxvd1kiLCJvdmVyZmxvd1giLCJib3JkZXJDb2xsYXBzZSIsInRleHRBbGlnbiIsInRleHRUcmFuc2Zvcm0iLCJpZHgiLCJhc3NvY2lhdGVkUHJvZHVjdCIsIm1hcHBpbmdDb3VudCIsImRpc3BsYXlDYXJNb2RlbCIsImRpc3BsYXlZZWFyIiwiZGlzcGxheU5hbWUiLCJkaXNwbGF5U3BlYyIsImRpc3BsYXlCcmFuZCIsImV2IiwiY3VycmVudFRhcmdldCIsImZvbnRGYW1pbHkiLCJtdCIsInBhcnNlRmxvYXQiLCJ0cmFuc2l0aW9uIiwiYm9yZGVyVG9wIiwidG9GaXhlZCIsInBvc2l0aW9uIiwiaW5zZXQiLCJ6SW5kZXgiLCJmbGV4V3JhcCIsInBhZGRpbmdCb3R0b20iLCJzZWFyY2hSZXNldEJ0biIsImhlaWdodCIsIm1pbldpZHRoIiwid2hpdGVTcGFjZSIsInZhbCIsInRvcCIsImlzQWN0aXZlIiwiX2MiXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsiRG9jdW1lbnRFZGl0b3JQYWdlLmpzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgUmVhY3QsIHsgdXNlU3RhdGUsIHVzZUVmZmVjdCwgdXNlUmVmLCB1c2VNZW1vIH0gZnJvbSAncmVhY3QnO1xuaW1wb3J0IHsgdXNlU2VhcmNoUGFyYW1zIH0gZnJvbSAncmVhY3Qtcm91dGVyLWRvbSc7XG5pbXBvcnQgeyB1c2VEb2N1bWVudFN0b3JlIH0gZnJvbSAnLi4vLi4vc3RvcmUvdXNlRG9jdW1lbnRTdG9yZSc7XG5pbXBvcnQgeyB1c2VQcm9kdWN0U3RvcmUgfSBmcm9tICcuLi8uLi9zdG9yZS91c2VQcm9kdWN0U3RvcmUnO1xuaW1wb3J0IHsgdXNlU3VwcGxpZXJTdG9yZSB9IGZyb20gJy4uLy4uL3N0b3JlL3VzZVN1cHBsaWVyU3RvcmUnO1xuaW1wb3J0IHsgdXNlQ3VzdG9tZXJTdG9yZSB9IGZyb20gJy4uLy4uL3N0b3JlL3VzZUN1c3RvbWVyU3RvcmUnO1xuaW1wb3J0IHsgdXNlRW1wbG95ZWVTdG9yZSB9IGZyb20gJy4uLy4uL3N0b3JlL3VzZUVtcGxveWVlU3RvcmUnO1xuaW1wb3J0IHsgdXNlU2hvcnRoYW5kU3RvcmUgfSBmcm9tICcuLi8uLi9zdG9yZS91c2VTaG9ydGhhbmRTdG9yZSc7XG5pbXBvcnQgeyB1c2VBcHBTdG9yZSB9IGZyb20gJy4uLy4uL3N0b3JlL3VzZUFwcFN0b3JlJztcbmltcG9ydCB7IHVzZVRyYW5zbGF0aW9uIH0gZnJvbSAnLi4vLi4vaTE4bic7XG5pbXBvcnQgeyBjYW5FZGl0RG9jVHlwZSB9IGZyb20gJy4uLy4uL3V0aWxzL3Blcm1pc3Npb25zJztcbmltcG9ydCB7IFgsIFBsdXMsIFRyYXNoMiwgU2F2ZSwgRmlsZVRleHQsIFBhY2thZ2UsIFJvdGF0ZUNjdywgRWRpdDIsIFByaW50ZXIgfSBmcm9tICdsdWNpZGUtcmVhY3QnO1xuaW1wb3J0IEF1dG9jb21wbGV0ZUlucHV0IGZyb20gJy4uLy4uL2NvbXBvbmVudHMvQXV0b2NvbXBsZXRlSW5wdXQnO1xuaW1wb3J0IFBhcnRNYXBwaW5nTW9kYWwgZnJvbSAnLi4vUElNL1BhcnRNYXBwaW5nTW9kYWwnO1xuaW1wb3J0IERvY3VtZW50Vmlld2VyIGZyb20gJy4vRG9jdW1lbnRWaWV3ZXInO1xuaW1wb3J0IHsgdXNlU2VhcmNoRm9ybUtleWJvYXJkTmF2IH0gZnJvbSAnLi4vLi4vaG9va3MvdXNlU2VhcmNoRm9ybUtleWJvYXJkTmF2JztcbmltcG9ydCBEb2NQcm9kdWN0SGlzdG9yeURyYXdlciBmcm9tICcuLi8uLi9jb21wb25lbnRzL0RvY1Byb2R1Y3RIaXN0b3J5RHJhd2VyJztcbmltcG9ydCB7IGlzRWxlbWVudEluRG9jUGFydEVkaXRpbmdab25lIH0gZnJvbSAnLi4vLi4vdXRpbHMvZG9jSGlzdG9yeUZvY3VzWm9uZXMnO1xuaW1wb3J0IHsgc29ydGVkQ3VzdG9tZXJzRm9yU2VsZWN0LCBzb3J0ZWRTdXBwbGllcnNGb3JTZWxlY3QgfSBmcm9tICcuLi8uLi91dGlscy9zb3J0Q29udGFjdHNGb3JTZWxlY3QnO1xuaW1wb3J0IENvZGVMb29rdXBJbnB1dCBmcm9tICcuLi8uLi9jb21wb25lbnRzL0NvZGVMb29rdXBJbnB1dCc7XG5pbXBvcnQge1xuICAgIHByb2R1Y3RDYXJNb2RlbHNTZWFyY2hUZXh0LFxuICAgIHByb2R1Y3RQdXJjaGFzZVVuaXRQcmljZSxcbiAgICBwcm9kdWN0U2FsZXNVbml0UHJpY2UsXG4gICAgcHJvZHVjdExpbmVDYXJNb2RlbCxcbiAgICBwcm9kdWN0TGluZVllYXIsXG4gICAgcHJvZHVjdFllYXJTZWFyY2hCbG9iXG59IGZyb20gJy4uLy4uL3V0aWxzL3Byb2R1Y3RQaWNrZXJTeW5jJztcbmltcG9ydCBzdHlsZXMgZnJvbSAnLi9Eb2N1bWVudHMubW9kdWxlLmNzcyc7XG5cbmNvbnN0IERvY3VtZW50RWRpdG9yUGFnZSA9ICgpID0+IHtcbiAgICBjb25zdCBbc2VhcmNoUGFyYW1zXSA9IHVzZVNlYXJjaFBhcmFtcygpO1xuICAgIGNvbnN0IHsgdCwgbGFuZ3VhZ2UgfSA9IHVzZVRyYW5zbGF0aW9uKCk7XG4gICAgY29uc3QgeyBhZGREb2N1bWVudCwgdXBkYXRlRG9jdW1lbnQsIGRlbGV0ZURvY3VtZW50LCBpbnF1aXJpZXMsIHB1cmNoYXNlT3JkZXJzLCBxdW90YXRpb25zLCBzYWxlc09yZGVycywgc2FsZXNSZXR1cm5zLCBwdXJjaGFzZVJldHVybnMgfSA9IHVzZURvY3VtZW50U3RvcmUoKTtcbiAgICBjb25zdCB7IHByb2R1Y3RzIH0gPSB1c2VQcm9kdWN0U3RvcmUoKTtcbiAgICBjb25zdCB7IHN1cHBsaWVycyB9ID0gdXNlU3VwcGxpZXJTdG9yZSgpO1xuICAgIGNvbnN0IHsgY3VzdG9tZXJzIH0gPSB1c2VDdXN0b21lclN0b3JlKCk7XG4gICAgY29uc3QgeyBlbXBsb3llZXMgfSA9IHVzZUVtcGxveWVlU3RvcmUoKTtcbiAgICBjb25zdCB7IG1vZGVscywgcGFydHMsIGJyYW5kcyB9ID0gdXNlU2hvcnRoYW5kU3RvcmUoKTtcbiAgICBjb25zdCB7IGRlZmF1bHRDdXJyZW5jeSwgaXNNdWx0aUNvdW50cnlNb2RlLCBlbmFibGVMb2dpblN5c3RlbSwgZW5hYmxlUGVybWlzc2lvblJvbGUsIGN1cnJlbnRVc2VyRW1wSWQsIHZhdEVuYWJsZWQsIHZhdFJhdGUgfSA9IHVzZUFwcFN0b3JlKCk7XG5cbiAgICBjb25zdCB0eXBlID0gc2VhcmNoUGFyYW1zLmdldCgndHlwZScpIHx8ICdpbnF1aXJ5JztcbiAgICBjb25zdCBpZCA9IHNlYXJjaFBhcmFtcy5nZXQoJ2lkJyk7XG4gICAgY29uc3QgbW9kZSA9IHNlYXJjaFBhcmFtcy5nZXQoJ21vZGUnKTsgLy8gJ2ludGwnIGlmIGludGVybmF0aW9uYWxcbiAgICBjb25zdCBpc0VkaXQgPSAhIWlkO1xuICAgIGNvbnN0IGlzSW50bCA9IG1vZGUgPT09ICdpbnRsJztcbiAgICBjb25zdCBjdXN0b21lck9wdGlvbnMgPSB1c2VNZW1vKCgpID0+IHNvcnRlZEN1c3RvbWVyc0ZvclNlbGVjdChjdXN0b21lcnMpLCBbY3VzdG9tZXJzXSk7XG4gICAgY29uc3Qgc3VwcGxpZXJPcHRpb25zID0gdXNlTWVtbygoKSA9PiBzb3J0ZWRTdXBwbGllcnNGb3JTZWxlY3Qoc3VwcGxpZXJzKSwgW3N1cHBsaWVyc10pO1xuICAgIGNvbnN0IGRvY1R5cGVNZXRhID0ge1xuICAgICAgICBxdW90YXRpb246IHsgbGFiZWw6ICdcXHU1ODMxXFx1NTBmOVxcdTU1YWUnLCBjb2xvcjogJyMyNTYzZWInIH0sXG4gICAgICAgIHNhbGVzOiB7IGxhYmVsOiAnXFx1OTJiN1xcdThjYThcXHU1NWFlJywgY29sb3I6ICcjMTZhMzRhJyB9LFxuICAgICAgICBzYWxlc1JldHVybjogeyBsYWJlbDogJ1xcdTkyYjdcXHU5MDAwXFx1NTVhZScsIGNvbG9yOiAnIzBlYTVlOScgfSxcbiAgICAgICAgaW5xdWlyeTogeyBsYWJlbDogJ1xcdThhNjJcXHU1MGY5XFx1NTVhZScsIGNvbG9yOiAnIzhiNWNmNicgfSxcbiAgICAgICAgcHVyY2hhc2U6IHsgbGFiZWw6ICdcXHU2M2ExXFx1OGNmY1xcdTU1YWUnLCBjb2xvcjogJyNmNTllMGInIH0sXG4gICAgICAgIHB1cmNoYXNlUmV0dXJuOiB7IGxhYmVsOiAnXFx1OTAzMlxcdTkwMDBcXHU1NWFlJywgY29sb3I6ICcjZjk3MzE2JyB9LFxuICAgIH07XG4gICAgY29uc3QgZG9jVHlwZUxhYmVsS2V5TWFwID0ge1xuICAgICAgICBpbnF1aXJ5OiAnZG9jcy50YWJJbnF1aXJ5JyxcbiAgICAgICAgcHVyY2hhc2U6ICdkb2NzLnRhYlB1cmNoYXNlJyxcbiAgICAgICAgcXVvdGF0aW9uOiAnZG9jcy50YWJRdW90YXRpb24nLFxuICAgICAgICBzYWxlczogJ2RvY3MudGFiU2FsZXMnLFxuICAgICAgICBzYWxlc1JldHVybjogJ2RvY3MudGFiU2FsZXNSZXR1cm4nLFxuICAgICAgICBwdXJjaGFzZVJldHVybjogJ2RvY3MudGFiUHVyY2hhc2VSZXR1cm4nLFxuICAgIH07XG4gICAgY29uc3QgY3VycmVudERvY01ldGEgPSBkb2NUeXBlTWV0YVt0eXBlXSB8fCB7IGxhYmVsOiB0KGRvY1R5cGVMYWJlbEtleU1hcFt0eXBlXSB8fCAnZG9jcy50aXRsZScpLCBjb2xvcjogJyMzMzQxNTUnIH07XG5cbiAgICBjb25zdCBjdXJyZW50VXNlciA9IGVtcGxveWVlcy5maW5kKChlKSA9PiBlLmVtcF9pZCA9PT0gY3VycmVudFVzZXJFbXBJZCk7XG4gICAgY29uc3QgY2FuRWRpdFRoaXNEb2NUeXBlID0gY2FuRWRpdERvY1R5cGUoe1xuICAgICAgICBlbmFibGVMb2dpblN5c3RlbSxcbiAgICAgICAgZW5hYmxlUGVybWlzc2lvblJvbGUsXG4gICAgICAgIGN1cnJlbnRVc2VyLFxuICAgICAgICBkb2NUeXBlOiB0eXBlXG4gICAgfSk7XG4gICAgY29uc3QgW2lzUmVhZE9ubHksIHNldElzUmVhZE9ubHldID0gdXNlU3RhdGUoaXNFZGl0IHx8ICFjYW5FZGl0VGhpc0RvY1R5cGUpO1xuICAgIGNvbnN0IFtkb2MsIHNldERvY10gPSB1c2VTdGF0ZSh7XG4gICAgICAgIHR5cGU6IHR5cGUsXG4gICAgICAgIGRhdGU6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zcGxpdCgnVCcpWzBdLFxuICAgICAgICBzdGF0dXM6ICdwZW5kaW5nJyxcbiAgICAgICAgaXRlbXM6IFtdLFxuICAgICAgICBjdXJyZW5jeTogZGVmYXVsdEN1cnJlbmN5LFxuICAgICAgICBub3RlczogJycsXG4gICAgICAgIHN1cHBsaWVyX2lkOiAnJyxcbiAgICAgICAgc3VwcGxpZXJfbmFtZTogJycsXG4gICAgICAgIGN1c3RvbWVyX2lkOiAnJyxcbiAgICAgICAgY3VzdG9tZXJfbmFtZTogJycsXG4gICAgICAgIG9wZW5lcl9lbXBfaWQ6ICcnLFxuICAgICAgICBvcGVuZXJfZW1wX25hbWU6ICcnLFxuICAgICAgICBkaXNjb3VudDogMCxcbiAgICB9KTtcblxuICAgIC8vIFByb2R1Y3QgUGlja2VyIFN0YXRlXG4gICAgY29uc3QgW2lzUGlja2VyT3Blbiwgc2V0SXNQaWNrZXJPcGVuXSA9IHVzZVN0YXRlKGZhbHNlKTtcbiAgICBjb25zdCBbcGlja2VyUXVlcnksIHNldFBpY2tlclF1ZXJ5XSA9IHVzZVN0YXRlKHtcbiAgICAgICAgcGFydE51bWJlcjogJycsXG4gICAgICAgIG1vZGVsOiAnJyxcbiAgICAgICAgcGFydDogJycsXG4gICAgICAgIHNwZWM6ICcnLFxuICAgICAgICB5ZWFyOiAnJyxcbiAgICAgICAgYnJhbmQ6ICcnXG4gICAgfSk7XG4gICAgY29uc3QgW3BpY2tlclJlc3VsdHMsIHNldFBpY2tlclJlc3VsdHNdID0gdXNlU3RhdGUoW10pO1xuICAgIC8qKiDnrKblkIjnr6npgbjnmoTnuL3nrYbmlbjvvIjliJfooajlm6DmlYjog73mnIDlpJrpoa/npLogNTAg562G77yJICovXG4gICAgY29uc3QgW3BpY2tlck1hdGNoVG90YWwsIHNldFBpY2tlck1hdGNoVG90YWxdID0gdXNlU3RhdGUoMCk7XG4gICAgY29uc3QgW3NlbGVjdGVkUGlja2VyUHJvZHVjdElkcywgc2V0U2VsZWN0ZWRQaWNrZXJQcm9kdWN0SWRzXSA9IHVzZVN0YXRlKFtdKTtcbiAgICBjb25zdCBbbWFwcGluZ1Byb2R1Y3QsIHNldE1hcHBpbmdQcm9kdWN0XSA9IHVzZVN0YXRlKG51bGwpO1xuICAgIGNvbnN0IFtpc1ZpZXdlck9wZW4sIHNldElzVmlld2VyT3Blbl0gPSB1c2VTdGF0ZShmYWxzZSk7XG4gICAgY29uc3QgW2ZvY3VzZWRIZWFkZXJBY3Rpb24sIHNldEZvY3VzZWRIZWFkZXJBY3Rpb25dID0gdXNlU3RhdGUoJycpO1xuICAgIGNvbnN0IHBpY2tlckZpcnN0SW5wdXRSZWYgPSB1c2VSZWYobnVsbCk7XG4gICAgY29uc3QgcGlja2VyRm9ybVJlZiA9IHVzZVJlZihudWxsKTtcbiAgICBjb25zdCBwaWNrZXJSZXNldEJ0blJlZiA9IHVzZVJlZihudWxsKTtcbiAgICBjb25zdCBwaWNrZXJMaXN0UmVmID0gdXNlUmVmKG51bGwpO1xuICAgIGNvbnN0IFthY3RpdmVQaWNrZXJSb3dJbmRleCwgc2V0QWN0aXZlUGlja2VyUm93SW5kZXhdID0gdXNlU3RhdGUoMCk7XG4gICAgY29uc3QgcGlja2VyVGJvZHlSZWYgPSB1c2VSZWYobnVsbCk7XG4gICAgY29uc3QgcHJpbnRCdG5SZWYgPSB1c2VSZWYobnVsbCk7XG4gICAgY29uc3QgZWRpdEJ0blJlZiA9IHVzZVJlZihudWxsKTtcbiAgICBjb25zdCBzYXZlQnRuUmVmID0gdXNlUmVmKG51bGwpO1xuICAgIGNvbnN0IGNsb3NlQnRuUmVmID0gdXNlUmVmKG51bGwpO1xuICAgIGNvbnN0IHNlbGVjdEFsbFJlZiA9IHVzZVJlZihudWxsKTtcbiAgICBjb25zdCBwaWNrZXJTZWxlY3RBbGxSZWYgPSB1c2VSZWYobnVsbCk7XG4gICAgY29uc3QgYWRkUGFydEJ0blJlZiA9IHVzZVJlZihudWxsKTtcbiAgICBjb25zdCBbc2VsZWN0ZWRJbmRleGVzLCBzZXRTZWxlY3RlZEluZGV4ZXNdID0gdXNlU3RhdGUoW10pO1xuICAgIGNvbnN0IFthY3RpdmVJdGVtSW5kZXgsIHNldEFjdGl2ZUl0ZW1JbmRleF0gPSB1c2VTdGF0ZSgwKTtcbiAgICBjb25zdCBbaGlzdG9yeURyYXdlck9wZW4sIHNldEhpc3RvcnlEcmF3ZXJPcGVuXSA9IHVzZVN0YXRlKGZhbHNlKTtcbiAgICBjb25zdCBbaXNBZGRQYXJ0Rm9jdXNlZCwgc2V0SXNBZGRQYXJ0Rm9jdXNlZF0gPSB1c2VTdGF0ZShmYWxzZSk7XG4gICAgY29uc3QgaXRlbVRib2R5UmVmID0gdXNlUmVmKG51bGwpO1xuICAgIGNvbnN0IGRvY0xpc3RLZXlib2FyZFJlZiA9IHVzZVJlZihudWxsKTtcbiAgICBjb25zdCBzZXRQcm9kdWN0SGlzdG9yeUZvY3VzUElkID0gdXNlQXBwU3RvcmUoKHMpID0+IHMuc2V0UHJvZHVjdEhpc3RvcnlGb2N1c1BJZCk7XG5cbiAgICBjb25zdCBkb2NIaXN0b3J5Rm9jdXNQSWQgPSB1c2VNZW1vKCgpID0+IHtcbiAgICAgICAgaWYgKGlzUGlja2VyT3BlbiAmJiBwaWNrZXJSZXN1bHRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHJldHVybiBwaWNrZXJSZXN1bHRzW2FjdGl2ZVBpY2tlclJvd0luZGV4XT8ucF9pZCB8fCBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGlmIChkb2M/Lml0ZW1zPy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNvbnN0IGl0ZW0gPSBkb2MuaXRlbXNbYWN0aXZlSXRlbUluZGV4XTtcbiAgICAgICAgICAgIHJldHVybiBpdGVtPy5wX2lkICYmIFN0cmluZyhpdGVtLnBfaWQpLnRyaW0oKSA/IGl0ZW0ucF9pZCA6IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSwgW1xuICAgICAgICBpc1BpY2tlck9wZW4sXG4gICAgICAgIHBpY2tlclJlc3VsdHMubGVuZ3RoLFxuICAgICAgICBhY3RpdmVQaWNrZXJSb3dJbmRleCxcbiAgICAgICAgcGlja2VyUmVzdWx0c1thY3RpdmVQaWNrZXJSb3dJbmRleF0/LnBfaWQsXG4gICAgICAgIGRvYz8uaXRlbXM/Lmxlbmd0aCxcbiAgICAgICAgYWN0aXZlSXRlbUluZGV4LFxuICAgICAgICBkb2M/Lml0ZW1zPy5bYWN0aXZlSXRlbUluZGV4XT8ucF9pZCxcbiAgICBdKTtcblxuICAgIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgICAgIHNldFByb2R1Y3RIaXN0b3J5Rm9jdXNQSWQoZG9jSGlzdG9yeUZvY3VzUElkKTtcbiAgICB9LCBbZG9jSGlzdG9yeUZvY3VzUElkLCBzZXRQcm9kdWN0SGlzdG9yeUZvY3VzUElkXSk7XG5cbiAgICB1c2VFZmZlY3QoKCkgPT4gKCkgPT4gc2V0UHJvZHVjdEhpc3RvcnlGb2N1c1BJZChudWxsKSwgW3NldFByb2R1Y3RIaXN0b3J5Rm9jdXNQSWRdKTtcblxuICAgIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgICAgIGNvbnN0IG9uS2V5ID0gKGUpID0+IHtcbiAgICAgICAgICAgIGlmIChlLnJlcGVhdCB8fCBlLmNvZGUgIT09ICdGOCcpIHJldHVybjtcbiAgICAgICAgICAgIGlmICghaXNFbGVtZW50SW5Eb2NQYXJ0RWRpdGluZ1pvbmUoZG9jdW1lbnQuYWN0aXZlRWxlbWVudCkpIHJldHVybjtcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIHNldEhpc3RvcnlEcmF3ZXJPcGVuKCh2KSA9PiAhdik7XG4gICAgICAgIH07XG4gICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgb25LZXksIHRydWUpO1xuICAgICAgICByZXR1cm4gKCkgPT4gd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBvbktleSwgdHJ1ZSk7XG4gICAgfSwgW10pO1xuXG4gICAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICAgICAgc2V0SGlzdG9yeURyYXdlck9wZW4oZmFsc2UpO1xuICAgIH0sIFtpc1BpY2tlck9wZW5dKTtcblxuICAgIC8vXG4gICAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICAgICAgaWYgKCFpc0VkaXQpIHJldHVybjtcbiAgICAgICAgY29uc3Qgc3RhdGUgPSB1c2VEb2N1bWVudFN0b3JlLmdldFN0YXRlKCk7XG4gICAgICAgIGxldCBleGlzdGluZ0RvYyA9IG51bGw7XG4gICAgICAgIGlmICh0eXBlID09PSAnaW5xdWlyeScpIGV4aXN0aW5nRG9jID0gKHN0YXRlLmlucXVpcmllcyB8fCBbXSkuZmluZChkID0+IGQuZG9jX2lkID09PSBpZCk7XG4gICAgICAgIGVsc2UgaWYgKHR5cGUgPT09ICdwdXJjaGFzZScpIGV4aXN0aW5nRG9jID0gKHN0YXRlLnB1cmNoYXNlT3JkZXJzIHx8IFtdKS5maW5kKGQgPT4gZC5kb2NfaWQgPT09IGlkKTtcbiAgICAgICAgZWxzZSBpZiAodHlwZSA9PT0gJ3F1b3RhdGlvbicpIGV4aXN0aW5nRG9jID0gKHN0YXRlLnF1b3RhdGlvbnMgfHwgW10pLmZpbmQoZCA9PiBkLmRvY19pZCA9PT0gaWQpO1xuICAgICAgICBlbHNlIGlmICh0eXBlID09PSAnc2FsZXMnKSBleGlzdGluZ0RvYyA9IChzdGF0ZS5zYWxlc09yZGVycyB8fCBbXSkuZmluZChkID0+IGQuZG9jX2lkID09PSBpZCk7XG4gICAgICAgIGVsc2UgaWYgKHR5cGUgPT09ICdzYWxlc1JldHVybicpIGV4aXN0aW5nRG9jID0gKHN0YXRlLnNhbGVzUmV0dXJucyB8fCBbXSkuZmluZChkID0+IGQuZG9jX2lkID09PSBpZCk7XG4gICAgICAgIGVsc2UgaWYgKHR5cGUgPT09ICdwdXJjaGFzZVJldHVybicpIGV4aXN0aW5nRG9jID0gKHN0YXRlLnB1cmNoYXNlUmV0dXJucyB8fCBbXSkuZmluZChkID0+IGQuZG9jX2lkID09PSBpZCk7XG5cbiAgICAgICAgaWYgKGV4aXN0aW5nRG9jKSB7XG4gICAgICAgICAgICBsZXQgdXBkYXRlZERvYyA9IHsgLi4uZXhpc3RpbmdEb2MgfTtcbiAgICAgICAgICAgIHVwZGF0ZWREb2MuaXRlbXMgPSB1cGRhdGVkRG9jLml0ZW1zIHx8IFtdO1xuICAgICAgICAgICAgaWYgKCF1cGRhdGVkRG9jLnN1cHBsaWVyX25hbWUgJiYgdXBkYXRlZERvYy5zdXBwbGllcl9pZCkge1xuICAgICAgICAgICAgICAgIHVwZGF0ZWREb2Muc3VwcGxpZXJfbmFtZSA9IHN1cHBsaWVyT3B0aW9ucy5maW5kKHMgPT4gcy5zdXBfaWQgPT09IHVwZGF0ZWREb2Muc3VwcGxpZXJfaWQpPy5uYW1lIHx8ICcnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCF1cGRhdGVkRG9jLmN1c3RvbWVyX25hbWUgJiYgdXBkYXRlZERvYy5jdXN0b21lcl9pZCkge1xuICAgICAgICAgICAgICAgIHVwZGF0ZWREb2MuY3VzdG9tZXJfbmFtZSA9IGN1c3RvbWVyT3B0aW9ucy5maW5kKGMgPT4gYy5jdXN0X2lkID09PSB1cGRhdGVkRG9jLmN1c3RvbWVyX2lkKT8ubmFtZSB8fCAnJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNldERvYyh1cGRhdGVkRG9jKTtcbiAgICAgICAgfVxuICAgIH0sIFtpc0VkaXQsIGlkLCB0eXBlLCBjdXN0b21lck9wdGlvbnMsIHN1cHBsaWVyT3B0aW9uc10pO1xuXG4gICAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICAgICAgaWYgKCFpc0VkaXQgJiYgY3VycmVudFVzZXIgJiYgKCFkb2Mub3BlbmVyX2VtcF9pZCB8fCAhZG9jLm9wZW5lcl9lbXBfbmFtZSkpIHtcbiAgICAgICAgICAgIHNldERvYygocHJldikgPT4gKHtcbiAgICAgICAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgICAgICAgIG9wZW5lcl9lbXBfaWQ6IGN1cnJlbnRVc2VyLmVtcF9pZCxcbiAgICAgICAgICAgICAgICBvcGVuZXJfZW1wX25hbWU6IGN1cnJlbnRVc2VyLm5hbWVcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuICAgIH0sIFtpc0VkaXQsIGN1cnJlbnRVc2VyLCBkb2Mub3BlbmVyX2VtcF9pZCwgZG9jLm9wZW5lcl9lbXBfbmFtZV0pO1xuXG4gICAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICAgICAgLy8gT25seSByZXNldCByZWFkLW9ubHkgbW9kZSB3aGVuIHN3aXRjaGluZyBkb2N1bWVudC9yb3V0ZSxcbiAgICAgICAgLy8gc28gbWFudWFsIFwiZWRpdCBtb2RlXCIgaXMgbm90IGFjY2lkZW50YWxseSByZXZlcnRlZC5cbiAgICAgICAgaWYgKCFjYW5FZGl0VGhpc0RvY1R5cGUpIHtcbiAgICAgICAgICAgIHNldElzUmVhZE9ubHkodHJ1ZSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgc2V0SXNSZWFkT25seShpc0VkaXQpO1xuICAgIH0sIFtpc0VkaXQsIGlkLCB0eXBlLCBjYW5FZGl0VGhpc0RvY1R5cGVdKTtcblxuICAgIC8vXG4gICAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICAgICAgaWYgKCFpc1JlYWRPbmx5IHx8ICFjYW5FZGl0VGhpc0RvY1R5cGUgfHwgIWVkaXRCdG5SZWYuY3VycmVudCkgcmV0dXJuO1xuICAgICAgICBjb25zdCBmb2N1c0VkaXQgPSAoKSA9PiBlZGl0QnRuUmVmLmN1cnJlbnQ/LmZvY3VzKCk7XG4gICAgICAgIGZvY3VzRWRpdCgpO1xuICAgICAgICBjb25zdCB0MSA9IHNldFRpbWVvdXQoZm9jdXNFZGl0LCAxMDApO1xuICAgICAgICBjb25zdCB0MiA9IHNldFRpbWVvdXQoZm9jdXNFZGl0LCAzMDApO1xuICAgICAgICBjb25zdCB0MyA9IHNldFRpbWVvdXQoZm9jdXNFZGl0LCA1MDApO1xuICAgICAgICByZXR1cm4gKCkgPT4geyBjbGVhclRpbWVvdXQodDEpOyBjbGVhclRpbWVvdXQodDIpOyBjbGVhclRpbWVvdXQodDMpOyB9O1xuICAgIH0sIFtpc1JlYWRPbmx5LCBjYW5FZGl0VGhpc0RvY1R5cGVdKTtcblxuICAgIC8vXG4gICAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICAgICAgaWYgKGlzUmVhZE9ubHkpIHJldHVybjtcbiAgICAgICAgaWYgKGRvYy5pdGVtcy5sZW5ndGggPiAwICYmIGRvY0xpc3RLZXlib2FyZFJlZi5jdXJyZW50KSB7XG4gICAgICAgICAgICBzZXRBY3RpdmVJdGVtSW5kZXgoMCk7XG4gICAgICAgICAgICBjb25zdCBmb2N1c0xpc3QgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgZmlyc3RSb3cgPSBpdGVtVGJvZHlSZWYuY3VycmVudD8ucXVlcnlTZWxlY3RvcignW2RhdGEtZG9jLWl0ZW0tcm93LWlkeD1cIjBcIl0nKTtcbiAgICAgICAgICAgICAgICBpZiAoZmlyc3RSb3cpIHtcbiAgICAgICAgICAgICAgICAgICAgZmlyc3RSb3cuZm9jdXMoKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBkb2NMaXN0S2V5Ym9hcmRSZWYuY3VycmVudD8uZm9jdXMoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc2V0QWN0aXZlSXRlbUluZGV4KDApO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGZvY3VzTGlzdCgpO1xuICAgICAgICAgICAgY29uc3QgdDEgPSBzZXRUaW1lb3V0KGZvY3VzTGlzdCwgMTAwKTtcbiAgICAgICAgICAgIGNvbnN0IHQyID0gc2V0VGltZW91dChmb2N1c0xpc3QsIDMwMCk7XG4gICAgICAgICAgICBjb25zdCB0MyA9IHNldFRpbWVvdXQoZm9jdXNMaXN0LCA1MDApO1xuICAgICAgICAgICAgcmV0dXJuICgpID0+IHsgY2xlYXJUaW1lb3V0KHQxKTsgY2xlYXJUaW1lb3V0KHQyKTsgY2xlYXJUaW1lb3V0KHQzKTsgfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXNhdmVCdG5SZWYuY3VycmVudCkgcmV0dXJuO1xuICAgICAgICBjb25zdCBmb2N1c1NhdmUgPSAoKSA9PiBzYXZlQnRuUmVmLmN1cnJlbnQ/LmZvY3VzKCk7XG4gICAgICAgIGZvY3VzU2F2ZSgpO1xuICAgICAgICBjb25zdCB0MSA9IHNldFRpbWVvdXQoZm9jdXNTYXZlLCAxMDApO1xuICAgICAgICBjb25zdCB0MiA9IHNldFRpbWVvdXQoZm9jdXNTYXZlLCAzMDApO1xuICAgICAgICBjb25zdCB0MyA9IHNldFRpbWVvdXQoZm9jdXNTYXZlLCA1MDApO1xuICAgICAgICByZXR1cm4gKCkgPT4geyBjbGVhclRpbWVvdXQodDEpOyBjbGVhclRpbWVvdXQodDIpOyBjbGVhclRpbWVvdXQodDMpOyB9O1xuICAgIH0sIFtpc1JlYWRPbmx5LCBkb2MuaXRlbXMubGVuZ3RoXSk7XG5cbiAgICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgICAgICBpZiAoIWVuYWJsZUxvZ2luU3lzdGVtICYmICFpc0VkaXQgJiYgIWRvYy5vcGVuZXJfZW1wX2lkICYmIGVtcGxveWVlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBzZXREb2MoKHByZXYpID0+ICh7XG4gICAgICAgICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICAgICAgICBvcGVuZXJfZW1wX2lkOiBlbXBsb3llZXNbMF0uZW1wX2lkLFxuICAgICAgICAgICAgICAgIG9wZW5lcl9lbXBfbmFtZTogZW1wbG95ZWVzWzBdLm5hbWUsXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cbiAgICB9LCBbZW5hYmxlTG9naW5TeXN0ZW0sIGlzRWRpdCwgZG9jLm9wZW5lcl9lbXBfaWQsIGVtcGxveWVlc10pO1xuXG4gICAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICAgICAgaWYgKGlzUGlja2VyT3BlbiAmJiBwaWNrZXJSZXNldEJ0blJlZi5jdXJyZW50KSB7XG4gICAgICAgICAgICBjb25zdCB0ID0gc2V0VGltZW91dCgoKSA9PiBwaWNrZXJSZXNldEJ0blJlZi5jdXJyZW50Py5mb2N1cygpLCAxMDApO1xuICAgICAgICAgICAgcmV0dXJuICgpID0+IGNsZWFyVGltZW91dCh0KTtcbiAgICAgICAgfVxuICAgIH0sIFtpc1BpY2tlck9wZW5dKTtcblxuICAgIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgICAgIGlmICghaXNQaWNrZXJPcGVuKSBzZXRTZWxlY3RlZFBpY2tlclByb2R1Y3RJZHMoW10pO1xuICAgIH0sIFtpc1BpY2tlck9wZW5dKTtcblxuICAgIC8vXG4gICAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICAgICAgaWYgKCFpc1BpY2tlck9wZW4pIHJldHVybjtcbiAgICAgICAgY29uc3QgaGFuZGxlRXNjID0gKGUpID0+IHtcbiAgICAgICAgICAgIGlmIChlLmtleSA9PT0gJ0VzY2FwZScpIHtcbiAgICAgICAgICAgICAgICBpZiAocGlja2VyRm9ybVJlZi5jdXJyZW50Py5jb250YWlucyhkb2N1bWVudC5hY3RpdmVFbGVtZW50KSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICBzZXRJc1BpY2tlck9wZW4oZmFsc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgaGFuZGxlRXNjKTtcbiAgICAgICAgcmV0dXJuICgpID0+IGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBoYW5kbGVFc2MpO1xuICAgIH0sIFtpc1BpY2tlck9wZW5dKTtcblxuICAgIC8vXG4gICAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICAgICAgaWYgKGlzUGlja2VyT3BlbiB8fCBpc1ZpZXdlck9wZW4gfHwgaXNSZWFkT25seSB8fCAhc2F2ZUJ0blJlZi5jdXJyZW50KSByZXR1cm47XG4gICAgICAgIGNvbnN0IGhhbmRsZUVzYyA9IChlKSA9PiB7XG4gICAgICAgICAgICBpZiAoZS5rZXkgPT09ICdFc2NhcGUnKSB7XG4gICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgIHNhdmVCdG5SZWYuY3VycmVudD8uZm9jdXMoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGhhbmRsZUVzYyk7XG4gICAgICAgIHJldHVybiAoKSA9PiBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdrZXlkb3duJywgaGFuZGxlRXNjKTtcbiAgICB9LCBbaXNQaWNrZXJPcGVuLCBpc1ZpZXdlck9wZW4sIGlzUmVhZE9ubHldKTtcblxuICAgIGNvbnN0IGlzU3VwcGxpZXIgPSB0eXBlID09PSAnaW5xdWlyeScgfHwgdHlwZSA9PT0gJ3B1cmNoYXNlJyB8fCB0eXBlID09PSAncHVyY2hhc2VSZXR1cm4nO1xuICAgIGNvbnN0IGlzQ3VzdG9tZXIgPSB0eXBlID09PSAncXVvdGF0aW9uJyB8fCB0eXBlID09PSAnc2FsZXMnIHx8IHR5cGUgPT09ICdzYWxlc1JldHVybic7XG4gICAgY29uc3QgZm9ybWF0QW1vdW50ID0gKHZhbHVlKSA9PiBOdW1iZXIodmFsdWUgfHwgMCkudG9Mb2NhbGVTdHJpbmcodW5kZWZpbmVkLCB7IG1pbmltdW1GcmFjdGlvbkRpZ2l0czogMiwgbWF4aW11bUZyYWN0aW9uRGlnaXRzOiAyIH0pO1xuICAgIGNvbnN0IHN1YnRvdGFsID0gZG9jLml0ZW1zLnJlZHVjZSgoc3VtLCBpdGVtKSA9PiBzdW0gKyAoKGl0ZW0ucXR5IHx8IDApICogKGl0ZW0udW5pdF9wcmljZSB8fCAwKSksIDApO1xuICAgIGNvbnN0IHZhdEFtb3VudCA9IHZhdEVuYWJsZWQgPyBzdWJ0b3RhbCAqICgoTnVtYmVyKHZhdFJhdGUpIHx8IDApIC8gMTAwKSA6IDA7XG4gICAgY29uc3QgZ3JhbmRUb3RhbCA9IHN1YnRvdGFsICsgdmF0QW1vdW50O1xuXG4gICAgLy8gQ3VycmVuY3kgTG9jayBSdWxlczpcbiAgICAvLyAxLiBJbnF1aXJ5L1B1cmNoYXNlIChCdXlpbmcpIC0+IExvY2sgdG8gZGVmYXVsdCBjdXJyZW5jeSBPTkxZIElGIE5PVCBpbiBpbnRlcm5hdGlvbmFsIG1vZGVcbiAgICAvLyAyLiBRdW90YXRpb24vU2FsZXMgKFNlbGxpbmcpIC0+IExvY2sgdG8gZGVmYXVsdCBjdXJyZW5jeSBPTkxZIElGIE5PVCBpbiBtdWx0aS1jb3VudHJ5IG1vZGVcbiAgICBjb25zdCBpc0N1cnJlbmN5TG9ja2VkID0gKGlzU3VwcGxpZXIgJiYgIWlzSW50bCkgfHwgKGlzQ3VzdG9tZXIgJiYgIWlzTXVsdGlDb3VudHJ5TW9kZSk7XG5cbiAgICAvLyBTeW5jIGN1cnJlbmN5IGlmIGxvY2tlZFxuICAgIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgICAgIGlmIChpc0N1cnJlbmN5TG9ja2VkICYmIGRvYy5jdXJyZW5jeSAhPT0gZGVmYXVsdEN1cnJlbmN5KSB7XG4gICAgICAgICAgICBzZXREb2MocHJldiA9PiAoeyAuLi5wcmV2LCBjdXJyZW5jeTogZGVmYXVsdEN1cnJlbmN5IH0pKTtcbiAgICAgICAgfVxuICAgIH0sIFtpc0N1cnJlbmN5TG9ja2VkLCBkZWZhdWx0Q3VycmVuY3ksIGRvYy5jdXJyZW5jeV0pO1xuXG4gICAgY29uc3QgaGFuZGxlU2F2ZSA9ICgpID0+IHtcbiAgICAgICAgaWYgKCFjYW5FZGl0VGhpc0RvY1R5cGUpIHtcbiAgICAgICAgICAgIGFsZXJ0KCdcXHU2MGE4XFx1NmM5MlxcdTY3MDlcXHU2YjBhXFx1OTY1MFxcdTdkZThcXHU4ZjJmXFx1NmI2NFxcdTU1YWVcXHU2NGRhXFx1MzAwMicpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGxldCBzYXZlZERvYztcbiAgICAgICAgaWYgKGlzRWRpdCkge1xuICAgICAgICAgICAgc2F2ZWREb2MgPSB1cGRhdGVEb2N1bWVudCh0eXBlLCBkb2MpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2F2ZWREb2MgPSBhZGREb2N1bWVudCh0eXBlLCBkb2MpO1xuICAgICAgICAgICAgLy8gVXBkYXRlIFVSTCBzbyBzdWJzZXF1ZW50IHNhdmVzIHdvcmsgYXMgdXBkYXRlc1xuICAgICAgICAgICAgY29uc3QgdXJsID0gbmV3IFVSTCh3aW5kb3cubG9jYXRpb24pO1xuICAgICAgICAgICAgdXJsLnNlYXJjaFBhcmFtcy5zZXQoJ2lkJywgc2F2ZWREb2MuZG9jX2lkKTtcbiAgICAgICAgICAgIHdpbmRvdy5oaXN0b3J5LnJlcGxhY2VTdGF0ZSh7fSwgJycsIHVybCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTaWduYWwgdGhlIG1haW4gd2luZG93IHRvIHN3aXRjaCB0byB0aGlzIHRhYiBvZiB0aGUgaHViXG4gICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdlcnAtbGFzdC1kb2MtdHlwZScsIHR5cGUpO1xuICAgICAgICBzZXREb2Moc2F2ZWREb2MpO1xuICAgICAgICBzZXRJc1JlYWRPbmx5KHRydWUpOyAvLyBTd2l0Y2ggYmFjayB0byB2aWV3IG1vZGUgYWZ0ZXIgc2F2ZVxuICAgIH07XG5cbiAgICBjb25zdCBoYW5kbGVDbG9zZSA9ICgpID0+IHtcbiAgICAgICAgY29uc3QgdGFyZ2V0RG9jSWQgPSBkb2MuZG9jX2lkIHx8IGlkO1xuICAgICAgICBpZiAodGFyZ2V0RG9jSWQgJiYgKGRvYy5pdGVtcyB8fCBbXSkubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICBjb25zdCBzaG91bGREZWxldGUgPSB3aW5kb3cuY29uZmlybSgnXFx1NmI2NFxcdTU1YWVcXHU2NGRhXFx1NzZlZVxcdTUyNGRcXHU2YzkyXFx1NjcwOVxcdTU0YzFcXHU5ODA1XFx1ZmYwY1xcdTY2MmZcXHU1NDI2XFx1NTIyYVxcdTk2NjRcXHU1ZjhjXFx1OTZlMlxcdTk1OGJcXHVmZjFmJyk7XG4gICAgICAgICAgICBpZiAoc2hvdWxkRGVsZXRlKSB7XG4gICAgICAgICAgICAgICAgZGVsZXRlRG9jdW1lbnQodHlwZSwgdGFyZ2V0RG9jSWQpO1xuICAgICAgICAgICAgICAgIC8vIEZhbGxiYWNrIHJldHJ5IGluIGNhc2UgdGhlIHRhYiBjbG9zZXMgYmVmb3JlIHBlcnNpc3RlbmNlIHNldHRsZXMuXG4gICAgICAgICAgICAgICAgY29uc3Qgc3RhdGUgPSB1c2VEb2N1bWVudFN0b3JlLmdldFN0YXRlKCk7XG4gICAgICAgICAgICAgICAgY29uc3QgZ2V0TGlzdEJ5VHlwZSA9IChkb2NUeXBlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkb2NUeXBlID09PSAnaW5xdWlyeScpIHJldHVybiBzdGF0ZS5pbnF1aXJpZXMgfHwgW107XG4gICAgICAgICAgICAgICAgICAgIGlmIChkb2NUeXBlID09PSAncHVyY2hhc2UnKSByZXR1cm4gc3RhdGUucHVyY2hhc2VPcmRlcnMgfHwgW107XG4gICAgICAgICAgICAgICAgICAgIGlmIChkb2NUeXBlID09PSAncXVvdGF0aW9uJykgcmV0dXJuIHN0YXRlLnF1b3RhdGlvbnMgfHwgW107XG4gICAgICAgICAgICAgICAgICAgIGlmIChkb2NUeXBlID09PSAnc2FsZXMnKSByZXR1cm4gc3RhdGUuc2FsZXNPcmRlcnMgfHwgW107XG4gICAgICAgICAgICAgICAgICAgIGlmIChkb2NUeXBlID09PSAnc2FsZXNSZXR1cm4nKSByZXR1cm4gc3RhdGUuc2FsZXNSZXR1cm5zIHx8IFtdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZG9jVHlwZSA9PT0gJ3B1cmNoYXNlUmV0dXJuJykgcmV0dXJuIHN0YXRlLnB1cmNoYXNlUmV0dXJucyB8fCBbXTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgY29uc3Qgc3RpbGxFeGlzdHMgPSBnZXRMaXN0QnlUeXBlKHR5cGUpLnNvbWUoKGQpID0+IGQuZG9jX2lkID09PSB0YXJnZXREb2NJZCk7XG4gICAgICAgICAgICAgICAgaWYgKHN0aWxsRXhpc3RzKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXRlLmRlbGV0ZURvY3VtZW50KHR5cGUsIHRhcmdldERvY0lkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyDlm57liLDliJfooajmmYLkv53nlZkgc3RhbmRhbG9uZSDnrYnmn6XoqaLlj4PmlbjvvIjoiIfoo73llq7liJfooajplovllZ/kvobmupDkuIDoh7TvvIlcbiAgICAgICAgbGV0IGZhbGxiYWNrVXJsID0gYC9kb2N1bWVudHM/dGFiPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHR5cGUpfWA7XG4gICAgICAgIGxldCByZXR1cm5Gcm9tSHViID0gZmFsc2U7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXQgPSBzZXNzaW9uU3RvcmFnZS5nZXRJdGVtKCdlcnAtZG9jLWh1Yi1yZXR1cm4nKTtcbiAgICAgICAgICAgIGlmIChyZXQgJiYgcmV0LnN0YXJ0c1dpdGgoJy9kb2N1bWVudHMnKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHUgPSBuZXcgVVJMKHJldCwgd2luZG93LmxvY2F0aW9uLm9yaWdpbik7XG4gICAgICAgICAgICAgICAgdS5zZWFyY2hQYXJhbXMuc2V0KCd0YWInLCB0eXBlKTtcbiAgICAgICAgICAgICAgICBmYWxsYmFja1VybCA9IGAke3UucGF0aG5hbWV9PyR7dS5zZWFyY2hQYXJhbXMudG9TdHJpbmcoKX1gO1xuICAgICAgICAgICAgICAgIHJldHVybkZyb21IdWIgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHNlc3Npb25TdG9yYWdlLnJlbW92ZUl0ZW0oJ2VycC1kb2MtaHViLXJldHVybicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIC8qIGlnbm9yZSAqL1xuICAgICAgICB9XG5cbiAgICAgICAgLy8g5L+u5b6pIENPT1AgKENyb3NzLU9yaWdpbi1PcGVuZXItUG9saWN5KSDlsI7oh7Qgd2luZG93LmNsb3NlZC9vcGVuZXIuY2xvc2VkIOiiq+mYu+aTi+eahOWVj+mhjFxuICAgICAgICAvLyDmlLnnlKjlronlhajmgKfovIPpq5jkuJTkuI3kvp3os7Tot6joppbnqpflsazmgKfnmoTmqqLmuKzmlrnms5VcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIOWPquimgSBvcGVuZXIg5a2Y5ZyoICjljbPkvb/kuI3lj6/lrZjlj5blhbblsazmgKcp77yM6YCa5bi45Luj6KGo5a6D5piv6KKrIHdpbmRvdy5vcGVuIOmWi+WVn+eahOWIhumggVxuICAgICAgICAgICAgbGV0IGlzUG9wdXAgPSBmYWxzZTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgaXNQb3B1cCA9ICEhKHdpbmRvdy5vcGVuZXIgJiYgd2luZG93Lm9wZW5lciAhPT0gd2luZG93KTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAvLyDlpoLmnpzlrZjlj5Ygb3BlbmVyIOWgsemMr++8jOmAmuW4uOaYr+WboOeCuiBDT09QIOmalOmbou+8jOS7o+ihqOWug+W/heWumuaYr+S4gOWAi+W9iOWHuuimlueql1xuICAgICAgICAgICAgICAgIGlzUG9wdXAgPSB0cnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoaXNQb3B1cCkge1xuICAgICAgICAgICAgICAgIHdpbmRvdy5jbG9zZSgpO1xuICAgICAgICAgICAgICAgIC8vIOWmguaenCBjbG9zZSgpIOaIkOWKn++8jOmggemdouacg+mXnOmWie+8m+WmguaenOWkseaVlyAo5aaC6Z2e6IWz5pys6ZaL5ZWfKe+8jOWJh+i2heaZguW+jOWft+ihjCBmYWxsYmFjayDph43lsI7lkJFcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGlzU3RpbGxPcGVuID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIOWcqOafkOS6m+alteerryBDT09QIOioreWumuS4i++8jHNlbGYuY2xvc2VkIOS5n+WPr+iDveWPl+mZkO+8jOaVheWKoCB0cnktY2F0Y2hcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzU3RpbGxPcGVuID0gIXdpbmRvdy5jbG9zZWQ7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzU3RpbGxPcGVuID0gdHJ1ZTsgXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGlmIChpc1N0aWxsT3Blbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgd2luZG93LmxvY2F0aW9uLmhyZWYgPSBmYWxsYmFja1VybDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sIDE1MCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAvLyDnmbznlJ/ku7vkvZXmrIrpmZDpjK/oqqTmmYLvvIzlmJfoqabpl5zplonkuKYgZmFsbGJhY2tcbiAgICAgICAgICAgIHdpbmRvdy5jbG9zZSgpO1xuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7IHdpbmRvdy5sb2NhdGlvbi5ocmVmID0gZmFsbGJhY2tVcmw7IH0sIDE1MCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyDoi6XliKTlrprngrrpnZ7lvYjlh7rliIbpoIHmiJbpl5zplonnhKHmlYjvvIzliYflmJfoqablm57liLDkuIrkuIDpoIHmiJbliJfooahcbiAgICAgICAgaWYgKCFyZXR1cm5Gcm9tSHViICYmIHdpbmRvdy5oaXN0b3J5Lmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgIHdpbmRvdy5oaXN0b3J5LmJhY2soKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHdpbmRvdy5sb2NhdGlvbi5ocmVmID0gZmFsbGJhY2tVcmw7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgY29uc3QgaGFuZGxlUHJpbnQgPSAoKSA9PiB7XG4gICAgICAgIHNldElzVmlld2VyT3Blbih0cnVlKTtcbiAgICB9O1xuXG4gICAgY29uc3QgaGFuZGxlQ2xvc2VWaWV3ZXJBbmRGb2N1c1ByaW50ID0gKCkgPT4ge1xuICAgICAgICBzZXRJc1ZpZXdlck9wZW4oZmFsc2UpO1xuICAgICAgICAvL1xuICAgICAgICBjb25zdCBmb2N1c1ByaW50ID0gKCkgPT4gcHJpbnRCdG5SZWYuY3VycmVudD8uZm9jdXMoKTtcbiAgICAgICAgc2V0VGltZW91dChmb2N1c1ByaW50LCAwKTtcbiAgICAgICAgc2V0VGltZW91dChmb2N1c1ByaW50LCA4MCk7XG4gICAgfTtcblxuICAgIGNvbnN0IGZvY3VzQWN0aW9uQnV0dG9uQnlBcnJvdyA9IChjdXJyZW50UmVmLCBkaXJlY3Rpb24pID0+IHtcbiAgICAgICAgY29uc3QgYWN0aW9uQnV0dG9uUmVmcyA9IFtcbiAgICAgICAgICAgIGlzRWRpdCA/IHByaW50QnRuUmVmIDogbnVsbCxcbiAgICAgICAgICAgIGlzUmVhZE9ubHkgPyBlZGl0QnRuUmVmIDogc2F2ZUJ0blJlZixcbiAgICAgICAgICAgIGNsb3NlQnRuUmVmLFxuICAgICAgICBdXG4gICAgICAgICAgICAuZmlsdGVyKEJvb2xlYW4pXG4gICAgICAgICAgICAuZmlsdGVyKChyZWZPYmopID0+IHJlZk9iai5jdXJyZW50KTtcblxuICAgICAgICBpZiAoYWN0aW9uQnV0dG9uUmVmcy5sZW5ndGggPT09IDApIHJldHVybjtcbiAgICAgICAgY29uc3QgY3VycmVudEluZGV4ID0gYWN0aW9uQnV0dG9uUmVmcy5maW5kSW5kZXgoKHJlZk9iaikgPT4gcmVmT2JqID09PSBjdXJyZW50UmVmKTtcbiAgICAgICAgaWYgKGN1cnJlbnRJbmRleCA9PT0gLTEpIHJldHVybjtcblxuICAgICAgICBjb25zdCBuZXh0SW5kZXggPSBkaXJlY3Rpb24gPT09ICdyaWdodCdcbiAgICAgICAgICAgID8gKGN1cnJlbnRJbmRleCArIDEpICUgYWN0aW9uQnV0dG9uUmVmcy5sZW5ndGhcbiAgICAgICAgICAgIDogKGN1cnJlbnRJbmRleCAtIDEgKyBhY3Rpb25CdXR0b25SZWZzLmxlbmd0aCkgJSBhY3Rpb25CdXR0b25SZWZzLmxlbmd0aDtcbiAgICAgICAgYWN0aW9uQnV0dG9uUmVmc1tuZXh0SW5kZXhdLmN1cnJlbnQ/LmZvY3VzKCk7XG4gICAgfTtcblxuICAgIGNvbnN0IGhhbmRsZUhlYWRlckFjdGlvbktleURvd24gPSAoZSwgY3VycmVudFJlZikgPT4ge1xuICAgICAgICBpZiAoZS5rZXkgPT09ICdBcnJvd1JpZ2h0Jykge1xuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgIGZvY3VzQWN0aW9uQnV0dG9uQnlBcnJvdyhjdXJyZW50UmVmLCAncmlnaHQnKTtcbiAgICAgICAgfSBlbHNlIGlmIChlLmtleSA9PT0gJ0Fycm93TGVmdCcpIHtcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICBmb2N1c0FjdGlvbkJ1dHRvbkJ5QXJyb3coY3VycmVudFJlZiwgJ2xlZnQnKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBjb25zdCBnZXRIZWFkZXJBY3Rpb25TdHlsZSA9IChiYXNlU3R5bGUsIGFjdGlvbktleSkgPT4ge1xuICAgICAgICBpZiAoZm9jdXNlZEhlYWRlckFjdGlvbiAhPT0gYWN0aW9uS2V5KSByZXR1cm4gYmFzZVN0eWxlO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgLi4uYmFzZVN0eWxlLFxuICAgICAgICAgICAgb3V0bGluZTogJzJweCBzb2xpZCAjNjBhNWZhJyxcbiAgICAgICAgICAgIG91dGxpbmVPZmZzZXQ6ICcycHgnLFxuICAgICAgICAgICAgYm94U2hhZG93OiAnMCAwIDAgM3B4IHJnYmEoOTYsIDE2NSwgMjUwLCAwLjI4KScsXG4gICAgICAgICAgICB0cmFuc2Zvcm06ICd0cmFuc2xhdGVZKC0xcHgpJyxcbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgY29uc3QgYWRkRW1wdHlJdGVtID0gKCkgPT4ge1xuICAgICAgICBpZiAoaXNSZWFkT25seSkgcmV0dXJuO1xuICAgICAgICBjb25zdCBlbXB0eUl0ZW0gPSB7XG4gICAgICAgICAgICBwX2lkOiAnJyxcbiAgICAgICAgICAgIG5hbWU6ICcnLFxuICAgICAgICAgICAgcGFydF9udW1iZXI6ICcnLFxuICAgICAgICAgICAgY2FyX21vZGVsOiAnJyxcbiAgICAgICAgICAgIGJyYW5kOiAnJyxcbiAgICAgICAgICAgIHllYXI6ICcnLFxuICAgICAgICAgICAgc3BlYzogJycsXG4gICAgICAgICAgICBxdHk6IDEsXG4gICAgICAgICAgICB1bml0X3ByaWNlOiAwLFxuICAgICAgICAgICAgdW5pdDogJ1BDUycsXG4gICAgICAgICAgICBzdG9jazogMFxuICAgICAgICB9O1xuICAgICAgICBjb25zdCBuZXh0TGVuID0gKGRvYy5pdGVtcyB8fCBbXSkubGVuZ3RoICsgMTtcbiAgICAgICAgc2V0RG9jKChwcmV2KSA9PiAoeyAuLi5wcmV2LCBpdGVtczogWy4uLihwcmV2Lml0ZW1zIHx8IFtdKSwgZW1wdHlJdGVtXSB9KSk7XG4gICAgICAgIHNldEFjdGl2ZUl0ZW1JbmRleChuZXh0TGVuIC0gMSk7IC8vXG4gICAgfTtcblxuICAgIGNvbnN0IHJlbW92ZUl0ZW0gPSAoaW5kZXgpID0+IHtcbiAgICAgICAgY29uc3QgbmV3SXRlbXMgPSBbLi4uZG9jLml0ZW1zXTtcbiAgICAgICAgbmV3SXRlbXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgc2V0RG9jKHsgLi4uZG9jLCBpdGVtczogbmV3SXRlbXMgfSk7XG4gICAgICAgIHNldFNlbGVjdGVkSW5kZXhlcyhbXSk7XG4gICAgfTtcblxuICAgIGNvbnN0IHVwZGF0ZUl0ZW0gPSAoaW5kZXgsIGZpZWxkLCB2YWx1ZSkgPT4ge1xuICAgICAgICBjb25zdCBuZXdJdGVtcyA9IFsuLi5kb2MuaXRlbXNdO1xuICAgICAgICBuZXdJdGVtc1tpbmRleF0gPSB7IC4uLm5ld0l0ZW1zW2luZGV4XSwgW2ZpZWxkXTogdmFsdWUgfTtcbiAgICAgICAgc2V0RG9jKHsgLi4uZG9jLCBpdGVtczogbmV3SXRlbXMgfSk7XG4gICAgfTtcblxuICAgIGNvbnN0IHRvZ2dsZUl0ZW1TZWxlY3Rpb24gPSAoaW5kZXgsIGNoZWNrZWQpID0+IHtcbiAgICAgICAgc2V0U2VsZWN0ZWRJbmRleGVzKChwcmV2KSA9PiB7XG4gICAgICAgICAgICBpZiAoY2hlY2tlZCkge1xuICAgICAgICAgICAgICAgIGlmIChwcmV2LmluY2x1ZGVzKGluZGV4KSkgcmV0dXJuIHByZXY7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFsuLi5wcmV2LCBpbmRleF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcHJldi5maWx0ZXIoKGl0ZW1JbmRleCkgPT4gaXRlbUluZGV4ICE9PSBpbmRleCk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBjb25zdCB0b2dnbGVTZWxlY3RBbGxJdGVtcyA9IChjaGVja2VkKSA9PiB7XG4gICAgICAgIGlmICghY2hlY2tlZCkge1xuICAgICAgICAgICAgc2V0U2VsZWN0ZWRJbmRleGVzKFtdKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBzZXRTZWxlY3RlZEluZGV4ZXMoZG9jLml0ZW1zLm1hcCgoXywgaW5kZXgpID0+IGluZGV4KSk7XG4gICAgfTtcblxuICAgIGNvbnN0IGhhbmRsZURlbGV0ZVNlbGVjdGVkID0gKCkgPT4ge1xuICAgICAgICBpZiAoc2VsZWN0ZWRJbmRleGVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuICAgICAgICBjb25zdCBzZWxlY3RlZFNldCA9IG5ldyBTZXQoc2VsZWN0ZWRJbmRleGVzKTtcbiAgICAgICAgY29uc3QgbmV3SXRlbXMgPSBkb2MuaXRlbXMuZmlsdGVyKChfLCBpbmRleCkgPT4gIXNlbGVjdGVkU2V0LmhhcyhpbmRleCkpO1xuICAgICAgICBzZXREb2MoeyAuLi5kb2MsIGl0ZW1zOiBuZXdJdGVtcyB9KTtcbiAgICAgICAgc2V0U2VsZWN0ZWRJbmRleGVzKFtdKTtcbiAgICB9O1xuXG4gICAgY29uc3QgaXNBbGxTZWxlY3RlZCA9IGRvYy5pdGVtcy5sZW5ndGggPiAwICYmIHNlbGVjdGVkSW5kZXhlcy5sZW5ndGggPT09IGRvYy5pdGVtcy5sZW5ndGg7XG4gICAgY29uc3QgaXNQYXJ0aWFsbHlTZWxlY3RlZCA9IHNlbGVjdGVkSW5kZXhlcy5sZW5ndGggPiAwICYmIHNlbGVjdGVkSW5kZXhlcy5sZW5ndGggPCBkb2MuaXRlbXMubGVuZ3RoO1xuXG4gICAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICAgICAgaWYgKCFzZWxlY3RBbGxSZWYuY3VycmVudCkgcmV0dXJuO1xuICAgICAgICBzZWxlY3RBbGxSZWYuY3VycmVudC5pbmRldGVybWluYXRlID0gaXNQYXJ0aWFsbHlTZWxlY3RlZDtcbiAgICB9LCBbaXNQYXJ0aWFsbHlTZWxlY3RlZF0pO1xuXG4gICAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICAgICAgaWYgKGRvYy5pdGVtcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHNldEFjdGl2ZUl0ZW1JbmRleCgwKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYWN0aXZlSXRlbUluZGV4ID4gZG9jLml0ZW1zLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgIHNldEFjdGl2ZUl0ZW1JbmRleChkb2MuaXRlbXMubGVuZ3RoIC0gMSk7XG4gICAgICAgIH1cbiAgICB9LCBbZG9jLml0ZW1zLCBhY3RpdmVJdGVtSW5kZXhdKTtcblxuICAgIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgICAgIGlmIChpc1JlYWRPbmx5IHx8IGlzUGlja2VyT3BlbiB8fCBpc1ZpZXdlck9wZW4gfHwgZG9jLml0ZW1zLmxlbmd0aCA9PT0gMCB8fCAhZG9jTGlzdEtleWJvYXJkUmVmLmN1cnJlbnQpIHJldHVybjtcbiAgICAgICAgc2V0QWN0aXZlSXRlbUluZGV4KDApO1xuICAgICAgICBkb2NMaXN0S2V5Ym9hcmRSZWYuY3VycmVudC5mb2N1cygpO1xuICAgIH0sIFtpc1JlYWRPbmx5LCBpc1BpY2tlck9wZW4sIGlzVmlld2VyT3BlbiwgZG9jLmRvY19pZCwgZG9jLml0ZW1zLmxlbmd0aF0pO1xuXG4gICAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICAgICAgaWYgKCFpdGVtVGJvZHlSZWYuY3VycmVudCkgcmV0dXJuO1xuICAgICAgICBjb25zdCByb3dFbCA9IGl0ZW1UYm9keVJlZi5jdXJyZW50LnF1ZXJ5U2VsZWN0b3IoYFtkYXRhLWRvYy1pdGVtLXJvdy1pZHg9XCIke2FjdGl2ZUl0ZW1JbmRleH1cIl1gKTtcbiAgICAgICAgaWYgKHJvd0VsKSByb3dFbC5zY3JvbGxJbnRvVmlldyh7IGJsb2NrOiAnbmVhcmVzdCcgfSk7XG4gICAgfSwgW2FjdGl2ZUl0ZW1JbmRleF0pO1xuXG4gICAgLy9cbiAgICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgICAgICBpZiAoaXNSZWFkT25seSB8fCBpc1BpY2tlck9wZW4gfHwgaXNWaWV3ZXJPcGVuIHx8IGRvYy5pdGVtcy5sZW5ndGggPT09IDApIHJldHVybjtcbiAgICAgICAgY29uc3QgaXNUeXBpbmdUYXJnZXQgPSAoZWwpID0+IHtcbiAgICAgICAgICAgIGlmICghZWwgfHwgIWVsLnRhZ05hbWUpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIGNvbnN0IHRhZyA9IGVsLnRhZ05hbWUudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgIGNvbnN0IHJvbGUgPSBlbC5nZXRBdHRyaWJ1dGU/Ligncm9sZScpO1xuICAgICAgICAgICAgcmV0dXJuIHRhZyA9PT0gJ2lucHV0JyB8fCB0YWcgPT09ICd0ZXh0YXJlYScgfHwgdGFnID09PSAnc2VsZWN0JyB8fCByb2xlID09PSAnY29tYm9ib3gnIHx8IHJvbGUgPT09ICdsaXN0Ym94JztcbiAgICAgICAgfTtcbiAgICAgICAgY29uc3QgaGFuZGxlR2xvYmFsID0gKGUpID0+IHtcbiAgICAgICAgICAgIGlmIChlLmtleSAhPT0gJ0Fycm93RG93bicgJiYgZS5rZXkgIT09ICdBcnJvd1VwJykgcmV0dXJuO1xuICAgICAgICAgICAgY29uc3QgbGlzdEVsID0gZG9jTGlzdEtleWJvYXJkUmVmLmN1cnJlbnQ7XG4gICAgICAgICAgICBpZiAoIWxpc3RFbCkgcmV0dXJuO1xuICAgICAgICAgICAgaWYgKGxpc3RFbC5jb250YWlucyhkb2N1bWVudC5hY3RpdmVFbGVtZW50KSkgcmV0dXJuOyAvL1xuICAgICAgICAgICAgaWYgKGlzVHlwaW5nVGFyZ2V0KGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQpKSByZXR1cm47IC8vXG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICBsaXN0RWwuZm9jdXMoKTtcbiAgICAgICAgICAgIHNldEFjdGl2ZUl0ZW1JbmRleChlLmtleSA9PT0gJ0Fycm93RG93bicgPyAwIDogZG9jLml0ZW1zLmxlbmd0aCAtIDEpO1xuICAgICAgICB9O1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgaGFuZGxlR2xvYmFsKTtcbiAgICAgICAgcmV0dXJuICgpID0+IGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBoYW5kbGVHbG9iYWwpO1xuICAgIH0sIFtpc1JlYWRPbmx5LCBpc1BpY2tlck9wZW4sIGlzVmlld2VyT3BlbiwgZG9jLml0ZW1zLmxlbmd0aF0pO1xuXG4gICAgY29uc3QgaXNUeXBpbmdJbkxpc3QgPSAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGVsID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcbiAgICAgICAgaWYgKCFlbCB8fCAhZG9jTGlzdEtleWJvYXJkUmVmLmN1cnJlbnQ/LmNvbnRhaW5zPy4oZWwpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNvbnN0IHRhZyA9IGVsLnRhZ05hbWU/LnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIHJldHVybiB0YWcgPT09ICdpbnB1dCcgfHwgdGFnID09PSAndGV4dGFyZWEnIHx8IHRhZyA9PT0gJ3NlbGVjdCc7XG4gICAgfTtcblxuICAgIGNvbnN0IGZvY3VzSXRlbVJvdyA9IChyb3dJZHgpID0+IHtcbiAgICAgICAgY29uc3Qgcm93ID0gaXRlbVRib2R5UmVmLmN1cnJlbnQ/LnF1ZXJ5U2VsZWN0b3IoYFtkYXRhLWRvYy1pdGVtLXJvdy1pZHg9XCIke3Jvd0lkeH1cIl1gKTtcbiAgICAgICAgcm93Py5mb2N1cygpO1xuICAgIH07XG5cbiAgICBjb25zdCBmb2N1c1F0eUlucHV0ID0gKHJvd0lkeCkgPT4ge1xuICAgICAgICBjb25zdCByb3cgPSBpdGVtVGJvZHlSZWYuY3VycmVudD8ucXVlcnlTZWxlY3RvcihgW2RhdGEtZG9jLWl0ZW0tcm93LWlkeD1cIiR7cm93SWR4fVwiXWApO1xuICAgICAgICByb3c/LnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWRvYy1pdGVtLXF0eV0nKT8uZm9jdXMoKTtcbiAgICB9O1xuICAgIGNvbnN0IGZvY3VzUHJpY2VJbnB1dCA9IChyb3dJZHgpID0+IHtcbiAgICAgICAgY29uc3Qgcm93ID0gaXRlbVRib2R5UmVmLmN1cnJlbnQ/LnF1ZXJ5U2VsZWN0b3IoYFtkYXRhLWRvYy1pdGVtLXJvdy1pZHg9XCIke3Jvd0lkeH1cIl1gKTtcbiAgICAgICAgcm93Py5xdWVyeVNlbGVjdG9yKCdbZGF0YS1kb2MtaXRlbS1wcmljZV0nKT8uZm9jdXMoKTtcbiAgICB9O1xuXG4gICAgY29uc3QgaGFuZGxlRG9jTGlzdEtleURvd24gPSAoZSkgPT4ge1xuICAgICAgICBpZiAoaXNSZWFkT25seSB8fCBkb2MuaXRlbXMubGVuZ3RoID09PSAwKSByZXR1cm47XG5cbiAgICAgICAgaWYgKGUua2V5ID09PSAnRW50ZXInICYmIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgPT09IGFkZFBhcnRCdG5SZWYuY3VycmVudCkge1xuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgc2V0SXNQaWNrZXJPcGVuKHRydWUpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaXNJbklucHV0ID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudD8uY2xvc2VzdD8uKCdpbnB1dCwgdGV4dGFyZWEsIHNlbGVjdCcpO1xuICAgICAgICBpZiAoZS5rZXkgPT09ICdFbnRlcicpIHtcbiAgICAgICAgICAgIGlmIChpc0luSW5wdXQpIHJldHVybjsgLy9cbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgICBjb25zdCByb3dFbCA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ/LmNsb3Nlc3Q/LignW2RhdGEtZG9jLWl0ZW0tcm93LWlkeF0nKTtcbiAgICAgICAgICAgIGNvbnN0IHJvd0lkeCA9IHJvd0VsICE9IG51bGwgPyBwYXJzZUludChyb3dFbC5nZXRBdHRyaWJ1dGUoJ2RhdGEtZG9jLWl0ZW0tcm93LWlkeCcpLCAxMCkgOiBhY3RpdmVJdGVtSW5kZXg7XG4gICAgICAgICAgICBpZiAoIWlzTmFOKHJvd0lkeCkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByb3cgPSBpdGVtVGJvZHlSZWYuY3VycmVudD8ucXVlcnlTZWxlY3RvcihgW2RhdGEtZG9jLWl0ZW0tcm93LWlkeD1cIiR7cm93SWR4fVwiXWApO1xuICAgICAgICAgICAgICAgIHJvdz8ucXVlcnlTZWxlY3RvcignW2RhdGEtZG9jLWl0ZW0tcXR5XScpPy5mb2N1cygpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGUua2V5ID09PSAnQXJyb3dEb3duJykge1xuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgaWYgKGFjdGl2ZUl0ZW1JbmRleCA9PT0gZG9jLml0ZW1zLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgICAgICBhZGRQYXJ0QnRuUmVmLmN1cnJlbnQ/LmZvY3VzKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5leHRJZHggPSBNYXRoLm1pbihhY3RpdmVJdGVtSW5kZXggKyAxLCBkb2MuaXRlbXMubGVuZ3RoIC0gMSk7XG4gICAgICAgICAgICAgICAgc2V0QWN0aXZlSXRlbUluZGV4KG5leHRJZHgpO1xuICAgICAgICAgICAgICAgIGZvY3VzSXRlbVJvdyhuZXh0SWR4KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChlLmtleSA9PT0gJ0Fycm93VXAnKSB7XG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICBpZiAoZG9jdW1lbnQuYWN0aXZlRWxlbWVudCA9PT0gYWRkUGFydEJ0blJlZi5jdXJyZW50KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGFzdElkeCA9IGRvYy5pdGVtcy5sZW5ndGggLSAxO1xuICAgICAgICAgICAgICAgIHNldEFjdGl2ZUl0ZW1JbmRleChsYXN0SWR4KTtcbiAgICAgICAgICAgICAgICBmb2N1c0l0ZW1Sb3cobGFzdElkeCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFjdGl2ZUl0ZW1JbmRleCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHNhdmVCdG5SZWYuY3VycmVudD8uZm9jdXMoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcHJldklkeCA9IE1hdGgubWF4KGFjdGl2ZUl0ZW1JbmRleCAtIDEsIDApO1xuICAgICAgICAgICAgICAgIHNldEFjdGl2ZUl0ZW1JbmRleChwcmV2SWR4KTtcbiAgICAgICAgICAgICAgICBmb2N1c0l0ZW1Sb3cocHJldklkeCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoZS5rZXkgPT09ICcgJyB8fCBlLmNvZGUgPT09ICdTcGFjZScpIHtcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIGNvbnN0IGNoZWNrZWQgPSBzZWxlY3RlZEluZGV4ZXMuaW5jbHVkZXMoYWN0aXZlSXRlbUluZGV4KTtcbiAgICAgICAgICAgIHRvZ2dsZUl0ZW1TZWxlY3Rpb24oYWN0aXZlSXRlbUluZGV4LCAhY2hlY2tlZCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgY29uc3QgaGFuZGxlUGlja1Byb2R1Y3QgPSAocCkgPT4ge1xuICAgICAgICBjb25zdCBwbk9iaiA9IHAucGFydF9udW1iZXJzPy5bMF0gfHwge307XG4gICAgICAgIGNvbnN0IGlzUHVyY2ggPSB0eXBlID09PSAncHVyY2hhc2UnIHx8IHR5cGUgPT09ICdwdXJjaGFzZVJldHVybic7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB7XG4gICAgICAgICAgICBwX2lkOiBwLnBfaWQsXG4gICAgICAgICAgICBuYW1lOiBwLm5hbWUsXG4gICAgICAgICAgICBwYXJ0X251bWJlcjogcG5PYmoucGFydF9udW1iZXIgfHwgcC5wYXJ0X251bWJlciB8fCAnJyxcbiAgICAgICAgICAgIGNhcl9tb2RlbDogcHJvZHVjdExpbmVDYXJNb2RlbChwKSxcbiAgICAgICAgICAgIGJyYW5kOiBwbk9iai5icmFuZCB8fCBwLmJyYW5kIHx8ICcnLFxuICAgICAgICAgICAgeWVhcjogcHJvZHVjdExpbmVZZWFyKHApLFxuICAgICAgICAgICAgc3BlYzogcC5zcGVjaWZpY2F0aW9ucyB8fCAnJyxcbiAgICAgICAgICAgIHF0eTogMSxcbiAgICAgICAgICAgIHVuaXRfcHJpY2U6IGlzUHVyY2ggPyBwcm9kdWN0UHVyY2hhc2VVbml0UHJpY2UocCkgOiBwcm9kdWN0U2FsZXNVbml0UHJpY2UocCksXG4gICAgICAgICAgICB1bml0OiAnUENTJyxcbiAgICAgICAgICAgIHN0b2NrOiBwLnN0b2NrLFxuICAgICAgICAgICAgLy8gQXR0YWNoIG9yaWdpbmFsIHByb2R1Y3QgaW5mbyBmb3IgXCJBcHBsaWNhYmlsaXR5XCIgbGluayBpbiBtYWluIGxpc3RcbiAgICAgICAgICAgIF9mdWxsX3Byb2R1Y3Q6IHBcbiAgICAgICAgfTtcbiAgICAgICAgc2V0RG9jKHsgLi4uZG9jLCBpdGVtczogWy4uLmRvYy5pdGVtcywgbmV3SXRlbV0gfSk7XG4gICAgICAgIHNldElzUGlja2VyT3BlbihmYWxzZSk7XG4gICAgfTtcblxuICAgIGNvbnN0IGlzUGlja2VyQWxsU2VsZWN0ZWQgPSBzZWxlY3RlZFBpY2tlclByb2R1Y3RJZHMubGVuZ3RoID09PSBwaWNrZXJSZXN1bHRzLmxlbmd0aCAmJiBwaWNrZXJSZXN1bHRzLmxlbmd0aCA+IDA7XG4gICAgY29uc3QgaXNQaWNrZXJQYXJ0aWFsbHlTZWxlY3RlZCA9IHNlbGVjdGVkUGlja2VyUHJvZHVjdElkcy5sZW5ndGggPiAwICYmIHNlbGVjdGVkUGlja2VyUHJvZHVjdElkcy5sZW5ndGggPCBwaWNrZXJSZXN1bHRzLmxlbmd0aDtcbiAgICBjb25zdCB0b2dnbGVQaWNrZXJTZWxlY3Rpb24gPSAocElkLCBjaGVja2VkKSA9PiB7XG4gICAgICAgIHNldFNlbGVjdGVkUGlja2VyUHJvZHVjdElkcygocHJldikgPT4ge1xuICAgICAgICAgICAgaWYgKGNoZWNrZWQpIHJldHVybiBwcmV2LmluY2x1ZGVzKHBJZCkgPyBwcmV2IDogWy4uLnByZXYsIHBJZF07XG4gICAgICAgICAgICByZXR1cm4gcHJldi5maWx0ZXIoKGlkKSA9PiBpZCAhPT0gcElkKTtcbiAgICAgICAgfSk7XG4gICAgfTtcbiAgICBjb25zdCB0b2dnbGVQaWNrZXJTZWxlY3RBbGwgPSAoY2hlY2tlZCkgPT4ge1xuICAgICAgICBpZiAoIWNoZWNrZWQpIHtcbiAgICAgICAgICAgIHNldFNlbGVjdGVkUGlja2VyUHJvZHVjdElkcyhbXSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgc2V0U2VsZWN0ZWRQaWNrZXJQcm9kdWN0SWRzKHBpY2tlclJlc3VsdHMubWFwKChwKSA9PiBwLnBfaWQpKTtcbiAgICB9O1xuXG4gICAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICAgICAgaWYgKCFwaWNrZXJTZWxlY3RBbGxSZWYuY3VycmVudCB8fCAhaXNQaWNrZXJPcGVuKSByZXR1cm47XG4gICAgICAgIHBpY2tlclNlbGVjdEFsbFJlZi5jdXJyZW50LmluZGV0ZXJtaW5hdGUgPSBpc1BpY2tlclBhcnRpYWxseVNlbGVjdGVkO1xuICAgIH0sIFtpc1BpY2tlclBhcnRpYWxseVNlbGVjdGVkLCBpc1BpY2tlck9wZW5dKTtcblxuICAgIGNvbnN0IGhhbmRsZVBpY2tTZWxlY3RlZFByb2R1Y3RzID0gKCkgPT4ge1xuICAgICAgICBpZiAoc2VsZWN0ZWRQaWNrZXJQcm9kdWN0SWRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuICAgICAgICBjb25zdCBzZWxlY3RlZFByb2R1Y3RzID0gcGlja2VyUmVzdWx0cy5maWx0ZXIoKHApID0+IHNlbGVjdGVkUGlja2VyUHJvZHVjdElkcy5pbmNsdWRlcyhwLnBfaWQpKTtcbiAgICAgICAgY29uc3QgaXNQdXJjaCA9IHR5cGUgPT09ICdwdXJjaGFzZScgfHwgdHlwZSA9PT0gJ3B1cmNoYXNlUmV0dXJuJztcbiAgICAgICAgY29uc3QgbmV3SXRlbXMgPSBzZWxlY3RlZFByb2R1Y3RzLm1hcCgocCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgcG5PYmogPSBwLnBhcnRfbnVtYmVycz8uWzBdIHx8IHt9O1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBwX2lkOiBwLnBfaWQsXG4gICAgICAgICAgICAgICAgbmFtZTogcC5uYW1lLFxuICAgICAgICAgICAgICAgIHBhcnRfbnVtYmVyOiBwbk9iai5wYXJ0X251bWJlciB8fCBwLnBhcnRfbnVtYmVyIHx8ICcnLFxuICAgICAgICAgICAgICAgIGNhcl9tb2RlbDogcHJvZHVjdExpbmVDYXJNb2RlbChwKSxcbiAgICAgICAgICAgICAgICBicmFuZDogcG5PYmouYnJhbmQgfHwgcC5icmFuZCB8fCAnJyxcbiAgICAgICAgICAgICAgICB5ZWFyOiBwcm9kdWN0TGluZVllYXIocCksXG4gICAgICAgICAgICAgICAgc3BlYzogcC5zcGVjaWZpY2F0aW9ucyB8fCAnJyxcbiAgICAgICAgICAgICAgICBxdHk6IDEsXG4gICAgICAgICAgICAgICAgdW5pdF9wcmljZTogaXNQdXJjaCA/IHByb2R1Y3RQdXJjaGFzZVVuaXRQcmljZShwKSA6IHByb2R1Y3RTYWxlc1VuaXRQcmljZShwKSxcbiAgICAgICAgICAgICAgICB1bml0OiAnUENTJyxcbiAgICAgICAgICAgICAgICBzdG9jazogcC5zdG9jayxcbiAgICAgICAgICAgICAgICBfZnVsbF9wcm9kdWN0OiBwXG4gICAgICAgICAgICB9O1xuICAgICAgICB9KTtcbiAgICAgICAgc2V0RG9jKHsgLi4uZG9jLCBpdGVtczogWy4uLmRvYy5pdGVtcywgLi4ubmV3SXRlbXNdIH0pO1xuICAgICAgICBzZXRTZWxlY3RlZFBpY2tlclByb2R1Y3RJZHMoW10pO1xuICAgICAgICBzZXRJc1BpY2tlck9wZW4oZmFsc2UpO1xuICAgIH07XG5cbiAgICBjb25zdCBoYW5kbGVDbGVhclBpY2tlciA9ICgpID0+IHtcbiAgICAgICAgc2V0UGlja2VyUXVlcnkoe1xuICAgICAgICAgICAgcGFydE51bWJlcjogJycsXG4gICAgICAgICAgICBtb2RlbDogJycsXG4gICAgICAgICAgICBwYXJ0OiAnJyxcbiAgICAgICAgICAgIHNwZWM6ICcnLFxuICAgICAgICAgICAgeWVhcjogJycsXG4gICAgICAgICAgICBicmFuZDogJydcbiAgICAgICAgfSk7XG4gICAgICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZSgoKSA9PiBwaWNrZXJGaXJzdElucHV0UmVmLmN1cnJlbnQ/LmZvY3VzKCkpO1xuICAgIH07XG5cbiAgICAvL1xuICAgIGNvbnN0IGhhbmRsZVBpY2tlckxpc3RLZXlEb3duID0gKGUpID0+IHtcbiAgICAgICAgaWYgKHBpY2tlclJlc3VsdHMubGVuZ3RoID09PSAwKSByZXR1cm47XG4gICAgICAgIGlmIChlLmtleSA9PT0gJ0Fycm93RG93bicpIHtcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIHNldEFjdGl2ZVBpY2tlclJvd0luZGV4KChwcmV2KSA9PiBNYXRoLm1pbihwcmV2ICsgMSwgcGlja2VyUmVzdWx0cy5sZW5ndGggLSAxKSk7XG4gICAgICAgIH0gZWxzZSBpZiAoZS5rZXkgPT09ICdBcnJvd1VwJykge1xuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgaWYgKGFjdGl2ZVBpY2tlclJvd0luZGV4ID09PSAwKSB7XG4gICAgICAgICAgICAgICAgcGlja2VyUmVzZXRCdG5SZWYuY3VycmVudD8uZm9jdXMoKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzZXRBY3RpdmVQaWNrZXJSb3dJbmRleCgocHJldikgPT4gTWF0aC5tYXgocHJldiAtIDEsIDApKTtcbiAgICAgICAgfSBlbHNlIGlmIChlLmtleSA9PT0gJyAnIHx8IGUuY29kZSA9PT0gJ1NwYWNlJykge1xuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgY29uc3QgcCA9IHBpY2tlclJlc3VsdHNbYWN0aXZlUGlja2VyUm93SW5kZXhdO1xuICAgICAgICAgICAgaWYgKHApIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGVja2VkID0gc2VsZWN0ZWRQaWNrZXJQcm9kdWN0SWRzLmluY2x1ZGVzKHAucF9pZCk7XG4gICAgICAgICAgICAgICAgdG9nZ2xlUGlja2VyU2VsZWN0aW9uKHAucF9pZCwgIWNoZWNrZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGUua2V5ID09PSAnRW50ZXInKSB7XG4gICAgICAgICAgICBpZiAoc2VsZWN0ZWRQaWNrZXJQcm9kdWN0SWRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgaGFuZGxlUGlja1NlbGVjdGVkUHJvZHVjdHMoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICB1c2VTZWFyY2hGb3JtS2V5Ym9hcmROYXYocGlja2VyRm9ybVJlZiwgbnVsbCwgcGlja2VyUmVzZXRCdG5SZWYsIHsgZW5hYmxlZDogaXNQaWNrZXJPcGVuLCBzZWFyY2hFc2NhcGVHb2VzVG9SZXNldDogdHJ1ZSB9KTtcblxuICAgIC8vIFBpY2tlciBmb3JtOiBBcnJvd0Rvd24gZnJvbSBhbnkgc2VhcmNoIGZpZWxkIOKGkiBmb2N1cyBmaXJzdCByZXN1bHQgcm93XG4gICAgY29uc3QgaGFuZGxlUGlja2VyRm9ybUtleURvd24gPSAoZSkgPT4ge1xuICAgICAgICBpZiAoZS5kZWZhdWx0UHJldmVudGVkKSByZXR1cm47XG4gICAgICAgIGlmIChlLmtleSAhPT0gJ0Fycm93RG93bicpIHJldHVybjtcbiAgICAgICAgY29uc3QgYWN0aXZlID0gZG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcbiAgICAgICAgaWYgKCFwaWNrZXJGb3JtUmVmLmN1cnJlbnQ/LmNvbnRhaW5zKGFjdGl2ZSkpIHJldHVybjtcbiAgICAgICAgaWYgKGFjdGl2ZT8uY2xvc2VzdD8uKCd1bCcpKSByZXR1cm47XG4gICAgICAgIGlmIChwaWNrZXJSZXN1bHRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIHNldEFjdGl2ZVBpY2tlclJvd0luZGV4KDApO1xuICAgICAgICBwaWNrZXJMaXN0UmVmLmN1cnJlbnQ/LmZvY3VzKCk7XG4gICAgfTtcblxuICAgIC8vIEZpbHRlciBMb2dpY1xuICAgIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgICAgIGxldCBmaWx0ZXJlZCA9IHByb2R1Y3RzO1xuXG4gICAgICAgIGlmIChwaWNrZXJRdWVyeS5tb2RlbCkge1xuICAgICAgICAgICAgY29uc3QgcSA9IHBpY2tlclF1ZXJ5Lm1vZGVsLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICBmaWx0ZXJlZCA9IGZpbHRlcmVkLmZpbHRlcigocCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNtID0gcHJvZHVjdENhck1vZGVsc1NlYXJjaFRleHQocCkudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gY20uaW5jbHVkZXMocSkgfHxcbiAgICAgICAgICAgICAgICAgICAgKHAucGFydF9udW1iZXJzIHx8IFtdKS5zb21lKChwbikgPT4gKHBuLmNhcl9tb2RlbCB8fCAnJykudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChwaWNrZXJRdWVyeS5wYXJ0KSB7XG4gICAgICAgICAgICBjb25zdCBxID0gcGlja2VyUXVlcnkucGFydC50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgZmlsdGVyZWQgPSBmaWx0ZXJlZC5maWx0ZXIocCA9PlxuICAgICAgICAgICAgICAgIChwLm5hbWUgfHwgJycpLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSkgfHxcbiAgICAgICAgICAgICAgICAocC5ub3RlcyB8fCAnJykudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSB8fFxuICAgICAgICAgICAgICAgIChwLnNwZWNpZmljYXRpb25zIHx8ICcnKS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHBpY2tlclF1ZXJ5LnBhcnROdW1iZXIpIHtcbiAgICAgICAgICAgIGNvbnN0IHEgPSBwaWNrZXJRdWVyeS5wYXJ0TnVtYmVyLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICBmaWx0ZXJlZCA9IGZpbHRlcmVkLmZpbHRlcihwID0+XG4gICAgICAgICAgICAgICAgKHAucF9pZCB8fCAnJykudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSB8fFxuICAgICAgICAgICAgICAgIChwLnBhcnRfbnVtYmVyIHx8ICcnKS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHEpIHx8XG4gICAgICAgICAgICAgICAgKHAucGFydF9udW1iZXJzIHx8IFtdKS5zb21lKHBuID0+IChwbi5wYXJ0X251bWJlciB8fCAnJykudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSlcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocGlja2VyUXVlcnkueWVhcikge1xuICAgICAgICAgICAgY29uc3QgeSA9IHBpY2tlclF1ZXJ5LnllYXIudHJpbSgpO1xuICAgICAgICAgICAgZmlsdGVyZWQgPSBmaWx0ZXJlZC5maWx0ZXIoKHApID0+IHByb2R1Y3RZZWFyU2VhcmNoQmxvYihwKS5pbmNsdWRlcyh5KSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocGlja2VyUXVlcnkuc3BlYykge1xuICAgICAgICAgICAgY29uc3QgcSA9IHBpY2tlclF1ZXJ5LnNwZWMudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgIGZpbHRlcmVkID0gZmlsdGVyZWQuZmlsdGVyKHAgPT5cbiAgICAgICAgICAgICAgICAocC5zcGVjaWZpY2F0aW9ucyB8fCAnJykudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSB8fFxuICAgICAgICAgICAgICAgIChwLm5hbWUgfHwgJycpLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSlcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocGlja2VyUXVlcnkuYnJhbmQpIHtcbiAgICAgICAgICAgIGNvbnN0IG5vcm1hbGl6ZSA9ICh2KSA9PiBTdHJpbmcodiA/PyAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgIGNvbnN0IHEgPSBub3JtYWxpemUocGlja2VyUXVlcnkuYnJhbmQpLnRyaW0oKTtcbiAgICAgICAgICAgIGNvbnN0IG1hdGNoZWRCcmFuZFBocmFzZXMgPSBicmFuZHMuZmlsdGVyKChpdGVtKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2hvcnRoYW5kID0gbm9ybWFsaXplKGl0ZW0/LnNob3J0aGFuZCk7XG4gICAgICAgICAgICAgICAgY29uc3QgZnVsbG5hbWUgPSBub3JtYWxpemUoaXRlbT8uZnVsbG5hbWUpO1xuICAgICAgICAgICAgICAgIHJldHVybiBzaG9ydGhhbmQuaW5jbHVkZXMocSkgfHwgZnVsbG5hbWUuaW5jbHVkZXMocSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnN0IGJyYW5kS2V5d29yZHMgPSBuZXcgU2V0KFtxXSk7XG4gICAgICAgICAgICBtYXRjaGVkQnJhbmRQaHJhc2VzLmZvckVhY2goKGl0ZW0pID0+IHtcbiAgICAgICAgICAgICAgICBicmFuZEtleXdvcmRzLmFkZChub3JtYWxpemUoaXRlbT8uc2hvcnRoYW5kKSk7XG4gICAgICAgICAgICAgICAgYnJhbmRLZXl3b3Jkcy5hZGQobm9ybWFsaXplKGl0ZW0/LmZ1bGxuYW1lKSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZmlsdGVyZWQgPSBmaWx0ZXJlZC5maWx0ZXIoKHApID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBicmFuZFRleHQgPSBub3JtYWxpemUoXG4gICAgICAgICAgICAgICAgICAgIGAke3AuYnJhbmQgfHwgJyd9ICR7KHAucGFydF9udW1iZXJzIHx8IFtdKS5tYXAoKHBuKSA9PiBwbj8uYnJhbmQgfHwgJycpLmpvaW4oJyAnKX1gXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gQXJyYXkuZnJvbShicmFuZEtleXdvcmRzKS5zb21lKChrZXl3b3JkKSA9PiBrZXl3b3JkICYmIGJyYW5kVGV4dC5pbmNsdWRlcyhrZXl3b3JkKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHNldFBpY2tlck1hdGNoVG90YWwoZmlsdGVyZWQubGVuZ3RoKTtcbiAgICAgICAgc2V0UGlja2VyUmVzdWx0cyhmaWx0ZXJlZC5zbGljZSgwLCA1MCkpO1xuICAgIH0sIFtwaWNrZXJRdWVyeSwgcHJvZHVjdHMsIGJyYW5kc10pO1xuXG4gICAgLy8gS2VlcCBhY3RpdmUgcm93IGluZGV4IHZhbGlkIHdoaWxlIHVzZXIgZmlsdGVycyByZXN1bHRzLlxuICAgIC8vIERvIG5vdCBmb3JjZSBmb2N1cyB0byBsaXN0LCBvdGhlcndpc2UgdHlwaW5nIGluIHNlYXJjaCBmaWVsZHMgZ2V0cyBpbnRlcnJ1cHRlZC5cbiAgICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgICAgICBpZiAoIWlzUGlja2VyT3BlbikgcmV0dXJuO1xuICAgICAgICBpZiAocGlja2VyUmVzdWx0cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHNldEFjdGl2ZVBpY2tlclJvd0luZGV4KDApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHNldEFjdGl2ZVBpY2tlclJvd0luZGV4KChwcmV2KSA9PiBNYXRoLm1pbihwcmV2LCBwaWNrZXJSZXN1bHRzLmxlbmd0aCAtIDEpKTtcbiAgICB9LCBbaXNQaWNrZXJPcGVuLCBwaWNrZXJSZXN1bHRzLmxlbmd0aF0pO1xuXG4gICAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICAgICAgaWYgKCFpc1BpY2tlck9wZW4gfHwgcGlja2VyUmVzdWx0cy5sZW5ndGggPT09IDApIHJldHVybjtcbiAgICAgICAgY29uc3QgbGlzdCA9IHBpY2tlckxpc3RSZWYuY3VycmVudDtcbiAgICAgICAgaWYgKCFsaXN0Py5jb250YWlucyhkb2N1bWVudC5hY3RpdmVFbGVtZW50KSkgcmV0dXJuO1xuICAgICAgICBjb25zdCByb3cgPSBsaXN0LnF1ZXJ5U2VsZWN0b3IoYFtkYXRhLXBpY2tlci1yb3ctaWR4PVwiJHthY3RpdmVQaWNrZXJSb3dJbmRleH1cIl1gKTtcbiAgICAgICAgcm93Py5zY3JvbGxJbnRvVmlldyh7IGJsb2NrOiAnbmVhcmVzdCcgfSk7XG4gICAgfSwgW2FjdGl2ZVBpY2tlclJvd0luZGV4LCBpc1BpY2tlck9wZW4sIHBpY2tlclJlc3VsdHMubGVuZ3RoXSk7XG5cbiAgICByZXR1cm4gKFxuICAgICAgICA8ZGl2IHN0eWxlPXt7IGJhY2tncm91bmRDb2xvcjogJ3ZhcigtLWJnLXByaW1hcnkpJywgbWluSGVpZ2h0OiAnMTAwdmgnLCBjb2xvcjogJ3ZhcigtLXRleHQtcHJpbWFyeSknLCBkaXNwbGF5OiAnZmxleCcsIGZsZXhEaXJlY3Rpb246ICdjb2x1bW4nLCBvdmVyZmxvdzogJ2hpZGRlbicgfX0+XG4gICAgICAgICAgICB7LyogSGVhZGVyIHNlY3Rpb24gKEJhc2ljIEluZm8pICovfVxuICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBwYWRkaW5nOiAnMXJlbSAxLjVyZW0nLCBiYWNrZ3JvdW5kQ29sb3I6ICd2YXIoLS1iZy1zZWNvbmRhcnkpJywgYm9yZGVyQm90dG9tOiAnMXB4IHNvbGlkIHZhcigtLWJvcmRlci1jb2xvciknLCBmbGV4U2hyaW5rOiAwIH19PlxuICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgZGlzcGxheTogJ2ZsZXgnLCBqdXN0aWZ5Q29udGVudDogJ3NwYWNlLWJldHdlZW4nLCBhbGlnbkl0ZW1zOiAnZmxleC1zdGFydCcsIG1hcmdpbkJvdHRvbTogJzFyZW0nIH19PlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6ICdmbGV4JywgZ2FwOiAnMS41cmVtJywgYWxpZ25JdGVtczogJ2NlbnRlcicgfX0+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGJhY2tncm91bmQ6IGN1cnJlbnREb2NNZXRhLmNvbG9yLCBjb2xvcjogJ3doaXRlJywgcGFkZGluZzogJzAuNHJlbSAwLjhyZW0nLCBib3JkZXJSYWRpdXM6ICc0cHgnLCBmb250V2VpZ2h0OiA4MDAgfX0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge2N1cnJlbnREb2NNZXRhLmxhYmVsfVxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6ICdmbGV4JywgZmxleERpcmVjdGlvbjogJ2NvbHVtbicgfX0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gc3R5bGU9e3sgZm9udFNpemU6ICcxcmVtJywgZm9udFdlaWdodDogODAwLCBjb2xvcjogJ3ZhcigtLXRleHQtcHJpbWFyeSknIH19PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7aXNFZGl0ID8gYFxcdTU1YWVcXHU4NjVmOiAke2lkfWAgOiAnXFx1NjViMFxcdTU1YWVcXHU2NGRhXFx1OTgxMFxcdTg5YmQnfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBzdHlsZT17eyBmb250U2l6ZTogJzAuN3JlbScsIGNvbG9yOiAndmFyKC0tdGV4dC1zZWNvbmRhcnkpJyB9fT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2lzRWRpdCA/IChpc1JlYWRPbmx5ID8gJ1xcdTZhYTJcXHU4OTk2XFx1NmEyMVxcdTVmMGYnIDogJ1xcdTdkZThcXHU4ZjJmXFx1NGUyZC4uJykgOiAnXFx1NWVmYVxcdTdhY2JcXHU2NWIwXFx1NTVhZVxcdTY0ZGFcXHU0ZTJkJ31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgZGlzcGxheTogJ2ZsZXgnLCBnYXA6ICcwLjc1cmVtJyB9fT5cbiAgICAgICAgICAgICAgICAgICAgICAgIHsvKiBBbHdheXMgc2hvdyBQcmludGVyIGlmIGl0J3MgYW4gZXhpc3RpbmcgZG9jdW1lbnQgKi99XG4gICAgICAgICAgICAgICAgICAgICAgICB7aXNFZGl0ICYmIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlZj17cHJpbnRCdG5SZWZ9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e2hhbmRsZVByaW50fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbktleURvd249eyhlKSA9PiBoYW5kbGVIZWFkZXJBY3Rpb25LZXlEb3duKGUsIHByaW50QnRuUmVmKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25Gb2N1cz17KCkgPT4gc2V0Rm9jdXNlZEhlYWRlckFjdGlvbigncHJpbnQnKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25CbHVyPXsoKSA9PiBzZXRGb2N1c2VkSGVhZGVyQWN0aW9uKCcnKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3R5bGU9e2dldEhlYWRlckFjdGlvblN0eWxlKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBiYWNrZ3JvdW5kQ29sb3I6ICd2YXIoLS1iZy10ZXJ0aWFyeSknLCBjb2xvcjogJ3ZhcigtLXRleHQtcHJpbWFyeSknLCBib3JkZXI6ICcxcHggc29saWQgdmFyKC0tYm9yZGVyLWNvbG9yKScsIHBhZGRpbmc6ICcwLjZyZW0gMXJlbScsIGJvcmRlclJhZGl1czogJzZweCcsIGZvbnRXZWlnaHQ6IDYwMCwgZGlzcGxheTogJ2ZsZXgnLCBhbGlnbkl0ZW1zOiAnY2VudGVyJywgZ2FwOiAnMC41cmVtJywgY3Vyc29yOiAncG9pbnRlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdwcmludCdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU9eydcXHU1MjE3XFx1NTM3MFxcdTU1YWVcXHU2NGRhJ31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxQcmludGVyIHNpemU9ezE4fSAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICAgICAgKX1cblxuICAgICAgICAgICAgICAgICAgICAgICAgey8qIFRvZ2dsZSBiZXR3ZWVuIEVkaXQvU2F2ZSBidXR0b25zIGluIHRoZSBzYW1lIHBvc2l0aW9uICovfVxuICAgICAgICAgICAgICAgICAgICAgICAge2lzUmVhZE9ubHkgPyAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWY9e2VkaXRCdG5SZWZ9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF1dG9Gb2N1c1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBjYW5FZGl0VGhpc0RvY1R5cGUgJiYgc2V0SXNSZWFkT25seShmYWxzZSl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uS2V5RG93bj17KGUpID0+IGhhbmRsZUhlYWRlckFjdGlvbktleURvd24oZSwgZWRpdEJ0blJlZil9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uRm9jdXM9eygpID0+IHNldEZvY3VzZWRIZWFkZXJBY3Rpb24oJ2VkaXQnKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25CbHVyPXsoKSA9PiBzZXRGb2N1c2VkSGVhZGVyQWN0aW9uKCcnKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9eyFjYW5FZGl0VGhpc0RvY1R5cGV9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlPXtnZXRIZWFkZXJBY3Rpb25TdHlsZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgYmFja2dyb3VuZENvbG9yOiAnI2Y1OWUwYicsIGNvbG9yOiAnd2hpdGUnLCBib3JkZXI6ICdub25lJywgcGFkZGluZzogJzAuNnJlbSAxLjI1cmVtJywgYm9yZGVyUmFkaXVzOiAnNnB4JywgZm9udFdlaWdodDogNjAwLCBkaXNwbGF5OiAnZmxleCcsIGFsaWduSXRlbXM6ICdjZW50ZXInLCBnYXA6ICcwLjVyZW0nLCBjdXJzb3I6ICdwb2ludGVyJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2VkaXQnXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8RWRpdDIgc2l6ZT17MTh9IC8+IHsnXFx1N2RlOFxcdThmMmYnfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlZj17c2F2ZUJ0blJlZn1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXV0b0ZvY3VzPXtkb2MuaXRlbXMubGVuZ3RoID09PSAwfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXtoYW5kbGVTYXZlfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbktleURvd249eyhlKSA9PiBoYW5kbGVIZWFkZXJBY3Rpb25LZXlEb3duKGUsIHNhdmVCdG5SZWYpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkZvY3VzPXsoKSA9PiBzZXRGb2N1c2VkSGVhZGVyQWN0aW9uKCdzYXZlJyl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQmx1cj17KCkgPT4gc2V0Rm9jdXNlZEhlYWRlckFjdGlvbignJyl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlPXtnZXRIZWFkZXJBY3Rpb25TdHlsZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgYmFja2dyb3VuZENvbG9yOiAnIzEwYjk4MScsIGNvbG9yOiAnd2hpdGUnLCBib3JkZXI6ICdub25lJywgcGFkZGluZzogJzAuNnJlbSAxLjI1cmVtJywgYm9yZGVyUmFkaXVzOiAnNnB4JywgZm9udFdlaWdodDogNjAwLCBkaXNwbGF5OiAnZmxleCcsIGFsaWduSXRlbXM6ICdjZW50ZXInLCBnYXA6ICcwLjVyZW0nLCBjdXJzb3I6ICdwb2ludGVyJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3NhdmUnXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8U2F2ZSBzaXplPXsxOH0gLz4geydcXHU1MTMyXFx1NWI1OCd9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlZj17Y2xvc2VCdG5SZWZ9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17aGFuZGxlQ2xvc2V9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25LZXlEb3duPXsoZSkgPT4gaGFuZGxlSGVhZGVyQWN0aW9uS2V5RG93bihlLCBjbG9zZUJ0blJlZil9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25Gb2N1cz17KCkgPT4gc2V0Rm9jdXNlZEhlYWRlckFjdGlvbignY2xvc2UnKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkJsdXI9eygpID0+IHNldEZvY3VzZWRIZWFkZXJBY3Rpb24oJycpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlPXtnZXRIZWFkZXJBY3Rpb25TdHlsZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBiYWNrZ3JvdW5kQ29sb3I6ICcjZWY0NDQ0JywgY29sb3I6ICd3aGl0ZScsIGJvcmRlcjogJ25vbmUnLCBwYWRkaW5nOiAnMC42cmVtIDAuOHJlbScsIGJvcmRlclJhZGl1czogJzZweCcsIGN1cnNvcjogJ3BvaW50ZXInIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdjbG9zZSdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxYIHNpemU9ezIwfSAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBkaXNwbGF5OiAnZ3JpZCcsIGdyaWRUZW1wbGF0ZUNvbHVtbnM6ICcxLjJmciAyZnIgMS4xZnIgMWZyIDEuN2ZyJywgZ2FwOiAnMC44NXJlbScsIGFsaWduSXRlbXM6ICdlbmQnLCBwYWRkaW5nOiAnMC43cmVtJywgYm9yZGVyOiAnMXB4IHNvbGlkIHZhcigtLWJvcmRlci1jb2xvciknLCBib3JkZXJSYWRpdXM6ICc4cHgnLCBiYWNrZ3JvdW5kOiAndmFyKC0tYmctcHJpbWFyeSknIH19PlxuICAgICAgICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgPGxhYmVsIHN0eWxlPXt7IGZvbnRTaXplOiAnMC44NXJlbScsIGNvbG9yOiAndmFyKC0tYWNjZW50LXByaW1hcnkpJywgZGlzcGxheTogJ2Jsb2NrJywgbWFyZ2luQm90dG9tOiAnNnB4JywgZm9udFdlaWdodDogODAwLCBsZXR0ZXJTcGFjaW5nOiAnMC4wM2VtJyB9fT57J1xcdTY1ZTVcXHU2NzFmJ308L2xhYmVsPlxuICAgICAgICAgICAgICAgICAgICAgICAgPGlucHV0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImRhdGVcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpc2FibGVkPXtpc1JlYWRPbmx5fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXtkb2MuZGF0ZX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17ZSA9PiBzZXREb2MoeyAuLi5kb2MsIGRhdGU6IGUudGFyZ2V0LnZhbHVlIH0pfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpZHRoOiAnMTAwJScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhZGRpbmc6ICcwLjVyZW0nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IGlzUmVhZE9ubHkgPyAndmFyKC0tYmctc2Vjb25kYXJ5KScgOiAndmFyKC0tYmctdGVydGlhcnkpJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYm9yZGVyOiAnMXB4IHNvbGlkIHZhcigtLWJvcmRlci1jb2xvciknLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBib3JkZXJSYWRpdXM6ICc0cHgnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xvcjogJ3ZhcigtLXRleHQtcHJpbWFyeSknLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb250U2l6ZTogJzFyZW0nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb250V2VpZ2h0OiA3MDBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8bGFiZWwgc3R5bGU9e3sgZm9udFNpemU6ICcwLjg1cmVtJywgY29sb3I6ICd2YXIoLS1hY2NlbnQtcHJpbWFyeSknLCBkaXNwbGF5OiAnYmxvY2snLCBtYXJnaW5Cb3R0b206ICc2cHgnLCBmb250V2VpZ2h0OiA4MDAsIGxldHRlclNwYWNpbmc6ICcwLjAzZW0nIH19Pntpc1N1cHBsaWVyID8gJ1xcdTRmOWJcXHU2MWM5XFx1NTU0NicgOiAnXFx1NWJhMlxcdTYyMzYnfTwvbGFiZWw+XG4gICAgICAgICAgICAgICAgICAgICAgICB7aXNTdXBwbGllciA/IChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8Q29kZUxvb2t1cElucHV0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXtkb2Muc3VwcGxpZXJfaWQgfHwgJyd9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWVWYWx1ZT17ZG9jLnN1cHBsaWVyX25hbWUgfHwgJyd9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1Z2dlc3Rpb25zPXtzdXBwbGllck9wdGlvbnN9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkS2V5PVwic3VwX2lkXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9e2lzUmVhZE9ubHl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlucHV0U3R5bGU9e3tcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhZGRpbmc6ICcwLjVyZW0nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yOiBpc1JlYWRPbmx5ID8gJ3ZhcigtLWJnLXNlY29uZGFyeSknIDogJ3ZhcigtLWJnLXRlcnRpYXJ5KScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBib3JkZXI6ICcxcHggc29saWQgdmFyKC0tYm9yZGVyLWNvbG9yKScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBib3JkZXJSYWRpdXM6ICc0cHgnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sb3I6ICd2YXIoLS10ZXh0LXByaW1hcnkpJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvbnRTaXplOiAnMXJlbScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb250V2VpZ2h0OiA3MDBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25TZWxlY3Q9e3N1cCA9PiBzZXREb2Moe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLi4uZG9jLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3VwcGxpZXJfaWQ6IHN1cC5zdXBfaWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdXBwbGllcl9uYW1lOiBzdXAubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbmN5OiBpc0N1cnJlbmN5TG9ja2VkID8gZGVmYXVsdEN1cnJlbmN5IDogKHN1cC5jdXJyZW5jeSB8fCAnVVNEJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPENvZGVMb29rdXBJbnB1dFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17ZG9jLmN1c3RvbWVyX2lkIHx8ICcnfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lVmFsdWU9e2RvYy5jdXN0b21lcl9uYW1lIHx8ICcnfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdWdnZXN0aW9ucz17Y3VzdG9tZXJPcHRpb25zfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZEtleT1cImN1c3RfaWRcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaXNhYmxlZD17aXNSZWFkT25seX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5wdXRTdHlsZT17e1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFkZGluZzogJzAuNXJlbScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IGlzUmVhZE9ubHkgPyAndmFyKC0tYmctc2Vjb25kYXJ5KScgOiAndmFyKC0tYmctdGVydGlhcnkpJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJvcmRlcjogJzFweCBzb2xpZCB2YXIoLS1ib3JkZXItY29sb3IpJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJvcmRlclJhZGl1czogJzRweCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xvcjogJ3ZhcigtLXRleHQtcHJpbWFyeSknLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9udFNpemU6ICcxcmVtJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvbnRXZWlnaHQ6IDcwMFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvblNlbGVjdD17Y3VzdCA9PiBzZXREb2Moe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLi4uZG9jLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VzdG9tZXJfaWQ6IGN1c3QuY3VzdF9pZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1c3RvbWVyX25hbWU6IGN1c3QubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbmN5OiBpc0N1cnJlbmN5TG9ja2VkID8gZGVmYXVsdEN1cnJlbmN5IDogKGN1c3QuY3VycmVuY3kgfHwgJ1RXRCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxsYWJlbCBzdHlsZT17eyBmb250U2l6ZTogJzAuODVyZW0nLCBjb2xvcjogJ3ZhcigtLWFjY2VudC1wcmltYXJ5KScsIGRpc3BsYXk6ICdibG9jaycsIG1hcmdpbkJvdHRvbTogJzZweCcsIGZvbnRXZWlnaHQ6IDgwMCwgbGV0dGVyU3BhY2luZzogJzAuMDNlbScgfX0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge3R5cGUgPT09ICdzYWxlcycgPyAn54uA5oWL77yI5pqr5LiN6ZaL5pS+77yJJyA6ICfni4DmhYsnfVxuICAgICAgICAgICAgICAgICAgICAgICAgPC9sYWJlbD5cbiAgICAgICAgICAgICAgICAgICAgICAgIHt0eXBlID09PSAnc2FsZXMnID8gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU9XCLpirfosqjllq7plovllq7ljbPlhaXmh4nmlLbvvJvni4DmhYvml6XlvozomZXnkIZcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd2lkdGg6ICcxMDAlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhZGRpbmc6ICcwLjVyZW0nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yOiAndmFyKC0tYmctc2Vjb25kYXJ5KScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBib3JkZXI6ICcxcHggZGFzaGVkIHZhcigtLWJvcmRlci1jb2xvciknLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiAnNHB4JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yOiAndmFyKC0tdGV4dC1tdXRlZCknLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9udFNpemU6ICcwLjlyZW0nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9udFdlaWdodDogNjAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg6Yq36LKo5Zau6ZaL5Zau5Y2z5YWl5biz77yb54uA5oWL6YG46aCF5pel5b6M6ZaL5pS+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzZWxlY3RcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9e2lzUmVhZE9ubHl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXtkb2Muc3RhdHVzfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHNldERvYyh7IC4uLmRvYywgc3RhdHVzOiBlLnRhcmdldC52YWx1ZSB9KX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpZHRoOiAnMTAwJScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYWRkaW5nOiAnMC41cmVtJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJhY2tncm91bmRDb2xvcjogaXNSZWFkT25seSA/ICd2YXIoLS1iZy1zZWNvbmRhcnkpJyA6ICd2YXIoLS1iZy10ZXJ0aWFyeSknLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYm9yZGVyOiAnMXB4IHNvbGlkIHZhcigtLWJvcmRlci1jb2xvciknLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiAnNHB4JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yOiAndmFyKC0tdGV4dC1wcmltYXJ5KScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb250U2l6ZTogJzFyZW0nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9udFdlaWdodDogNzAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPG9wdGlvbiB2YWx1ZT1cInBlbmRpbmdcIj57J1xcdTVmODVcXHU4NjU1XFx1NzQwNid9PC9vcHRpb24+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9XCJhY2NlcHRlZFwiPnsnXFx1NWRmMlxcdTY4MzhcXHU1MWM2J308L29wdGlvbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPG9wdGlvbiB2YWx1ZT1cInJlY2VpdmVkXCI+eydcXHU1ZGYyXFx1NTE2NVxcdTVlYWInfTwvb3B0aW9uPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvc2VsZWN0PlxuICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8bGFiZWwgc3R5bGU9e3sgZm9udFNpemU6ICcwLjg1cmVtJywgY29sb3I6ICd2YXIoLS1hY2NlbnQtcHJpbWFyeSknLCBkaXNwbGF5OiAnYmxvY2snLCBtYXJnaW5Cb3R0b206ICc2cHgnLCBmb250V2VpZ2h0OiA4MDAsIGxldHRlclNwYWNpbmc6ICcwLjAzZW0nIH19PnsnXFx1NWU2M1xcdTUyMjUnfTwvbGFiZWw+XG4gICAgICAgICAgICAgICAgICAgICAgICA8c2VsZWN0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9e2lzQ3VycmVuY3lMb2NrZWQgfHwgaXNSZWFkT25seX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17ZG9jLmN1cnJlbmN5fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXtlID0+IHNldERvYyh7IC4uLmRvYywgY3VycmVuY3k6IGUudGFyZ2V0LnZhbHVlIH0pfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpZHRoOiAnMTAwJScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhZGRpbmc6ICcwLjVyZW0nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IChpc0N1cnJlbmN5TG9ja2VkIHx8IGlzUmVhZE9ubHkpID8gJ3ZhcigtLWJnLXNlY29uZGFyeSknIDogJ3ZhcigtLWJnLXRlcnRpYXJ5KScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJvcmRlcjogJzFweCBzb2xpZCB2YXIoLS1ib3JkZXItY29sb3IpJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiAnNHB4JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sb3I6ICd2YXIoLS10ZXh0LXByaW1hcnkpJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3Vyc29yOiAoaXNDdXJyZW5jeUxvY2tlZCB8fCBpc1JlYWRPbmx5KSA/ICdub3QtYWxsb3dlZCcgOiAncG9pbnRlcicsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvbnRXZWlnaHQ6IDcwMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9udFNpemU6ICcxcmVtJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPG9wdGlvbiB2YWx1ZT1cIlRXRFwiPlRXRDwvb3B0aW9uPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9XCJVU0RcIj5VU0Q8L29wdGlvbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8b3B0aW9uIHZhbHVlPVwiSlBZXCI+SlBZPC9vcHRpb24+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPG9wdGlvbiB2YWx1ZT1cIkNOWVwiPkNOWTwvb3B0aW9uPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9XCJFVVJcIj5FVVI8L29wdGlvbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8b3B0aW9uIHZhbHVlPVwiSEtEXCI+SEtEPC9vcHRpb24+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L3NlbGVjdD5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8bGFiZWwgc3R5bGU9e3sgZm9udFNpemU6ICcwLjg1cmVtJywgY29sb3I6ICd2YXIoLS1hY2NlbnQtcHJpbWFyeSknLCBkaXNwbGF5OiAnYmxvY2snLCBtYXJnaW5Cb3R0b206ICc2cHgnLCBmb250V2VpZ2h0OiA4MDAsIGxldHRlclNwYWNpbmc6ICcwLjAzZW0nIH19PnsnXFx1OTU4YlxcdTU1YWVcXHU0ZWJhXFx1NTRlMSd9PC9sYWJlbD5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxzZWxlY3RcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaXNhYmxlZD17aXNSZWFkT25seX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17ZG9jLm9wZW5lcl9lbXBfaWQgfHwgJyd9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9e2UgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBlbXAgPSBlbXBsb3llZXMuZmluZCgoaXRlbSkgPT4gaXRlbS5lbXBfaWQgPT09IGUudGFyZ2V0LnZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0RG9jKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC4uLmRvYyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wZW5lcl9lbXBfaWQ6IGVtcD8uZW1wX2lkIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3BlbmVyX2VtcF9uYW1lOiBlbXA/Lm5hbWUgfHwgJydcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aWR0aDogJzEwMCUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYWRkaW5nOiAnMC41cmVtJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yOiBpc1JlYWRPbmx5ID8gJ3ZhcigtLWJnLXNlY29uZGFyeSknIDogJ3ZhcigtLWJnLXRlcnRpYXJ5KScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJvcmRlcjogJzFweCBzb2xpZCB2YXIoLS1ib3JkZXItY29sb3IpJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiAnNHB4JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sb3I6ICd2YXIoLS10ZXh0LXByaW1hcnkpJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9udFNpemU6ICcxcmVtJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9udFdlaWdodDogNzAwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8b3B0aW9uIHZhbHVlPVwiXCI+LS0geydcXHU4YWNiXFx1OTA3OFxcdTY0YzcnfSAtLTwvb3B0aW9uPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtlbXBsb3llZXMubWFwKChlbXApID0+IChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPG9wdGlvbiBrZXk9e2VtcC5lbXBfaWR9IHZhbHVlPXtlbXAuZW1wX2lkfT57ZW1wLmVtcF9pZH0gfCB7ZW1wLm5hbWV9PC9vcHRpb24+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L3NlbGVjdD5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgeyFjYW5FZGl0VGhpc0RvY1R5cGUgJiYgKFxuICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IG1hcmdpblRvcDogJzAuNnJlbScsIGNvbG9yOiAndmFyKC0td2FybmluZyknLCBmb250U2l6ZTogJzAuOHJlbScsIGZvbnRXZWlnaHQ6IDcwMCB9fT5cbiAgICAgICAgICAgICAgICAgICAgICAgIHsnXFx1NjBhOFxcdTZjOTJcXHU2NzA5XFx1NmIwYVxcdTk2NTBcXHU3ZGU4XFx1OGYyZlxcdTZiNjRcXHU1NWFlXFx1NjRkYVxcdTMwMDInfVxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgIHshaXNQaWNrZXJPcGVuICYmIChcbiAgICAgICAgICAgICAgICA8RG9jUHJvZHVjdEhpc3RvcnlEcmF3ZXJcbiAgICAgICAgICAgICAgICAgICAgb3Blbj17aGlzdG9yeURyYXdlck9wZW59XG4gICAgICAgICAgICAgICAgICAgIG9uQ2xvc2U9eygpID0+IHNldEhpc3RvcnlEcmF3ZXJPcGVuKGZhbHNlKX1cbiAgICAgICAgICAgICAgICAgICAgZm9jdXNQSWQ9e2RvY0hpc3RvcnlGb2N1c1BJZH1cbiAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgKX1cblxuICAgICAgICAgICAgey8qIENvbnRlbnQgQm9keSAoVGFibGUgZm9yIHBhcnRzKSAqL31cbiAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJjdXN0b20tc2Nyb2xsYmFyXCJcbiAgICAgICAgICAgICAgICBkYXRhLWRvYy1pdGVtcy16b25lXG4gICAgICAgICAgICAgICAgc3R5bGU9e3sgZmxleDogMSwgbWluSGVpZ2h0OiAwLCBvdmVyZmxvd1k6ICdhdXRvJywgb3ZlcmZsb3dYOiAnYXV0bycsIHBhZGRpbmc6ICcxLjVyZW0nIH19XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgPGRpdlxuICAgICAgICAgICAgICAgICAgICBzdHlsZT17eyBiYWNrZ3JvdW5kOiAndmFyKC0tYmctc2Vjb25kYXJ5KScsIGJvcmRlclJhZGl1czogJzhweCcsIGJvcmRlcjogJzFweCBzb2xpZCB2YXIoLS1ib3JkZXItY29sb3IpJywgb3ZlcmZsb3c6ICdoaWRkZW4nIH19XG4gICAgICAgICAgICAgICAgICAgIHJlZj17ZG9jTGlzdEtleWJvYXJkUmVmfVxuICAgICAgICAgICAgICAgICAgICB0YWJJbmRleD17IWlzUmVhZE9ubHkgPyAwIDogLTF9XG4gICAgICAgICAgICAgICAgICAgIG9uS2V5RG93bj17aGFuZGxlRG9jTGlzdEtleURvd259XG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICB7IWlzUmVhZE9ubHkgJiYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBwYWRkaW5nOiAnMC43NXJlbSAxcmVtJywgYm9yZGVyQm90dG9tOiAnMXB4IHNvbGlkIHZhcigtLWJvcmRlci1jb2xvciknLCBiYWNrZ3JvdW5kQ29sb3I6ICd2YXIoLS1iZy1zZWNvbmRhcnkpJyB9fT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e2hhbmRsZURlbGV0ZVNlbGVjdGVkfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaXNhYmxlZD17c2VsZWN0ZWRJbmRleGVzLmxlbmd0aCA9PT0gMH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJhY2tncm91bmRDb2xvcjogc2VsZWN0ZWRJbmRleGVzLmxlbmd0aCA9PT0gMCA/ICd2YXIoLS1iZy10ZXJ0aWFyeSknIDogJyNlZjQ0NDQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sb3I6IHNlbGVjdGVkSW5kZXhlcy5sZW5ndGggPT09IDAgPyAndmFyKC0tdGV4dC1tdXRlZCknIDogJ3doaXRlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJvcmRlcjogJ25vbmUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFkZGluZzogJzAuNDVyZW0gMC44cmVtJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJvcmRlclJhZGl1czogJzZweCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJzb3I6IHNlbGVjdGVkSW5kZXhlcy5sZW5ndGggPT09IDAgPyAnbm90LWFsbG93ZWQnIDogJ3BvaW50ZXInLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9udFdlaWdodDogNzAwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7J1xcdTUyMmFcXHU5NjY0J31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICA8dGFibGUgc3R5bGU9e3sgd2lkdGg6ICcxMDAlJywgYm9yZGVyQ29sbGFwc2U6ICdjb2xsYXBzZScsIHRleHRBbGlnbjogJ2xlZnQnIH19PlxuICAgICAgICAgICAgICAgICAgICAgICAgPHRoZWFkIHN0eWxlPXt7IGJhY2tncm91bmRDb2xvcjogJ3ZhcigtLWJnLXRlcnRpYXJ5KScsIGNvbG9yOiAndmFyKC0tdGV4dC1zZWNvbmRhcnkpJywgZm9udFNpemU6ICcwLjc1cmVtJywgdGV4dFRyYW5zZm9ybTogJ3VwcGVyY2FzZScgfX0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRyPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGggc3R5bGU9e3sgcGFkZGluZzogJzFyZW0nLCB3aWR0aDogJzU0cHgnIH19PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeyFpc1JlYWRPbmx5ICYmIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8aW5wdXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVmPXtzZWxlY3RBbGxSZWZ9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJjaGVja2JveFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoZWNrZWQ9e2lzQWxsU2VsZWN0ZWR9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4gdG9nZ2xlU2VsZWN0QWxsSXRlbXMoZS50YXJnZXQuY2hlY2tlZCl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGg+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0aCBzdHlsZT17eyBwYWRkaW5nOiAnMXJlbScgfX0+eydcXHU5NmY2XFx1NGVmNlxcdTg2NWZcXHU3OGJjJ30gKElEKTwvdGg+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0aCBzdHlsZT17eyBwYWRkaW5nOiAnMXJlbScgfX0+eydcXHU4ZWNhXFx1NTc4Yid9IC8geydcXHU1ZTc0XFx1NGVmZCd9PC90aD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRoIHN0eWxlPXt7IHBhZGRpbmc6ICcxcmVtJyB9fT57J1xcdTU0YzFcXHU1NDBkJ30gLyB7J1xcdTg5OGZcXHU2ODNjJ308L3RoPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGggc3R5bGU9e3sgcGFkZGluZzogJzFyZW0nIH19PnsnXFx1NTRjMVxcdTcyNGMnfTwvdGg+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0aCBzdHlsZT17eyBwYWRkaW5nOiAnMXJlbScsIHdpZHRoOiAnODBweCcsIHRleHRBbGlnbjogJ2NlbnRlcicgfX0+eydcXHU1ZWFiXFx1NWI1OCd9PC90aD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRoIHN0eWxlPXt7IHBhZGRpbmc6ICcxcmVtJywgd2lkdGg6ICcxMDBweCcgfX0+eydcXHU2NTc4XFx1OTFjZid9PC90aD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRoIHN0eWxlPXt7IHBhZGRpbmc6ICcxcmVtJywgd2lkdGg6ICcxMjBweCcgfX0+eydcXHU1NWFlXFx1NTBmOSd9PC90aD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRoIHN0eWxlPXt7IHBhZGRpbmc6ICcxcmVtJywgd2lkdGg6ICcxMjBweCcgfX0+eydcXHU1YzBmXFx1OGEwOCd9PC90aD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRoIHN0eWxlPXt7IHBhZGRpbmc6ICcxcmVtJywgd2lkdGg6ICc1MHB4JyB9fT48L3RoPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L3RoZWFkPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHRib2R5IHJlZj17aXRlbVRib2R5UmVmfT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7ZG9jLml0ZW1zLm1hcCgoaXRlbSwgaWR4KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZpbmQgYXNzb2NpYXRlZCBwcm9kdWN0IG1ldGFkYXRhIGlmIGV4aXN0cyAodG8gc2hvdyBhcHBsaWNhYmlsaXR5IGxpbmspXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGFzc29jaWF0ZWRQcm9kdWN0ID0gaXRlbS5fZnVsbF9wcm9kdWN0IHx8IHByb2R1Y3RzLmZpbmQocCA9PiBwLnBfaWQgPT09IGl0ZW0ucF9pZCB8fCAoaXRlbS5wYXJ0X251bWJlciAmJiAocC5wYXJ0X251bWJlciA9PT0gaXRlbS5wYXJ0X251bWJlciB8fCBwLnBhcnRfbnVtYmVycz8uc29tZShwbiA9PiBwbi5wYXJ0X251bWJlciA9PT0gaXRlbS5wYXJ0X251bWJlcikpKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG1hcHBpbmdDb3VudCA9IGFzc29jaWF0ZWRQcm9kdWN0Py5wYXJ0X251bWJlcnM/Lmxlbmd0aCB8fCAwO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRpc3BsYXlDYXJNb2RlbCA9IGl0ZW0uY2FyX21vZGVsIHx8IChhc3NvY2lhdGVkUHJvZHVjdCA/IHByb2R1Y3RMaW5lQ2FyTW9kZWwoYXNzb2NpYXRlZFByb2R1Y3QpIDogJy0nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGlzcGxheVllYXIgPSBpdGVtLnllYXIgfHwgKGFzc29jaWF0ZWRQcm9kdWN0ID8gcHJvZHVjdExpbmVZZWFyKGFzc29jaWF0ZWRQcm9kdWN0KSA6ICctJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRpc3BsYXlOYW1lID0gaXRlbS5uYW1lIHx8IGFzc29jaWF0ZWRQcm9kdWN0Py5uYW1lIHx8ICctJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGlzcGxheVNwZWMgPSBpdGVtLnNwZWMgfHwgYXNzb2NpYXRlZFByb2R1Y3Q/LnNwZWNpZmljYXRpb25zIHx8ICctJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGlzcGxheUJyYW5kID0gaXRlbS5icmFuZCB8fCBhc3NvY2lhdGVkUHJvZHVjdD8uYnJhbmQgfHwgKGFzc29jaWF0ZWRQcm9kdWN0Py5wYXJ0X251bWJlcnM/LlswXT8uYnJhbmQpIHx8ICctJztcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5PXtpZHh9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YS1kb2MtaXRlbS1yb3ctaWR4PXtpZHh9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGFiSW5kZXg9eyFpc1JlYWRPbmx5ID8gLTEgOiB1bmRlZmluZWR9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYm9yZGVyQm90dG9tOiAnMXB4IHNvbGlkIHZhcigtLWJvcmRlci1jb2xvciknLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb250U2l6ZTogJzAuODVyZW0nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6ICghaXNSZWFkT25seSAmJiBhY3RpdmVJdGVtSW5kZXggPT09IGlkeCkgPyAndmFyKC0tYmctdGVydGlhcnkpJyA6IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KGV2KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghaXNSZWFkT25seSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0QWN0aXZlSXRlbUluZGV4KGlkeCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBldi5jdXJyZW50VGFyZ2V0LmZvY3VzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBzdHlsZT17eyBwYWRkaW5nOiAnMXJlbScsIHRleHRBbGlnbjogJ2NlbnRlcicgfX0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHshaXNSZWFkT25seSAmJiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8aW5wdXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwiY2hlY2tib3hcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoZWNrZWQ9e3NlbGVjdGVkSW5kZXhlcy5pbmNsdWRlcyhpZHgpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4gdG9nZ2xlSXRlbVNlbGVjdGlvbihpZHgsIGUudGFyZ2V0LmNoZWNrZWQpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBzdHlsZT17eyBwYWRkaW5nOiAnMXJlbScgfX0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgY29sb3I6ICcjNjBhNWZhJywgZm9udFdlaWdodDogODAwLCBmb250RmFtaWx5OiAnbW9ub3NwYWNlJyB9fT57aXRlbS5wYXJ0X251bWJlciB8fCBpdGVtLnBfaWR9PC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgZm9udFNpemU6ICcwLjdyZW0nLCBjb2xvcjogJ3ZhcigtLXRleHQtbXV0ZWQpJyB9fT57aXRlbS5wX2lkICE9PSBpdGVtLnBhcnRfbnVtYmVyID8gaXRlbS5wX2lkIDogKGFzc29jaWF0ZWRQcm9kdWN0Py5wX2lkIHx8ICcnKX08L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge21hcHBpbmdDb3VudCA+IDAgJiYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlPXt7IG10OiAnNHB4JywgZm9udFNpemU6ICcxMHB4JywgYmFja2dyb3VuZENvbG9yOiAndmFyKC0tYmctdGVydGlhcnkpJywgcGFkZGluZzogJzJweCA2cHgnLCBib3JkZXJSYWRpdXM6ICc0cHgnLCBjb2xvcjogJyM2MGE1ZmEnLCBjdXJzb3I6ICdwb2ludGVyJywgZGlzcGxheTogJ2lubGluZS1ibG9jaycsIGJvcmRlcjogJzFweCBzb2xpZCB2YXIoLS1ib3JkZXItY29sb3IpJyB9fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eyhlKSA9PiB7IGUuc3RvcFByb3BhZ2F0aW9uKCk7IHNldE1hcHBpbmdQcm9kdWN0KGFzc29jaWF0ZWRQcm9kdWN0KTsgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAre21hcHBpbmdDb3VudH0geydcXHU5MDY5XFx1NzUyOCd9PC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQgc3R5bGU9e3sgcGFkZGluZzogJzFyZW0nIH19PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGZvbnRXZWlnaHQ6IDgwMCwgY29sb3I6ICd2YXIoLS10ZXh0LXByaW1hcnkpJyB9fT57ZGlzcGxheUNhck1vZGVsfTwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGZvbnRTaXplOiAnMC43NXJlbScsIGNvbG9yOiAndmFyKC0tdGV4dC1tdXRlZCknIH19PntkaXNwbGF5WWVhcn08L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBzdHlsZT17eyBwYWRkaW5nOiAnMXJlbScgfX0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgZm9udFdlaWdodDogODAwLCBjb2xvcjogJ3ZhcigtLXRleHQtcHJpbWFyeSknIH19PntkaXNwbGF5TmFtZX08L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBmb250U2l6ZTogJzAuNzVyZW0nLCBjb2xvcjogJ3ZhcigtLXRleHQtbXV0ZWQpJyB9fT57ZGlzcGxheVNwZWN9PC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQgc3R5bGU9e3sgcGFkZGluZzogJzFyZW0nIH19PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGZvbnRXZWlnaHQ6IDgwMCwgY29sb3I6ICd2YXIoLS10ZXh0LXByaW1hcnkpJyB9fT57ZGlzcGxheUJyYW5kfTwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkIHN0eWxlPXt7IHBhZGRpbmc6ICcxcmVtJywgdGV4dEFsaWduOiAnY2VudGVyJyB9fT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBmb250V2VpZ2h0OiA3MDAsIGZvbnRTaXplOiAnMC44NXJlbScsIGNvbG9yOiAoYXNzb2NpYXRlZFByb2R1Y3Q/LnN0b2NrID8/IGl0ZW0uc3RvY2sgPz8gMCkgPiAwID8gJyMxMGI5ODEnIDogJyNlZjQ0NDQnIH19PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2Fzc29jaWF0ZWRQcm9kdWN0Py5zdG9jayA/PyBpdGVtLnN0b2NrID8/ICctJ31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQgc3R5bGU9e3sgcGFkZGluZzogJzAuNXJlbSAxcmVtJyB9fT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGlucHV0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhLWRvYy1pdGVtLXF0eVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cIm51bWJlclwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaXNhYmxlZD17aXNSZWFkT25seX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXtpdGVtLnF0eX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXtlID0+IHVwZGF0ZUl0ZW0oaWR4LCAncXR5JywgcGFyc2VJbnQoZS50YXJnZXQudmFsdWUpKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uS2V5RG93bj17ZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGUua2V5ID09PSAnRW50ZXInKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9jdXNQcmljZUlucHV0KGlkeCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd2lkdGg6ICcxMDAlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYWRkaW5nOiAnMC40cmVtJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IGlzUmVhZE9ubHkgPyAndHJhbnNwYXJlbnQnIDogJ3ZhcigtLWJnLXRlcnRpYXJ5KScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYm9yZGVyOiBpc1JlYWRPbmx5ID8gJ25vbmUnIDogJzFweCBzb2xpZCB2YXIoLS1ib3JkZXItY29sb3IpJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBib3JkZXJSYWRpdXM6ICc0cHgnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yOiAndmFyKC0tdGV4dC1wcmltYXJ5KScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGV4dEFsaWduOiAnY2VudGVyJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBzdHlsZT17eyBwYWRkaW5nOiAnMC41cmVtIDFyZW0nIH19PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8aW5wdXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEtZG9jLWl0ZW0tcHJpY2VcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJudW1iZXJcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9e2lzUmVhZE9ubHl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17aXRlbS51bml0X3ByaWNlfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9e2UgPT4gdXBkYXRlSXRlbShpZHgsICd1bml0X3ByaWNlJywgcGFyc2VGbG9hdChlLnRhcmdldC52YWx1ZSkpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25LZXlEb3duPXtlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZS5rZXkgPT09ICdFbnRlcicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaWR4IDwgZG9jLml0ZW1zLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvY3VzUXR5SW5wdXQoaWR4ICsgMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRBY3RpdmVJdGVtSW5kZXgoaWR4ICsgMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhZGRQYXJ0QnRuUmVmLmN1cnJlbnQ/LmZvY3VzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aWR0aDogJzEwMCUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhZGRpbmc6ICcwLjRyZW0nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJhY2tncm91bmRDb2xvcjogaXNSZWFkT25seSA/ICd0cmFuc3BhcmVudCcgOiAndmFyKC0tYmctdGVydGlhcnkpJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBib3JkZXI6IGlzUmVhZE9ubHkgPyAnbm9uZScgOiAnMXB4IHNvbGlkIHZhcigtLWJvcmRlci1jb2xvciknLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJvcmRlclJhZGl1czogJzRweCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sb3I6ICd2YXIoLS10ZXh0LXByaW1hcnkpJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0ZXh0QWxpZ246ICdjZW50ZXInXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkIHN0eWxlPXt7IHBhZGRpbmc6ICcxcmVtJywgZm9udFdlaWdodDogODAwIH19PnsoaXRlbS5xdHkgKiBpdGVtLnVuaXRfcHJpY2UpLnRvTG9jYWxlU3RyaW5nKCl9PC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQgc3R5bGU9e3sgcGFkZGluZzogJzFyZW0nIH19PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IWlzUmVhZE9ubHkgJiYgPGJ1dHRvbiBvbkNsaWNrPXsoKSA9PiByZW1vdmVJdGVtKGlkeCl9IHN0eWxlPXt7IGNvbG9yOiAnI2VmNDQ0NCcsIGJvcmRlcjogJ25vbmUnLCBiYWNrZ3JvdW5kOiAnbm9uZScsIGN1cnNvcjogJ3BvaW50ZXInIH19PjxUcmFzaDIgc2l6ZT17MTZ9IC8+PC9idXR0b24+fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHshaXNSZWFkT25seSAmJiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0cj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBjb2xTcGFuPXsxMH0gc3R5bGU9e3sgcGFkZGluZzogJzFyZW0nIH19PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlZj17YWRkUGFydEJ0blJlZn1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0SXNQaWNrZXJPcGVuKHRydWUpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkZvY3VzPXsoKSA9PiBzZXRJc0FkZFBhcnRGb2N1c2VkKHRydWUpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkJsdXI9eygpID0+IHNldElzQWRkUGFydEZvY3VzZWQoZmFsc2UpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sb3I6ICcjM2I4MmY2JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJvcmRlcjogaXNBZGRQYXJ0Rm9jdXNlZCA/ICcycHggc29saWQgIzNiODJmNicgOiAnMXB4IGRhc2hlZCAjM2I4MmY2JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6IGlzQWRkUGFydEZvY3VzZWQgPyAncmdiYSg1OSwgMTMwLCAyNDYsIDAuMiknIDogJ3JnYmEoNTksIDEzMCwgMjQ2LCAwLjEpJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJveFNoYWRvdzogaXNBZGRQYXJ0Rm9jdXNlZCA/ICcwIDAgMCAzcHggcmdiYSg1OSwgMTMwLCAyNDYsIDAuMjUpJyA6ICdub25lJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpZHRoOiAnMTAwJScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYWRkaW5nOiAnMC41cmVtJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJvcmRlclJhZGl1czogJzZweCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJzb3I6ICdwb2ludGVyJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpc3BsYXk6ICdmbGV4JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGp1c3RpZnlDb250ZW50OiAnY2VudGVyJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFsaWduSXRlbXM6ICdjZW50ZXInLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2FwOiAnMC41cmVtJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvbnRXZWlnaHQ6IDcwMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG91dGxpbmU6ICdub25lJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyYW5zaXRpb246ICdib3JkZXIgMC4xNXMgZWFzZSwgYmFja2dyb3VuZCAwLjE1cyBlYXNlLCBib3gtc2hhZG93IDAuMTVzIGVhc2UnXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8UGx1cyBzaXplPXsxNn0gLz4geydcXHU2NWIwXFx1NTg5ZVxcdTk2ZjZcXHU0ZWY2J31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvdGJvZHk+XG4gICAgICAgICAgICAgICAgICAgIDwvdGFibGU+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgey8qIEZvb3RlciBTdW1tYXJ5ICovfVxuICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBwYWRkaW5nOiAnMXJlbSAycmVtJywgYmFja2dyb3VuZENvbG9yOiAndmFyKC0tYmctc2Vjb25kYXJ5KScsIGRpc3BsYXk6ICdmbGV4JywganVzdGlmeUNvbnRlbnQ6ICdmbGV4LWVuZCcsIGJvcmRlclRvcDogJzFweCBzb2xpZCB2YXIoLS1ib3JkZXItY29sb3IpJyB9fT5cbiAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6ICdmbGV4JywgZ2FwOiAnM3JlbScsIGFsaWduSXRlbXM6ICdjZW50ZXInIH19PlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6ICdmbGV4JywgZ2FwOiAnMS41cmVtJywgY29sb3I6ICd2YXIoLS10ZXh0LXNlY29uZGFyeSknLCBmb250U2l6ZTogJzAuOXJlbScgfX0+XG4gICAgICAgICAgICAgICAgICAgICAgICA8c3Bhbj57J1xcdTdlM2RcXHU5ODA1XFx1NjU3OCd9OiA8Yj57ZG9jLml0ZW1zLmxlbmd0aH08L2I+PC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4+eydcXHU3ZTNkXFx1NGVmNlxcdTY1NzgnfTogPGI+e2RvYy5pdGVtcy5yZWR1Y2UoKHN1bSwgaXRlbSkgPT4gc3VtICsgKGl0ZW0ucXR5IHx8IDApLCAwKX08L2I+PC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyB0ZXh0QWxpZ246ICdyaWdodCcgfX0+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGNvbG9yOiAndmFyKC0tdGV4dC1zZWNvbmRhcnkpJywgZm9udFNpemU6ICcwLjlyZW0nLCBtYXJnaW5Cb3R0b206ICcwLjI1cmVtJyB9fT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7J1xcdTY3MmFcXHU3YTA1XFx1NWMwZlxcdThhMDgnfToge2Zvcm1hdEFtb3VudChzdWJ0b3RhbCl9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgIHt2YXRFbmFibGVkICYmIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGNvbG9yOiAndmFyKC0tYWNjZW50LWhvdmVyKScsIGZvbnRTaXplOiAnMC45NXJlbScsIG1hcmdpbkJvdHRvbTogJzAuM3JlbScsIGZvbnRXZWlnaHQ6IDcwMCB9fT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgVkFUICh7TnVtYmVyKHZhdFJhdGUgfHwgMCkudG9GaXhlZCgyKX0lKToge2Zvcm1hdEFtb3VudCh2YXRBbW91bnQpfSAoeydcXHU3YTA1XFx1OTg0ZCd9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgZm9udFNpemU6ICcxLjhyZW0nLCBmb250V2VpZ2h0OiA5MDAsIGNvbG9yOiAndmFyKC0td2FybmluZyknIH19PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHt2YXRFbmFibGVkID8gJ1xcdTU0MmJcXHU3YTA1XFx1N2UzZFxcdThhMDgnIDogJ1xcdTY3MmFcXHU3YTA1XFx1N2UzZFxcdThhMDgnfSAoe2RvYy5jdXJyZW5jeX0pOiB7Zm9ybWF0QW1vdW50KGdyYW5kVG90YWwpfVxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgIHsvKiBQcm9kdWN0IFBpY2tlciBPdmVybGF5ICovfVxuICAgICAgICAgICAge2lzUGlja2VyT3BlbiAmJiAoXG4gICAgICAgICAgICAgICAgPGRpdlxuICAgICAgICAgICAgICAgICAgICByb2xlPVwiZGlhbG9nXCJcbiAgICAgICAgICAgICAgICAgICAgZGF0YS1kb2MtcGlja2VyLXpvbmVcbiAgICAgICAgICAgICAgICAgICAgc3R5bGU9e3sgcG9zaXRpb246ICdmaXhlZCcsIGluc2V0OiAwLCBiYWNrZ3JvdW5kQ29sb3I6ICdyZ2JhKDAsIDAsIDAsIDAuNTUpJywgekluZGV4OiAxMDAwLCBkaXNwbGF5OiAnZmxleCcsIGZsZXhEaXJlY3Rpb246ICdjb2x1bW4nLCBwYWRkaW5nOiAnMS41cmVtJyB9fVxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBkaXNwbGF5OiAnZmxleCcsIGp1c3RpZnlDb250ZW50OiAnc3BhY2UtYmV0d2VlbicsIGFsaWduSXRlbXM6ICdjZW50ZXInLCBtYXJnaW5Cb3R0b206ICcxcmVtJyB9fT5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgZGlzcGxheTogJ2ZsZXgnLCBhbGlnbkl0ZW1zOiAnY2VudGVyJywgZ2FwOiAnMC43NXJlbScgfX0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPFBhY2thZ2Ugc2l6ZT17MjR9IHN0eWxlPXt7IGNvbG9yOiAnIzNiODJmNicgfX0gLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8aDIgc3R5bGU9e3sgZm9udFNpemU6ICcxLjVyZW0nLCBmb250V2VpZ2h0OiA4MDAgfX0+eydcXHU3NTIyXFx1NTRjMVxcdThjYzdcXHU2NTk5XFx1NGUyZFxcdTVmYzMnfTwvaDI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b24gb25DbGljaz17KCkgPT4gc2V0SXNQaWNrZXJPcGVuKGZhbHNlKX0gc3R5bGU9e3sgYmFja2dyb3VuZDogJyNlZjQ0NDQnLCBjb2xvcjogJ3doaXRlJywgYm9yZGVyOiAnbm9uZScsIHBhZGRpbmc6ICcwLjVyZW0gMXJlbScsIGJvcmRlclJhZGl1czogJzRweCcsIGN1cnNvcjogJ3BvaW50ZXInLCBmb250V2VpZ2h0OiA2MDAgfX0+W1hdIHsnXFx1OTVkY1xcdTk1ODknfTwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICAgICAgICB7LyogU2VhcmNoIFBhbmVsICovfVxuICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGJhY2tncm91bmQ6ICd2YXIoLS1iZy1zZWNvbmRhcnkpJywgcGFkZGluZzogJzEuMjVyZW0nLCBib3JkZXJSYWRpdXM6ICcxMnB4JywgYm9yZGVyOiAnMXB4IHNvbGlkIHZhcigtLWJvcmRlci1jb2xvciknLCBtYXJnaW5Cb3R0b206ICcxcmVtJywgYm94U2hhZG93OiAnMCA0cHggNnB4IC0xcHggcmdiYSgwLCAwLCAwLCAwLjEpJyB9fT5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxmb3JtIHJlZj17cGlja2VyRm9ybVJlZn0gb25TdWJtaXQ9eyhlKSA9PiBlLnByZXZlbnREZWZhdWx0KCl9IG9uS2V5RG93bj17aGFuZGxlUGlja2VyRm9ybUtleURvd259IHN0eWxlPXt7IGRpc3BsYXk6ICdmbGV4JywgZmxleFdyYXA6ICd3cmFwJywgZ2FwOiAnMC43NXJlbScsIGFsaWduSXRlbXM6ICdmbGV4LWVuZCcsIG92ZXJmbG93OiAndmlzaWJsZScsIHBhZGRpbmdCb3R0b206ICcwLjE1cmVtJyB9fT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlZj17cGlja2VyUmVzZXRCdG5SZWZ9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXtoYW5kbGVDbGVhclBpY2tlcn1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPXtzdHlsZXMuc2VhcmNoUmVzZXRCdG59XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlPXt7IGJhY2tncm91bmQ6ICd2YXIoLS1iZy10ZXJ0aWFyeSknLCBjb2xvcjogJ3ZhcigtLXRleHQtcHJpbWFyeSknLCBib3JkZXI6ICcxcHggc29saWQgdmFyKC0tYm9yZGVyLWNvbG9yKScsIHBhZGRpbmc6ICcwIDEycHgnLCBib3JkZXJSYWRpdXM6ICc4cHgnLCBmb250V2VpZ2h0OiA2MDAsIGRpc3BsYXk6ICdmbGV4JywgYWxpZ25JdGVtczogJ2NlbnRlcicsIGp1c3RpZnlDb250ZW50OiAnY2VudGVyJywgY3Vyc29yOiAncG9pbnRlcicsIGhlaWdodDogJzM2cHgnLCBmbGV4U2hyaW5rOiAwIH19XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlPXsnXFx1OTFjZFxcdThhMmRcXHU2ODlkXFx1NGVmNid9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8Um90YXRlQ2N3IHNpemU9ezE2fSAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgZGF0YS1waWNrZXItZmllbGQ9XCIwXCIgc3R5bGU9e3sgZGlzcGxheTogJ2ZsZXgnLCBmbGV4RGlyZWN0aW9uOiAnY29sdW1uJywgbWluV2lkdGg6ICcxMjBweCcsIGZsZXg6IDEgfX0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxsYWJlbCBzdHlsZT17eyBmb250U2l6ZTogJzAuNzVyZW0nLCBmb250V2VpZ2h0OiA2MDAsIGNvbG9yOiAndmFyKC0tdGV4dC1zZWNvbmRhcnkpJywgbWFyZ2luQm90dG9tOiAnMC40NXJlbScsIHdoaXRlU3BhY2U6ICdub3dyYXAnIH19PnsnXFx1OTZmNlxcdTRlZjZcXHU4NjVmXFx1NzhiYyd9IChQYXJ0IE5vLik8L2xhYmVsPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8aW5wdXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlZj17cGlja2VyRmlyc3RJbnB1dFJlZn1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJ0ZXh0XCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPXsnXFx1OGYzOFxcdTUxNjVcXHU5NWRjXFx1OTM3NVxcdTViNTcnfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e3BpY2tlclF1ZXJ5LnBhcnROdW1iZXJ9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17ZSA9PiBzZXRQaWNrZXJRdWVyeSh7IC4uLnBpY2tlclF1ZXJ5LCBwYXJ0TnVtYmVyOiBlLnRhcmdldC52YWx1ZSB9KX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlPXt7IHBhZGRpbmc6ICc4cHggMTJweCcsIGJhY2tncm91bmQ6ICd2YXIoLS1iZy10ZXJ0aWFyeSknLCBib3JkZXI6ICcxcHggc29saWQgdmFyKC0tYm9yZGVyLWNvbG9yKScsIGJvcmRlclJhZGl1czogJzhweCcsIGNvbG9yOiAndmFyKC0tdGV4dC1wcmltYXJ5KScsIHdpZHRoOiAnMTAwJScsIGZvbnRTaXplOiAnMC44NXJlbScgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgZGF0YS1waWNrZXItZmllbGQ9XCIxXCIgc3R5bGU9e3sgZGlzcGxheTogJ2ZsZXgnLCBmbGV4RGlyZWN0aW9uOiAnY29sdW1uJywgbWluV2lkdGg6ICcxMzBweCcsIGZsZXg6IDEgfX0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxsYWJlbCBzdHlsZT17eyBmb250U2l6ZTogJzAuNzVyZW0nLCBmb250V2VpZ2h0OiA2MDAsIGNvbG9yOiAndmFyKC0tdGV4dC1zZWNvbmRhcnkpJywgbWFyZ2luQm90dG9tOiAnMC40NXJlbScsIHdoaXRlU3BhY2U6ICdub3dyYXAnIH19PnsnXFx1OGVjYVxcdTU3OGInfTwvbGFiZWw+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxBdXRvY29tcGxldGVJbnB1dFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e3BpY2tlclF1ZXJ5Lm1vZGVsfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyh2YWwpID0+IHNldFBpY2tlclF1ZXJ5KHsgLi4ucGlja2VyUXVlcnksIG1vZGVsOiB2YWwgfSl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcj17J1xcdThmMzhcXHU1MTY1XFx1NjQxY1xcdTVjMGInfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YT17bW9kZWxzfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsdGVyS2V5PVwic2hvcnRoYW5kXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsS2V5PVwiZnVsbG5hbWVcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcGFjdD17dHJ1ZX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgZGF0YS1waWNrZXItZmllbGQ9XCIyXCIgc3R5bGU9e3sgZGlzcGxheTogJ2ZsZXgnLCBmbGV4RGlyZWN0aW9uOiAnY29sdW1uJywgbWluV2lkdGg6ICcxMzBweCcsIGZsZXg6IDEgfX0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxsYWJlbCBzdHlsZT17eyBmb250U2l6ZTogJzAuNzVyZW0nLCBmb250V2VpZ2h0OiA2MDAsIGNvbG9yOiAndmFyKC0tdGV4dC1zZWNvbmRhcnkpJywgbWFyZ2luQm90dG9tOiAnMC40NXJlbScsIHdoaXRlU3BhY2U6ICdub3dyYXAnIH19PnsnXFx1NTRjMVxcdTU0MGQnfTwvbGFiZWw+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxBdXRvY29tcGxldGVJbnB1dFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e3BpY2tlclF1ZXJ5LnBhcnR9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KHZhbCkgPT4gc2V0UGlja2VyUXVlcnkoeyAuLi5waWNrZXJRdWVyeSwgcGFydDogdmFsIH0pfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9eydcXHU4ZjM4XFx1NTE2NVxcdTY0MWNcXHU1YzBiJ31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE9e3BhcnRzfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsdGVyS2V5PVwic2hvcnRoYW5kXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsS2V5PVwiZnVsbG5hbWVcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcGFjdD17dHJ1ZX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgZGF0YS1waWNrZXItZmllbGQ9XCIzXCIgc3R5bGU9e3sgZGlzcGxheTogJ2ZsZXgnLCBmbGV4RGlyZWN0aW9uOiAnY29sdW1uJywgbWluV2lkdGg6ICc5MHB4JywgZmxleDogMSB9fT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGxhYmVsIHN0eWxlPXt7IGZvbnRTaXplOiAnMC43NXJlbScsIGZvbnRXZWlnaHQ6IDYwMCwgY29sb3I6ICd2YXIoLS10ZXh0LXNlY29uZGFyeSknLCBtYXJnaW5Cb3R0b206ICcwLjQ1cmVtJywgd2hpdGVTcGFjZTogJ25vd3JhcCcgfX0+eydcXHU4OThmXFx1NjgzYyd9PC9sYWJlbD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGlucHV0IHR5cGU9XCJ0ZXh0XCIgcGxhY2Vob2xkZXI9eydDQ1xcdTYyMTZcXHU4OThmXFx1NjgzYyd9IHZhbHVlPXtwaWNrZXJRdWVyeS5zcGVjfSBvbkNoYW5nZT17ZSA9PiBzZXRQaWNrZXJRdWVyeSh7IC4uLnBpY2tlclF1ZXJ5LCBzcGVjOiBlLnRhcmdldC52YWx1ZSB9KX0gc3R5bGU9e3sgcGFkZGluZzogJzhweCAxMnB4JywgYmFja2dyb3VuZDogJ3ZhcigtLWJnLXRlcnRpYXJ5KScsIGJvcmRlcjogJzFweCBzb2xpZCB2YXIoLS1ib3JkZXItY29sb3IpJywgYm9yZGVyUmFkaXVzOiAnOHB4JywgY29sb3I6ICd2YXIoLS10ZXh0LXByaW1hcnkpJywgd2lkdGg6ICcxMDAlJywgZm9udFNpemU6ICcwLjg1cmVtJyB9fSAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBkYXRhLXBpY2tlci1maWVsZD1cIjRcIiBzdHlsZT17eyBkaXNwbGF5OiAnZmxleCcsIGZsZXhEaXJlY3Rpb246ICdjb2x1bW4nLCBtaW5XaWR0aDogJzgwcHgnLCBmbGV4OiAxIH19PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8bGFiZWwgc3R5bGU9e3sgZm9udFNpemU6ICcwLjc1cmVtJywgZm9udFdlaWdodDogNjAwLCBjb2xvcjogJ3ZhcigtLXRleHQtc2Vjb25kYXJ5KScsIG1hcmdpbkJvdHRvbTogJzAuNDVyZW0nLCB3aGl0ZVNwYWNlOiAnbm93cmFwJyB9fT57J1xcdTVlNzRcXHU0ZWZkJ308L2xhYmVsPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8aW5wdXQgdHlwZT1cInRleHRcIiBwbGFjZWhvbGRlcj17J1xcdTRmOGJcXHU1OTgyIDE4LTIyJ30gdmFsdWU9e3BpY2tlclF1ZXJ5LnllYXJ9IG9uQ2hhbmdlPXtlID0+IHNldFBpY2tlclF1ZXJ5KHsgLi4ucGlja2VyUXVlcnksIHllYXI6IGUudGFyZ2V0LnZhbHVlIH0pfSBzdHlsZT17eyBwYWRkaW5nOiAnOHB4IDEycHgnLCBiYWNrZ3JvdW5kOiAndmFyKC0tYmctdGVydGlhcnkpJywgYm9yZGVyOiAnMXB4IHNvbGlkIHZhcigtLWJvcmRlci1jb2xvciknLCBib3JkZXJSYWRpdXM6ICc4cHgnLCBjb2xvcjogJ3ZhcigtLXRleHQtcHJpbWFyeSknLCB3aWR0aDogJzEwMCUnLCBmb250U2l6ZTogJzAuODVyZW0nIH19IC8+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGRhdGEtcGlja2VyLWZpZWxkPVwiNVwiIHN0eWxlPXt7IGRpc3BsYXk6ICdmbGV4JywgZmxleERpcmVjdGlvbjogJ2NvbHVtbicsIG1pbldpZHRoOiAnMTEwcHgnLCBmbGV4OiAxIH19PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8bGFiZWwgc3R5bGU9e3sgZm9udFNpemU6ICcwLjc1cmVtJywgZm9udFdlaWdodDogNjAwLCBjb2xvcjogJ3ZhcigtLXRleHQtc2Vjb25kYXJ5KScsIG1hcmdpbkJvdHRvbTogJzAuNDVyZW0nLCB3aGl0ZVNwYWNlOiAnbm93cmFwJyB9fT57J1xcdTU0YzFcXHU3MjRjJ308L2xhYmVsPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8QXV0b2NvbXBsZXRlSW5wdXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlPXtwaWNrZXJRdWVyeS5icmFuZH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsodmFsKSA9PiBzZXRQaWNrZXJRdWVyeSh7IC4uLnBpY2tlclF1ZXJ5LCBicmFuZDogdmFsIH0pfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9eydcXHU4ZjM4XFx1NTE2NVxcdTY0MWNcXHU1YzBiJ31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE9e2JyYW5kc31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbHRlcktleT1cInNob3J0aGFuZFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYWJlbEtleT1cImZ1bGxuYW1lXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBhY3Q9e3RydWV9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Zvcm0+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgICAgICAgIDxEb2NQcm9kdWN0SGlzdG9yeURyYXdlclxuICAgICAgICAgICAgICAgICAgICAgICAgb3Blbj17aGlzdG9yeURyYXdlck9wZW59XG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNsb3NlPXsoKSA9PiBzZXRIaXN0b3J5RHJhd2VyT3BlbihmYWxzZSl9XG4gICAgICAgICAgICAgICAgICAgICAgICBmb2N1c1BJZD17ZG9jSGlzdG9yeUZvY3VzUElkfVxuICAgICAgICAgICAgICAgICAgICAvPlxuXG4gICAgICAgICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlZj17cGlja2VyTGlzdFJlZn1cbiAgICAgICAgICAgICAgICAgICAgICAgIHRhYkluZGV4PXswfVxuICAgICAgICAgICAgICAgICAgICAgICAgb25LZXlEb3duPXtoYW5kbGVQaWNrZXJMaXN0S2V5RG93bn1cbiAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlPXt7IGZsZXg6IDEsIG92ZXJmbG93WTogJ2F1dG8nLCBiYWNrZ3JvdW5kOiAndmFyKC0tYmctc2Vjb25kYXJ5KScsIGJvcmRlclJhZGl1czogJzEycHgnLCBib3JkZXI6ICcxcHggc29saWQgdmFyKC0tYm9yZGVyLWNvbG9yKScsIG91dGxpbmU6ICdub25lJyB9fVxuICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFkZGluZzogJzAuNzVyZW0gMXJlbScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJvcmRlckJvdHRvbTogJzFweCBzb2xpZCB2YXIoLS1ib3JkZXItY29sb3IpJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYmFja2dyb3VuZENvbG9yOiAndmFyKC0tYmctdGVydGlhcnkpJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGlzcGxheTogJ2ZsZXgnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBqdXN0aWZ5Q29udGVudDogJ3NwYWNlLWJldHdlZW4nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbGlnbkl0ZW1zOiAnY2VudGVyJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2FwOiAnMXJlbScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZsZXhTaHJpbms6IDBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17aGFuZGxlUGlja1NlbGVjdGVkUHJvZHVjdHN9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpc2FibGVkPXtzZWxlY3RlZFBpY2tlclByb2R1Y3RJZHMubGVuZ3RoID09PSAwfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYmFja2dyb3VuZDogc2VsZWN0ZWRQaWNrZXJQcm9kdWN0SWRzLmxlbmd0aCA9PT0gMCA/ICd2YXIoLS1iZy10ZXJ0aWFyeSknIDogJyNkYzI2MjYnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sb3I6IHNlbGVjdGVkUGlja2VyUHJvZHVjdElkcy5sZW5ndGggPT09IDAgPyAndmFyKC0tdGV4dC1tdXRlZCknIDogJ3doaXRlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJvcmRlcjogJ25vbmUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiAnOHB4JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhZGRpbmc6ICcwLjQ1cmVtIDAuODVyZW0nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9udFdlaWdodDogNzAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3Vyc29yOiBzZWxlY3RlZFBpY2tlclByb2R1Y3RJZHMubGVuZ3RoID09PSAwID8gJ25vdC1hbGxvd2VkJyA6ICdwb2ludGVyJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeydcXHU2Mjc5XFx1NmIyMVxcdTc4YmFcXHU4YThkXFx1NTNkNlxcdTU2ZGUnfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb250U2l6ZTogJzAuODEyNXJlbScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb250V2VpZ2h0OiA2MDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xvcjogJ3ZhcigtLXRleHQtc2Vjb25kYXJ5KScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aGl0ZVNwYWNlOiAnbm93cmFwJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcmlhLWxpdmU9XCJwb2xpdGVcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge3BpY2tlck1hdGNoVG90YWwgPiA1MFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPyBgXFx1NjQxY1xcdTVjMGJcXHU3ZDUwXFx1Njc5Y1xcdWZmMWFcXHU1MTcxICR7cGlja2VyTWF0Y2hUb3RhbH0gXFx1N2I0NlxcdWZmMDhcXHU5ODZmXFx1NzkzYVxcdTUyNGQgNTAgXFx1N2I0NlxcdWZmMDlgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IGBcXHU2NDFjXFx1NWMwYlxcdTdkNTBcXHU2NzljXFx1ZmYxYSR7cGlja2VyTWF0Y2hUb3RhbH0gXFx1N2I0NmB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8dGFibGUgc3R5bGU9e3sgd2lkdGg6ICcxMDAlJywgYm9yZGVyQ29sbGFwc2U6ICdjb2xsYXBzZScsIHRleHRBbGlnbjogJ2xlZnQnIH19PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0aGVhZCBzdHlsZT17eyBwb3NpdGlvbjogJ3N0aWNreScsIHRvcDogMCwgYmFja2dyb3VuZENvbG9yOiAndmFyKC0tYmctdGVydGlhcnkpJywgY29sb3I6ICd2YXIoLS10ZXh0LXNlY29uZGFyeSknLCBmb250U2l6ZTogJzAuNzVyZW0nIH19PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dHI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGggc3R5bGU9e3sgcGFkZGluZzogJzFyZW0nLCB3aWR0aDogJzQ4cHgnLCB0ZXh0QWxpZ246ICdjZW50ZXInIH19PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxpbnB1dFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWY9e3BpY2tlclNlbGVjdEFsbFJlZn1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImNoZWNrYm94XCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2hlY2tlZD17aXNQaWNrZXJBbGxTZWxlY3RlZH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiB0b2dnbGVQaWNrZXJTZWxlY3RBbGwoZS50YXJnZXQuY2hlY2tlZCl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGg+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGggc3R5bGU9e3sgcGFkZGluZzogJzFyZW0nIH19PnsnXFx1OTZmNlxcdTRlZjZcXHU4NjVmXFx1NzhiYyd9IChJRCk8L3RoPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRoIHN0eWxlPXt7IHBhZGRpbmc6ICcxcmVtJyB9fT57J1xcdThlY2FcXHU1NzhiJ30gLyB7J1xcdTVlNzRcXHU0ZWZkJ308L3RoPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRoIHN0eWxlPXt7IHBhZGRpbmc6ICcxcmVtJyB9fT57J1xcdTU0YzFcXHU1NDBkJ30gLyB7J1xcdTg5OGZcXHU2ODNjJ308L3RoPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRoIHN0eWxlPXt7IHBhZGRpbmc6ICcxcmVtJyB9fT57J1xcdTU0YzFcXHU3MjRjJ308L3RoPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRoIHN0eWxlPXt7IHBhZGRpbmc6ICcxcmVtJyB9fT57J1xcdTVlYWJcXHU1YjU4J308L3RoPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRoIHN0eWxlPXt7IHBhZGRpbmc6ICcxcmVtJyB9fT57J1xcdTU1YWVcXHU1MGY5J308L3RoPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRoIHN0eWxlPXt7IHBhZGRpbmc6ICcxcmVtJywgdGV4dEFsaWduOiAnY2VudGVyJyB9fT57J1xcdTY0Y2RcXHU0ZjVjJ308L3RoPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGhlYWQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRib2R5PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7cGlja2VyUmVzdWx0cy5tYXAoKHAsIGlkeCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcG5PYmogPSBwLnBhcnRfbnVtYmVycz8uWzBdIHx8IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaXNQdXJjaCA9IHR5cGUgPT09ICdwdXJjaGFzZScgfHwgdHlwZSA9PT0gJ3B1cmNoYXNlUmV0dXJuJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzQWN0aXZlID0gaWR4ID09PSBhY3RpdmVQaWNrZXJSb3dJbmRleDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleT17cC5wX2lkfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhLXBpY2tlci1yb3ctaWR4PXtpZHh9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBib3JkZXJCb3R0b206ICcxcHggc29saWQgdmFyKC0tYm9yZGVyLWNvbG9yKScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IGlzQWN0aXZlID8gJ3JnYmEoNTksIDEzMCwgMjQ2LCAwLjE1KScgOiB1bmRlZmluZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBzdHlsZT17eyBwYWRkaW5nOiAnMXJlbScsIHRleHRBbGlnbjogJ2NlbnRlcicgfX0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8aW5wdXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwiY2hlY2tib3hcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoZWNrZWQ9e3NlbGVjdGVkUGlja2VyUHJvZHVjdElkcy5pbmNsdWRlcyhwLnBfaWQpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b2dnbGVQaWNrZXJTZWxlY3Rpb24ocC5wX2lkLCBlLnRhcmdldC5jaGVja2VkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0QWN0aXZlUGlja2VyUm93SW5kZXgoaWR4KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHBpY2tlckxpc3RSZWYuY3VycmVudD8uZm9jdXMoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBzdHlsZT17eyBwYWRkaW5nOiAnMXJlbScgfX0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGNvbG9yOiAnIzYwYTVmYScsIGZvbnRXZWlnaHQ6IDgwMCwgZm9udEZhbWlseTogJ21vbm9zcGFjZScgfX0+e3BuT2JqLnBhcnRfbnVtYmVyIHx8IHAucGFydF9udW1iZXIgfHwgcC5wX2lkfTwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBmb250U2l6ZTogJzAuN3JlbScsIGNvbG9yOiAndmFyKC0tdGV4dC1tdXRlZCknIH19PntwLnBfaWR9PC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7KHAucGFydF9udW1iZXJzIHx8IFtdKS5sZW5ndGggPiAwICYmIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlPXt7IG10OiAnNHB4JywgZm9udFNpemU6ICcxMHB4JywgYmFja2dyb3VuZENvbG9yOiAndmFyKC0tYmctdGVydGlhcnkpJywgcGFkZGluZzogJzJweCA2cHgnLCBib3JkZXJSYWRpdXM6ICc0cHgnLCBjb2xvcjogJyM2MGE1ZmEnLCBjdXJzb3I6ICdwb2ludGVyJywgZGlzcGxheTogJ2lubGluZS1ibG9jaycsIGJvcmRlcjogJzFweCBzb2xpZCB2YXIoLS1ib3JkZXItY29sb3IpJyB9fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoZSkgPT4geyBlLnN0b3BQcm9wYWdhdGlvbigpOyBzZXRNYXBwaW5nUHJvZHVjdChwKTsgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICt7cC5wYXJ0X251bWJlcnMubGVuZ3RofSB7J1xcdTkwNjlcXHU3NTI4J31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0ZCBzdHlsZT17eyBwYWRkaW5nOiAnMXJlbScgfX0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGZvbnRXZWlnaHQ6IDgwMCwgY29sb3I6ICd2YXIoLS10ZXh0LXByaW1hcnkpJyB9fT57cHJvZHVjdExpbmVDYXJNb2RlbChwKSB8fCAnLSd9PC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGZvbnRTaXplOiAnMC43NXJlbScsIGNvbG9yOiAndmFyKC0tdGV4dC1tdXRlZCknIH19Pntwcm9kdWN0TGluZVllYXIocCkgfHwgJ1xcdTVlNzRcXHU0ZWZkXFx1NjcyYVxcdTc3ZTUnfTwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQgc3R5bGU9e3sgcGFkZGluZzogJzFyZW0nIH19PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBmb250V2VpZ2h0OiA4MDAsIGNvbG9yOiAndmFyKC0tdGV4dC1wcmltYXJ5KScgfX0+e3AubmFtZX08L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgc3R5bGU9e3sgZm9udFNpemU6ICcwLjc1cmVtJywgY29sb3I6ICd2YXIoLS10ZXh0LW11dGVkKScgfX0+e3Auc3BlY2lmaWNhdGlvbnMgfHwgJy0nfTwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQgc3R5bGU9e3sgcGFkZGluZzogJzFyZW0nIH19PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBmb250V2VpZ2h0OiA4MDAsIGNvbG9yOiAndmFyKC0tdGV4dC1wcmltYXJ5KScgfX0+e3AuYnJhbmQgfHwgcG5PYmouYnJhbmQgfHwgJy0nfTwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQgc3R5bGU9e3sgcGFkZGluZzogJzFyZW0nIH19PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBmb250V2VpZ2h0OiA3MDAsIGNvbG9yOiBwLnN0b2NrID4gMCA/ICcjMTBiOTgxJyA6ICcjZWY0NDQ0JyB9fT57cC5zdG9jayA/PyAwfTwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQgc3R5bGU9e3sgcGFkZGluZzogJzFyZW0nIH19PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBmb250V2VpZ2h0OiA4MDAgfX0+TlQkIHsoaXNQdXJjaCA/IHByb2R1Y3RQdXJjaGFzZVVuaXRQcmljZShwKSA6IHByb2R1Y3RTYWxlc1VuaXRQcmljZShwKSkudG9Mb2NhbGVTdHJpbmcoKX08L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC90ZD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRkIHN0eWxlPXt7IHBhZGRpbmc6ICcxcmVtJywgdGV4dEFsaWduOiAnY2VudGVyJyB9fT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBoYW5kbGVQaWNrUHJvZHVjdChwKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHlsZT17eyBiYWNrZ3JvdW5kQ29sb3I6ICcjM2I4MmY2JywgY29sb3I6ICd3aGl0ZScsIGJvcmRlcjogJ25vbmUnLCBwYWRkaW5nOiAnMC41cmVtIDFyZW0nLCBib3JkZXJSYWRpdXM6ICc0cHgnLCBjdXJzb3I6ICdwb2ludGVyJywgZm9udFNpemU6ICcwLjhyZW0nLCBmb250V2VpZ2h0OiA3MDAgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7J1xcdTkwNzhcXHU1M2Q2J31cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge3BpY2tlclJlc3VsdHMubGVuZ3RoID09PSAwICYmIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx0cj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8dGQgY29sU3Bhbj17OH0gc3R5bGU9e3sgdGV4dEFsaWduOiAnY2VudGVyJywgcGFkZGluZzogJzNyZW0nLCBjb2xvcjogJ3ZhcigtLXRleHQtbXV0ZWQpJyB9fSA+eydcXHU2N2U1XFx1NzEyMVxcdTdiMjZcXHU1NDA4XFx1OGNjN1xcdTY1OTknfTwvdGQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3RyPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdGJvZHk+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L3RhYmxlPlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICl9XG5cbiAgICAgICAgICAgIHttYXBwaW5nUHJvZHVjdCAmJiAoXG4gICAgICAgICAgICAgICAgPFBhcnRNYXBwaW5nTW9kYWxcbiAgICAgICAgICAgICAgICAgICAgcHJvZHVjdD17bWFwcGluZ1Byb2R1Y3R9XG4gICAgICAgICAgICAgICAgICAgIG9uQ2xvc2U9eygpID0+IHNldE1hcHBpbmdQcm9kdWN0KG51bGwpfVxuICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICApfVxuICAgICAgICAgICAge2lzVmlld2VyT3BlbiAmJiAoXG4gICAgICAgICAgICAgICAgPERvY3VtZW50Vmlld2VyXG4gICAgICAgICAgICAgICAgICAgIGRvYz17ZG9jfVxuICAgICAgICAgICAgICAgICAgICB0eXBlPXt0eXBlfVxuICAgICAgICAgICAgICAgICAgICBvbkNsb3NlPXtoYW5kbGVDbG9zZVZpZXdlckFuZEZvY3VzUHJpbnR9XG4gICAgICAgICAgICAgICAgICAgIG9uRWRpdD17KCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2V0SXNWaWV3ZXJPcGVuKGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjYW5FZGl0VGhpc0RvY1R5cGUpIHNldElzUmVhZE9ubHkoZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICApfVxuICAgICAgICA8L2Rpdj5cbiAgICApO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgRG9jdW1lbnRFZGl0b3JQYWdlO1xuIl0sImZpbGUiOiJEOi9PbmVEcml2ZS9ZVEVDL0FJLUdlcm5hdGVkL0VSUC1BdXRvUGFydHMtVjEzL3NyYy9wYWdlcy9Eb2N1bWVudHMvRG9jdW1lbnRFZGl0b3JQYWdlLmpzeCJ9