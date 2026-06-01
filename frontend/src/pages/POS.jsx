import React, { useState, useEffect, useRef } from "react";
import axiosInstance from "../api/axios";
import Swal from "sweetalert2";
import { useAuth } from "../context/AuthContext";
import ThermalReceipt from "../components/POS/ThermalReceipt";
import "./POS.css";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
  Sparkles,
  Printer,
  User,
  Wifi,
  WifiOff,
  FileText,
  ArrowLeftRight,
  HelpCircle,
  Keyboard,
  Coins,
  Check,
  CreditCard,
  Landmark,
} from "lucide-react";

// Web Audio API Sound Synthesizers for Hardware Scanners
const playSuccessBeep = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.06, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      audioCtx.currentTime + 0.12,
    );
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.12);
  } catch (e) {
    console.error("AudioContext failed:", e);
  }
};

const playErrorBeep = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(120, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      audioCtx.currentTime + 0.28,
    );
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.28);
  } catch (e) {
    console.error("AudioContext failed:", e);
  }
};

const POS = () => {
  const { shop } = useAuth();
  const isGstEnabled = shop?.gst_enabled !== 0 && shop?.gst_enabled !== false;

  // Catalog & Filter States
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(["All Products"]);
  const [selectedCategory, setSelectedCategory] = useState("All Products");
  const [suggestions, setSuggestions] = useState([]);

  // High-Speed Search States (Debounced)
  const [searchQuery, setSearchQuery] = useState("");
  const [dbSearchLoading, setDbSearchLoading] = useState(false);

  // Cart States
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [taxRate, setTaxRate] = useState(5);
  const [transactionMode, setTransactionMode] = useState("Sale");
  const [originalInvoice, setOriginalInvoice] = useState("");

  // CRM Customer States
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customerResults, setCustomerResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerRegister, setShowCustomerRegister] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");

  // Hold & Resume (Drafts) States
  const [drafts, setDrafts] = useState([]);
  const [showDraftsDrawer, setShowDraftsDrawer] = useState(false);
  const [draftLabel, setDraftLabel] = useState("");

  // Advanced Split Payment States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Split");
  const [cashAmount, setCashAmount] = useState("");
  const [cardAmount, setCardAmount] = useState("");
  const [upiAmount, setUpiAmount] = useState("");
  const [cashTendered, setCashTendered] = useState("");

  // Network Offline States
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueueLength, setOfflineQueueLength] = useState(0);

  // Processing States
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successReceipt, setSuccessReceipt] = useState(null);

  // Refs for Scanner Inputs
  const barcodeInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const customerTimeoutRef = useRef(null);

  // -------------------------------------------------------------
  // INITIALIZATIONS & NETWORK MONITORING
  // -------------------------------------------------------------
  useEffect(() => {
    fetchProducts();
    loadDrafts();
    checkOfflineQueue();
    focusBarcodeScanner();

    const handleOnline = () => {
      setIsOnline(true);
      triggerOfflineQueueSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const handleKeyDown = (e) => {
      if (e.key === "F2") {
        e.preventDefault();
        focusBarcodeScanner();
      } else if (e.key === "F4") {
        e.preventDefault();
        setShowDraftsDrawer((prev) => !prev);
      } else if (e.key === "F8") {
        e.preventDefault();
        if (cart.length > 0) {
          openSplitPaymentModal();
        } else {
          setErrorMsg("Cannot trigger payment. Cart is empty.");
        }
      } else if (e.key === "F10") {
        e.preventDefault();
        if (cart.length > 0) {
          if (showPaymentModal) {
            handleCheckoutSubmit();
          } else {
            openSplitPaymentModal();
          }
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeAllModals();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    cart,
    showPaymentModal,
    cashAmount,
    cardAmount,
    upiAmount,
    paymentMethod,
    selectedCustomer,
    appliedCoupon,
    discount,
    transactionMode,
  ]);

  // -------------------------------------------------------------
  // DEBOUNCED API SEARCH LOGIC
  // -------------------------------------------------------------
  const handleSearchQueryChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (!value.trim()) {
      setSuggestions([]);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(() => {
      triggerProductSearch(value);
    }, 200);
  };

  const triggerProductSearch = async (query) => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    try {
      setDbSearchLoading(true);
      setErrorMsg("");
      const response = await axiosInstance.get(
        `/products?q=${encodeURIComponent(query)}`,
      );
      setProducts(response.data);
      setSuggestions(response.data);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to query products catalog.");
    } finally {
      setDbSearchLoading(false);
    }
  };

  const handleCustomerPhoneChange = (e) => {
    const value = e.target.value;
    setCustomerSearchQuery(value);

    if (customerTimeoutRef.current) clearTimeout(customerTimeoutRef.current);

    if (!value) {
      setCustomerResults([]);
      return;
    }

    customerTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await axiosInstance.get(
          `/customers/search?phone=${value}`,
        );
        setCustomerResults(response.data);
      } catch (err) {
        console.error(err);
      }
    }, 300);
  };

  // -------------------------------------------------------------
  // BARCODE & SCANNER ACTIONS
  // -------------------------------------------------------------
  const handleBarcodeSubmit = async (e) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setErrorMsg("");
    try {
      const localMatch = products.find(
        (p) =>
          p.barcode === query || p.sku.toLowerCase() === query.toLowerCase(),
      );
      if (localMatch) {
        addToCart(localMatch);
        setSearchQuery("");
        setSuggestions([]);
        return;
      }

      const response = await axiosInstance.get(`/products/barcode/${query}`);
      addToCart(response.data);
      setSearchQuery("");
      setSuggestions([]);
      fetchProducts();
    } catch (err) {
      console.error(err);
      const isAlphanumericCode = /^[a-zA-Z0-9-]{4,30}$/.test(query);
      if (isAlphanumericCode && !query.includes(" ")) {
        playErrorBeep();
        setErrorMsg(
          `Product variant with Barcode/SKU "${query}" not found in catalog.`,
        );
        setSearchQuery("");
        setSuggestions([]);
        focusBarcodeScanner();
      } else {
        triggerProductSearch(query);
      }
    }
  };

  // -------------------------------------------------------------
  // HIGH-SPEED CART WORKSPACE ACTIONS
  // -------------------------------------------------------------
  const fetchProducts = async () => {
    try {
      const response = await axiosInstance.get("/products");
      setProducts(response.data);
      const uniqueCats = [
        "All Products",
        ...new Set(response.data.map((p) => p.category)),
      ];
      setCategories(uniqueCats);
    } catch (err) {
      setErrorMsg("Offline or unable to connect to product inventory.");
    }
  };

  const addToCart = (product) => {
    setErrorMsg("");
    setSuccessReceipt(null);

    const isExchangeReturn = transactionMode === "Return";
    const pName = product.product_name || product.name || "Unknown Garment";
    const pPrice = parseFloat(
      product.price !== undefined ? product.price : product.selling_price || 0,
    );
    const pStock = parseInt(
      product.stock !== undefined ? product.stock : product.stock_qty || 0,
    );

    if (!isExchangeReturn && pStock <= 0) {
      setErrorMsg(`Cannot sell "${pName}". Out of stock!`);
      playErrorBeep();
      return;
    }

    const hasManualQty = product.allow_manual_qty === 1 || product.allow_manual_qty === true;

    setCart((prevCart) => {
      const existingItem = prevCart.find(
        (item) =>
          item.productId === product.id && item.isReturn === isExchangeReturn,
      );

      if (existingItem) {
        if (!isExchangeReturn && existingItem.quantity >= pStock) {
          setErrorMsg(`Insufficient stock in hand. Only ${pStock} available.`);
          playErrorBeep();
          return prevCart;
        }
        playSuccessBeep();

        if (hasManualQty) {
          // If manual qty is enabled, shift cursor directly to that cart item's input field
          setTimeout(() => {
            const qtyInput = document.getElementById(`qty-input-${product.id}-${isExchangeReturn ? 'return' : 'sale'}`);
            if (qtyInput) {
              qtyInput.focus();
              qtyInput.select();
            }
          }, 80);
          return prevCart;
        }

        return prevCart.map((item) =>
          item.productId === product.id && item.isReturn === isExchangeReturn
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      } else {
        playSuccessBeep();

        if (hasManualQty) {
          // If manual qty is enabled, shift cursor directly to that cart item's input field
          setTimeout(() => {
            const qtyInput = document.getElementById(`qty-input-${product.id}-${isExchangeReturn ? 'return' : 'sale'}`);
            if (qtyInput) {
              qtyInput.focus();
              qtyInput.select();
            }
          }, 80);
        }

        return [
          ...prevCart,
          {
            productId: product.id,
            name: pName,
            sku: product.sku,
            color: product.color || "Standard",
            size: product.size || "Free Size",
            gst: parseFloat(product.gst_percentage || 12),
            price: pPrice,
            unit: product.unit || "Pcs",
            quantity: 1,
            maxStock: pStock,
            isReturn: isExchangeReturn,
            allowManualQty: hasManualQty,
          },
        ];
      }
    });

    if (!hasManualQty) {
      focusBarcodeScanner();
    }
  };

  const updateCartQty = (productId, isLineReturn, delta) => {
    setErrorMsg("");
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.productId === productId && item.isReturn === isLineReturn) {
            const currentQty = parseInt(item.quantity) || 0;
            const targetQty = currentQty + delta;
            if (targetQty <= 0) return null;
            if (!isLineReturn && targetQty > item.maxStock) {
              setErrorMsg(
                `Only ${item.maxStock} ${item.unit} available for "${item.name}".`,
              );
              return item;
            }
            return { ...item, quantity: targetQty };
          }
          return item;
        })
        .filter(Boolean);
    });
  };

  const handleDirectQtyEdit = (productId, isLineReturn, value) => {
    setErrorMsg("");
    const numericValue = value === "" ? "" : parseInt(value, 10);

    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.productId === productId && item.isReturn === isLineReturn) {
            if (numericValue === "") {
              return { ...item, quantity: "" };
            }
            if (isNaN(numericValue) || numericValue <= 0) {
              return { ...item, quantity: 1 };
            }
            if (!isLineReturn && numericValue > item.maxStock) {
              setErrorMsg(`Only ${item.maxStock} ${item.unit} available for "${item.name}".`);
              return { ...item, quantity: item.maxStock };
            }
            return { ...item, quantity: numericValue };
          }
          return item;
        })
        .filter(Boolean);
    });
  };

  const handleQtyBlur = (productId, isLineReturn, quantity) => {
    if (quantity === "" || isNaN(quantity) || quantity <= 0) {
      setCart((prevCart) =>
        prevCart.map((item) =>
          item.productId === productId && item.isReturn === isLineReturn
            ? { ...item, quantity: 1 }
            : item
        )
      );
    }
  };

  const removeCartItem = (productId, isLineReturn) => {
    setCart((prevCart) =>
      prevCart.filter(
        (item) =>
          !(item.productId === productId && item.isReturn === isLineReturn),
      ),
    );
  };

  // -------------------------------------------------------------
  // GST, DISCOUNTS & COUPON CALCULATORS
  // -------------------------------------------------------------
  const applyCouponCode = (e) => {
    e.preventDefault();
    const code = couponCode.trim().toUpperCase();
    if (!code) return;

    setErrorMsg("");
    const coupons = {
      SAVE10: { rate: 10, type: "Percentage" },
      FESTIVE20: { rate: 20, type: "Percentage" },
      WELCOME50: { rate: 50, type: "Flat" },
    };

    if (coupons[code]) {
      setAppliedCoupon({ code, ...coupons[code] });
      setCouponCode("");
    } else {
      setErrorMsg(`Invalid coupon code: "${code}"`);
    }
  };

  const removeCoupon = () => setAppliedCoupon(null);

  const computeTotals = () => {
    let subtotal = 0;
    let totalGstAmount = 0;

    cart.forEach((item) => {
      const itemQty = parseFloat(item.quantity) || 0;
      const lineCost = item.price * itemQty;
      const lineTotal = item.isReturn ? -lineCost : lineCost;
      subtotal += lineTotal;

      if (isGstEnabled) {
        const gstRate = parseFloat(item.gst || 12.0);
        const lineGst = (lineCost * gstRate) / (100 + gstRate);
        const lineGstSigned = item.isReturn ? -lineGst : lineGst;
        totalGstAmount += lineGstSigned;
      }
    });

    let discountAmount = parseFloat(discount) || 0;
    if (appliedCoupon) {
      if (appliedCoupon.type === "Percentage") {
        discountAmount += Math.max(0, subtotal * (appliedCoupon.rate / 100));
      } else {
        discountAmount += appliedCoupon.rate;
      }
    }

    const netPayable = Math.max(0, subtotal - discountAmount);
    const discountRatio = subtotal > 0 ? netPayable / subtotal : 1;
    const finalGst = totalGstAmount * discountRatio;
    const cgst = finalGst / 2;
    const sgst = finalGst / 2;

    return { subtotal, discountAmount, cgst, sgst, netPayable };
  };

  const totals = computeTotals();

  // -------------------------------------------------------------
  // SPLIT PAYMENTS
  // -------------------------------------------------------------
  const openSplitPaymentModal = () => {
    setErrorMsg("");
    setSuccessReceipt(null);
    setCashTendered("");

    const payable = totals.netPayable;
    if (paymentMethod === "Cash") {
      setCashAmount(payable.toString());
      setCardAmount("");
      setUpiAmount("");
    } else if (paymentMethod === "Card") {
      setCashAmount("");
      setCardAmount(payable.toString());
      setUpiAmount("");
    } else if (paymentMethod === "UPI") {
      setCashAmount("");
      setCardAmount("");
      setUpiAmount(payable.toString());
    } else {
      setCashAmount(payable.toString());
      setCardAmount("");
      setUpiAmount("");
    }

    setShowPaymentModal(true);
  };

  const handleSplitAmountChange = (method, val) => {
    if (method === "Cash") setCashAmount(val);
    else if (method === "Card") setCardAmount(val);
    else if (method === "UPI") setUpiAmount(val);
  };

  const remainingToSplit =
    totals.netPayable - ((parseFloat(cashAmount) || 0) + (parseFloat(cardAmount) || 0) + (parseFloat(upiAmount) || 0));
  const changeDue = cashTendered
    ? Math.max(0, parseFloat(cashTendered) - (parseFloat(cashAmount) || 0))
    : 0;

  // -------------------------------------------------------------
  // HOLD & RESUME DRAFTS
  // -------------------------------------------------------------
  const loadDrafts = () => {
    const stored = localStorage.getItem("textile_pos_drafts");
    if (stored) setDrafts(JSON.parse(stored));
  };

  const handleHoldInvoice = (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      setErrorMsg("Cannot hold an empty cart.");
      return;
    }

    const label =
      draftLabel.trim() ||
      `Draft #${drafts.length + 1} (${new Date().toLocaleTimeString()})`;
    const newDraft = {
      id: Date.now().toString(),
      label,
      cart: [...cart],
      customer: selectedCustomer,
      discount,
      appliedCoupon,
      timestamp: new Date().toLocaleString(),
    };

    const updated = [newDraft, ...drafts];
    localStorage.setItem("textile_pos_drafts", JSON.stringify(updated));
    setDrafts(updated);
    setCart([]);
    setSelectedCustomer(null);
    setDiscount(0);
    setAppliedCoupon(null);
    setDraftLabel("");
    setShowDraftsDrawer(false);
    setErrorMsg("");
  };

  const resumeDraft = (draft) => {
    setCart(draft.cart);
    setSelectedCustomer(draft.customer);
    setDiscount(draft.discount);
    setAppliedCoupon(draft.appliedCoupon);

    const updated = drafts.filter((d) => d.id !== draft.id);
    localStorage.setItem("textile_pos_drafts", JSON.stringify(updated));
    setDrafts(updated);
    setShowDraftsDrawer(false);
    setErrorMsg("");
  };

  const deleteDraft = async (draftId) => {
    const result = await Swal.fire({
      title: "Discard Draft?",
      text: "Are you sure you want to delete this parked sales draft?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#2563eb",
      cancelButtonColor: "#dc2626",
      confirmButtonText: "Yes, Discard",
      cancelButtonText: "Cancel",
      background: "#ffffff",
      color: "#0f172a"
    });

    if (result.isConfirmed) {
      const updated = drafts.filter((d) => d.id !== draftId);
      localStorage.setItem("textile_pos_drafts", JSON.stringify(updated));
      setDrafts(updated);
      
      Swal.fire({
        title: "Draft Cleared",
        text: "The draft check has been deleted.",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
        background: "#ffffff",
        color: "#0f172a"
      });
    }
  };

  // -------------------------------------------------------------
  // CRM CUSTOMER
  // -------------------------------------------------------------
  const selectCustomer = (cust) => {
    setSelectedCustomer(cust);
    setCustomerSearchQuery("");
    setCustomerResults([]);
  };

  const handleNewCustomerSubmit = async (e) => {
    e.preventDefault();
    const name = newCustomerName.trim();
    const phone = newCustomerPhone.trim();
    if (!name || !phone) return;

    try {
      setLoading(true);
      const response = await axiosInstance.post("/customers", {
        name,
        phone,
        email: newCustomerEmail.trim() || null,
      });
      setSelectedCustomer(response.data.customer);
      setShowCustomerRegister(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      setNewCustomerEmail("");
      setErrorMsg("");
    } catch (err) {
      setErrorMsg(
        err.response?.data?.message || "Failed to enroll new loyalty client.",
      );
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // CHECKOUT & OFFLINE QUEUE
  // -------------------------------------------------------------
  const handleCheckoutSubmit = async () => {
    if (cart.length === 0) return;

    if (paymentMethod === "Split" && Math.abs(remainingToSplit) > 0.05) {
      setErrorMsg(
        `Cannot checkout. Unallocated balance of ₹${remainingToSplit.toFixed(2)} remains.`,
      );
      return;
    }

    if (paymentMethod === "Credit" && !selectedCustomer) {
      setErrorMsg(
        "Cannot checkout. A customer profile is required for Credit transactions.",
      );
      return;
    }

    setErrorMsg("");
    setSuccessReceipt(null);
    setLoading(true);

    const payload = {
      items: cart.map((item) => ({
        productId: item.productId,
        quantity: parseInt(item.quantity, 10) || 1,
        isReturn: item.isReturn,
      })),
      discount: totals.discountAmount,
      couponCode: appliedCoupon?.code || null,
      cgstAmount: totals.cgst,
      sgstAmount: totals.sgst,
      netAmount: totals.netPayable,
      paymentMethod,
      cashAmount: paymentMethod === "Cash" ? totals.netPayable : (parseFloat(cashAmount) || 0),
      cardAmount: paymentMethod === "Card" ? totals.netPayable : (parseFloat(cardAmount) || 0),
      upiAmount: paymentMethod === "UPI" ? totals.netPayable : (parseFloat(upiAmount) || 0),
      transactionType: transactionMode,
      originalInvoiceNumber: originalInvoice || null,
      customerId: selectedCustomer?.id || null,
    };

    if (!isOnline) {
      processOfflineCheckout(payload);
      return;
    }

    try {
      const response = await axiosInstance.post("/orders", payload);

      setProducts((prevProducts) =>
        prevProducts.map((prod) => {
          const cartItem = cart.find((c) => c.productId === prod.id);
          if (cartItem) {
            return {
              ...prod,
              stock: cartItem.isReturn
                ? prod.stock + cartItem.quantity
                : prod.stock - cartItem.quantity,
            };
          }
          return prod;
        }),
      );

      setSuccessReceipt({
        ...response.data,
        items: [...cart],
        cgst: totals.cgst,
        sgst: totals.sgst,
        customerName: selectedCustomer?.name || "Walk-In Customer",
        cashier:
          JSON.parse(localStorage.getItem("textile_pos_user"))?.username ||
          "Cashier",
        timestamp: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        date: new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        cashPaid:
          paymentMethod === "Cash"
            ? parseFloat(cashTendered) || totals.netPayable
            : (parseFloat(cashAmount) || 0),
        changeDue: paymentMethod === "Cash" ? changeDue : 0,
      });

      setCart([]);
      setDiscount(0);
      setAppliedCoupon(null);
      setSelectedCustomer(null);
      setOriginalInvoice("");
      setCashTendered("");
      setShowPaymentModal(false);
    } catch (err) {
      console.error(err);
      setErrorMsg(
        err.response?.data?.message || "Online ledger submission failed.",
      );
    } finally {
      setLoading(false);
    }
  };

  const processOfflineCheckout = (payload) => {
    const queue = JSON.parse(
      localStorage.getItem("textile_pos_offline_queue") || "[]",
    );
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const simulatedInvoice = `OFF-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;

    queue.push({
      ...payload,
      simulatedInvoice,
      offlineTimestamp: new Date().toLocaleString(),
    });
    localStorage.setItem("textile_pos_offline_queue", JSON.stringify(queue));
    setOfflineQueueLength(queue.length);

    setSuccessReceipt({
      invoiceNumber: simulatedInvoice,
      totalAmount: totals.subtotal,
      discount: totals.discountAmount,
      netAmount: totals.netPayable,
      paymentMethod,
      transactionType: transactionMode,
      items: [...cart],
      cgst: totals.cgst,
      sgst: totals.sgst,
      customerName: selectedCustomer?.name || "Walk-In Customer (Offline)",
      cashier: "Offline Agent",
      timestamp: new Date().toLocaleTimeString(),
      date: new Date().toLocaleDateString(),
      cashPaid: cashAmount,
      changeDue: 0,
      isOfflineSaved: true,
    });

    setCart([]);
    setDiscount(0);
    setAppliedCoupon(null);
    setSelectedCustomer(null);
    setShowPaymentModal(false);
    setLoading(false);
  };

  const checkOfflineQueue = () => {
    const queue = JSON.parse(
      localStorage.getItem("textile_pos_offline_queue") || "[]",
    );
    setOfflineQueueLength(queue.length);
  };

  const triggerOfflineQueueSync = async () => {
    const queue = JSON.parse(
      localStorage.getItem("textile_pos_offline_queue") || "[]",
    );
    if (queue.length === 0) return;

    let processedCount = 0;
    for (const item of [...queue]) {
      try {
        await axiosInstance.post("/orders", item);
        processedCount++;
      } catch (err) {
        console.error("Failed to sync offline item", err);
      }
    }

    const remaining = queue.slice(processedCount);
    localStorage.setItem(
      "textile_pos_offline_queue",
      JSON.stringify(remaining),
    );
    setOfflineQueueLength(remaining.length);
    fetchProducts();
  };

  // Helpers
  const focusBarcodeScanner = () => {
    if (showPaymentModal || showCustomerRegister || showDraftsDrawer) return;
    if (barcodeInputRef.current) barcodeInputRef.current.focus();
  };

  const handleInputBlur = (e) => {
    if (showPaymentModal || showCustomerRegister || showDraftsDrawer) return;

    // Prevent focus-stealing if the cashier clicked on another input, select, textarea, or button
    const target = e?.relatedTarget;
    if (target) {
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || tag === "BUTTON") {
        return;
      }
    }

    setTimeout(() => {
      // Double check activeElement to prevent focus hijacking on keyboard navigation
      const active = document.activeElement;
      if (active) {
        const activeTag = active.tagName;
        if (activeTag === "INPUT" || activeTag === "SELECT" || activeTag === "TEXTAREA" || activeTag === "BUTTON") {
          return;
        }
      }
      focusBarcodeScanner();
    }, 150);
  };

  const closeAllModals = () => {
    setShowPaymentModal(false);
    setShowCustomerRegister(false);
    setShowDraftsDrawer(false);
  };

  // Map successReceipt → ThermalReceipt format
  const receiptOrder = successReceipt
    ? {
        invoice_number:
          successReceipt.invoiceNumber || successReceipt.invoice_number,
        created_at:
          successReceipt.createdAt || successReceipt.created_at || new Date(),
        total_amount:
          successReceipt.totalAmount || successReceipt.total_amount || 0,
        discount: successReceipt.discount || 0,
        cgst_amount: successReceipt.cgst || successReceipt.cgst_amount || 0,
        sgst_amount: successReceipt.sgst || successReceipt.sgst_amount || 0,
        net_amount: successReceipt.netAmount || successReceipt.net_amount || 0,
        payment_method:
          successReceipt.paymentMethod ||
          successReceipt.payment_method ||
          "Cash",
        cashier_name:
          successReceipt.cashier || successReceipt.cashier_name || "Admin",
        cash_amount:
          successReceipt.cashPaid ||
          successReceipt.cashAmount ||
          successReceipt.cash_amount ||
          0,
        card_amount:
          successReceipt.cardAmount || successReceipt.card_amount || 0,
        upi_amount: successReceipt.upiAmount || successReceipt.upi_amount || 0,
        change_due: successReceipt.changeDue || 0,
        customer: selectedCustomer
          ? {
              name: selectedCustomer.name,
              phone: selectedCustomer.phone,
              gst_number: selectedCustomer.gst_number,
            }
          : successReceipt.customer
            ? {
                name: successReceipt.customer.name,
                phone: successReceipt.customer.phone,
                gst_number: successReceipt.customer.gst_number,
              }
            : successReceipt.customerName
              ? {
                  name: successReceipt.customerName,
                  phone: successReceipt.customerPhone || "",
                }
              : null,
        items: successReceipt.items
          ? successReceipt.items.map((item) => ({
              product_name: item.name || item.product_name,
              quantity: item.quantity,
              price: item.price,
              gst: item.gst,
            }))
          : [],
      }
    : null;

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="fade-in pos-page-layout">
      <div className="d-print-none">
        {/* ── Network Status Banner ── */}
        <div
          className={`d-flex justify-content-between align-items-center mb-3 p-2 rounded-3 border ${isOnline ? "network-banner-online" : "network-banner-offline"}`}
        >
          <div className="d-flex align-items-center gap-2">
            {isOnline ? (
              <span className="badge bg-success rounded-pill font-heading d-flex align-items-center gap-1 px-2 py-1">
                <Wifi size={12} />
                <span>TERMINAL ONLINE</span>
              </span>
            ) : (
              <span
                className="badge rounded-pill font-heading d-flex align-items-center gap-1 px-2 py-1"
                style={{ backgroundColor: "#F59E0B", color: "#000" }}
              >
                <WifiOff size={12} />
                <span>OFFLINE STORAGE ACTIVE</span>
              </span>
            )}

            {offlineQueueLength > 0 && (
              <span
                className="text-danger fw-semibold"
                style={{ fontSize: "0.8rem" }}
              >
                ⚠️ {offlineQueueLength} invoices in offline buffer. Auto-sync
                will flush once internet resumes.
              </span>
            )}
          </div>

          {/* Transaction Mode Toggle */}
          <div className="d-flex p-1 bg-white rounded-pill border">
            <button
              type="button"
              className={`btn btn-sm font-heading fw-bold px-3 py-1 rounded-pill border-0 ${transactionMode === "Sale" ? "btn-primary text-white" : "bg-transparent text-dark"}`}
              style={{ fontSize: "0.78rem" }}
              onClick={() => {
                setTransactionMode("Sale");
                setErrorMsg("");
              }}
            >
              🛒 Billing Sale
            </button>
            <button
              type="button"
              className={`btn btn-sm font-heading fw-bold px-3 py-1 rounded-pill border-0 ${transactionMode === "Return" ? "bg-danger text-white" : "bg-transparent text-danger"}`}
              style={{ fontSize: "0.78rem" }}
              onClick={() => {
                setTransactionMode("Return");
                setErrorMsg("");
              }}
            >
              🔄 Return Mode
            </button>
          </div>
        </div>

        {/* ── POS Workspace Grid ── */}
        <div className="pos-container">
          {/* ════ LEFT: Product Catalogue ════ */}
          <div className="pos-catalogue">
            {/* Search + CRM Row */}
            <div className="premium-card p-3 mb-3">
              <div className="row g-3">
                {/* Barcode / Product Search */}
                <div className="col-12 col-md-6 position-relative">
                  <form onSubmit={handleBarcodeSubmit} className="input-group">
                    <span className="input-group-text bg-white border-end-0">
                      <Search size={18} className="text-muted" />
                    </span>
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      className="form-control border-start-0 ps-0"
                      placeholder="Scan barcode/SKU or type name..."
                      value={searchQuery}
                      onChange={handleSearchQueryChange}
                      onBlur={handleInputBlur}
                      autoComplete="off"
                    />
                    {dbSearchLoading && (
                      <span className="input-group-text bg-white border-start-0">
                        <span
                          className="spinner-border spinner-border-sm text-secondary"
                          role="status"
                        ></span>
                      </span>
                    )}
                  </form>

                  {/* Autocomplete Dropdown */}
                  {searchQuery && suggestions.length > 0 && (
                    <div className="pos-autocomplete-dropdown">
                      <div className="pos-autocomplete-header">
                        Search Suggestions ({suggestions.length})
                      </div>
                      {suggestions.map((p) => {
                        const isOutOfStock = p.stock <= 0;
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              addToCart(p);
                              setSearchQuery("");
                              setSuggestions([]);
                              focusBarcodeScanner();
                            }}
                            className={`pos-autocomplete-item ${isOutOfStock && transactionMode !== "Return" ? "opacity-50" : ""}`}
                          >
                            <div className="overflow-hidden me-2">
                              <h6
                                className="m-0 text-dark font-heading text-truncate"
                                style={{ fontSize: "0.85rem" }}
                              >
                                {p.product_name || p.name}
                              </h6>
                              <span
                                className="text-muted"
                                style={{ fontSize: "0.75rem" }}
                              >
                                SKU: <strong>{p.sku}</strong> · Size: {p.size} ·
                                Color: {p.color}
                              </span>
                            </div>
                            <div className="text-end flex-shrink-0">
                              <div
                                className="fw-bold text-primary"
                                style={{ fontSize: "0.9rem" }}
                              >
                                ₹
                                {parseFloat(p.price || p.selling_price).toFixed(
                                  2,
                                )}
                              </div>
                              <span
                                className={`badge ${isOutOfStock ? "bg-danger" : "bg-success bg-opacity-10 text-success"}`}
                                style={{ fontSize: "0.65rem" }}
                              >
                                {isOutOfStock
                                  ? "Out"
                                  : `${parseInt(p.stock)} Pcs`}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* CRM Customer Search */}
                <div className="col-12 col-md-6">
                  <div className="position-relative">
                    <div className="input-group">
                      <span className="input-group-text bg-white border-end-0">
                        <User size={18} className="text-muted" />
                      </span>
                      <input
                        type="text"
                        className="form-control border-start-0 ps-0"
                        placeholder="Search customer phone..."
                        value={
                          selectedCustomer
                            ? `${selectedCustomer.name} (${selectedCustomer.phone})`
                            : customerSearchQuery
                        }
                        onChange={handleCustomerPhoneChange}
                        disabled={!!selectedCustomer}
                      />
                      {selectedCustomer ? (
                        <button
                          className="btn btn-outline-danger"
                          onClick={() => setSelectedCustomer(null)}
                        >
                          Clear
                        </button>
                      ) : (
                        <button
                          className="btn btn-outline-primary"
                          onClick={() => setShowCustomerRegister(true)}
                        >
                          + New
                        </button>
                      )}
                    </div>

                    {customerResults.length > 0 && !selectedCustomer && (
                      <div
                        className="position-absolute top-100 start-0 w-100 bg-white border rounded-3 mt-1 shadow-lg overflow-hidden"
                        style={{ zIndex: 1050 }}
                      >
                        {customerResults.map((cust) => (
                          <div
                            key={cust.id}
                            onClick={() => selectCustomer(cust)}
                            className="p-3 border-bottom d-flex justify-content-between align-items-center"
                            style={{ cursor: "pointer" }}
                          >
                            <div>
                              <h6
                                className="m-0 text-dark font-heading"
                                style={{ fontSize: "0.85rem" }}
                              >
                                {cust.name}
                              </h6>
                              <span
                                className="text-muted"
                                style={{ fontSize: "0.75rem" }}
                              >
                                Phone: {cust.phone}
                              </span>
                            </div>
                            <span className="badge bg-primary rounded-pill">
                              {cust.loyalty_points} Points
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Return Mode Banner */}
            {transactionMode === "Return" && (
              <div className="return-mode-banner">
                <div className="d-flex align-items-center gap-2">
                  <ArrowLeftRight size={18} style={{ color: "#F59E0B" }} />
                  <span
                    className="font-heading fw-bold"
                    style={{ color: "#F59E0B", fontSize: "0.85rem" }}
                  >
                    EXCHANGE / REFUND MODE ACTIVE:
                  </span>
                  <span style={{ color: "#F59E0B", fontSize: "0.8rem" }}>
                    Scanned items will increment stock levels.
                  </span>
                </div>
                <input
                  type="text"
                  className="form-control form-control-sm w-25 border-warning bg-transparent text-dark"
                  placeholder="Original invoice #..."
                  value={originalInvoice}
                  onChange={(e) => setOriginalInvoice(e.target.value)}
                />
              </div>
            )}

            {/* Category Pills */}
            <div className="category-pill-container">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`premium-cat-pill ${selectedCategory === cat ? "active" : ""}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Product Touch Tiles */}
            <div className="pos-catalogue-grid-wrapper overflow-auto flex-grow-1 pe-1">
              <div className="touch-grid-container">
                {products
                  .filter(
                    (p) =>
                      selectedCategory === "All Products" ||
                      p.category === selectedCategory,
                  )
                  .map((product) => {
                    const isOutOfStock = product.stock <= 0;
                    const isLowStock = product.stock > 0 && product.stock < 10;

                    return (
                      <div
                        key={product.id}
                        onClick={() => addToCart(product)}
                        className={`premium-product-card ${isOutOfStock && transactionMode !== "Return" ? "opacity-50" : ""}`}
                      >
                        <div>
                          <div className="product-badge-row">
                            <span className="product-sku-tag">
                              {product.sku}
                            </span>
                            {isOutOfStock ? (
                              <span
                                className="badge bg-danger rounded-pill"
                                style={{ fontSize: "0.65rem" }}
                              >
                                Out
                              </span>
                            ) : isLowStock ? (
                              <span className="badge badge-low-stock px-2">
                                Low: {parseInt(product.stock)}
                              </span>
                            ) : (
                              <span
                                className="badge bg-success bg-opacity-10 text-success rounded-pill"
                                style={{ fontSize: "0.65rem" }}
                              >
                                {parseInt(product.stock)} Pcs
                              </span>
                            )}
                          </div>
                          <h6
                            className="product-title"
                            title={product.product_name || product.name}
                          >
                            {product.product_name || product.name}
                          </h6>
                          <div className="product-meta-row">
                            <span className="meta-pill">
                              {product.category}
                            </span>
                            <span className="meta-pill-dark">
                              {product.size} / {product.color}
                            </span>
                          </div>
                        </div>
                        <div className="product-footer-row">
                          <div>
                            <span className="product-price-value">
                              ₹
                              {parseFloat(
                                product.price !== undefined
                                  ? product.price
                                  : product.selling_price || 0,
                              ).toFixed(2)}
                            </span>
                            <span className="product-price-unit">/Pc</span>
                          </div>
                          <div className="product-tap-button">
                            <Plus size={12} strokeWidth={3} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* ════ RIGHT: Billing Cart Panel ════ */}
          <div className="pos-cart-sticky overflow-hidden">
            {/* Cart Header */}
            <div className="py-2 px-3 border-bottom d-flex align-items-center justify-content-between bg-light" style={{ minHeight: "50px" }}>
              <h6 className="m-0 font-heading fw-bold d-flex align-items-center gap-2 text-dark" style={{ fontSize: "0.95rem" }}>
                <ShoppingCart size={16} style={{ color: "#2563EB" }} />
                <span>Checkout Register</span>
              </h6>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 font-heading py-1 px-2"
                style={{ fontSize: "0.7rem" }}
                onClick={() => setShowDraftsDrawer(true)}
              >
                <FileText size={12} />
                <span>[F4] Hold/Resume</span>
              </button>
            </div>

            {/* Cart Items */}
            <div
              className="flex-grow-1 overflow-auto p-2 d-flex flex-column gap-2"
              style={{ backgroundColor: "#F8FAFC", minHeight: "180px" }}
            >
              {errorMsg && (
                <div
                  className="alert alert-danger p-2 rounded-3 d-flex align-items-center gap-2 border-0"
                  style={{ fontSize: "0.75rem" }}
                >
                  <AlertCircle size={14} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {cart.length === 0 ? (
                <div className="my-auto text-center py-5 px-3 text-muted d-flex flex-column align-items-center">
                  <div
                    style={{
                      width: "80px",
                      height: "80px",
                      marginBottom: "16px",
                    }}
                    className="swaying-hanger"
                  >
                    <svg
                      viewBox="0 0 64 64"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      stroke="#94A3B8"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M32 20C32 20 34 12 28 12C22 12 25 18 30 20.5" />
                      <path d="M32 20.5L8 38C8 38 7 39 9 39H55C57 39 56 38 56 38L32 20.5Z" />
                      <line
                        x1="16"
                        y1="39"
                        x2="48"
                        y2="39"
                        strokeDasharray="3 3"
                      />
                    </svg>
                  </div>
                  <h6
                    className="m-0 font-heading fw-bold text-dark mb-1"
                    style={{ fontSize: "0.9rem" }}
                  >
                    Register is Empty
                  </h6>
                  <p
                    className="text-muted mb-0"
                    style={{
                      fontSize: "0.75rem",
                      maxWidth: "240px",
                      lineHeight: "1.4",
                    }}
                  >
                    Scan a barcode{" "}
                    <kbd className="bg-light text-dark border px-1">F2</kbd> or
                    tap items in the catalog to build an invoice.
                  </p>
                </div>
              ) : (
                cart.map((item, index) => (
                  <div
                    key={`${item.productId}-${item.isReturn}-${index}`}
                    className="checkout-item-card"
                    style={{
                      borderLeft: item.isReturn
                        ? "4px solid #F59E0B"
                        : "4px solid #2563EB",
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-start">
                      <div className="overflow-hidden me-2">
                        <h6
                          className="m-0 font-heading fw-bold text-dark text-truncate"
                          style={{ fontSize: "0.85rem" }}
                        >
                          {item.name}
                        </h6>
                        <div
                          className="text-muted mt-1 d-flex flex-wrap gap-2"
                          style={{ fontSize: "0.7rem" }}
                        >
                          <span>
                            Color: <strong>{item.color}</strong>
                          </span>
                          <span>
                            Size: <strong>{item.size}</strong>
                          </span>
                          <span>
                            GST: <strong>{item.gst}%</strong>
                          </span>
                        </div>
                      </div>
                      {item.isReturn ? (
                        <span
                          className="badge rounded border px-2"
                          style={{
                            fontSize: "0.65rem",
                            backgroundColor: "rgba(245,158,11,0.08)",
                            borderColor: "rgba(245,158,11,0.2)",
                            color: "#D97706",
                            fontWeight: 600,
                          }}
                        >
                          Return
                        </span>
                      ) : (
                        <span
                          className="badge rounded px-2"
                          style={{
                            fontSize: "0.65rem",
                            backgroundColor: "rgba(37,99,235,0.08)",
                            color: "#2563EB",
                            fontWeight: 600,
                          }}
                        >
                          Sale
                        </span>
                      )}
                    </div>

                    <div className="d-flex justify-content-between align-items-center mt-1">
                      <div className="d-flex align-items-center gap-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary p-0 rounded-circle d-flex align-items-center justify-content-center"
                          style={{ width: "26px", height: "26px" }}
                          onClick={() =>
                            updateCartQty(item.productId, item.isReturn, -1)
                          }
                        >
                          <Minus size={11} strokeWidth={2.5} />
                        </button>
                        
                        <input
                          type="number"
                          id={`qty-input-${item.productId}-${item.isReturn ? 'return' : 'sale'}`}
                          className="form-control form-control-sm text-center fw-bold px-1"
                          style={{ width: "60px", height: "28px", fontSize: "0.85rem" }}
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            handleDirectQtyEdit(item.productId, item.isReturn, e.target.value)
                          }
                          onBlur={() =>
                            handleQtyBlur(item.productId, item.isReturn, item.quantity)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              e.target.blur();
                              focusBarcodeScanner();
                            }
                          }}
                        />

                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary p-0 rounded-circle d-flex align-items-center justify-content-center"
                          style={{ width: "26px", height: "26px" }}
                          onClick={() =>
                            updateCartQty(item.productId, item.isReturn, 1)
                          }
                        >
                          <Plus size={11} strokeWidth={2.5} />
                        </button>
                        <span
                          className="text-muted"
                          style={{ fontSize: "0.7rem" }}
                        >
                          × ₹{parseFloat(item.price).toFixed(2)}
                        </span>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <span
                          className="fw-bold font-heading text-dark"
                          style={{ fontSize: "0.85rem" }}
                        >
                          {item.isReturn ? "-" : ""}₹
                          {(item.price * (parseFloat(item.quantity) || 0)).toFixed(2)}
                        </span>
                        <button
                          type="button"
                          className="btn btn-link text-muted p-1 border-0"
                          onClick={() =>
                            removeCartItem(item.productId, item.isReturn)
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Loyalty Bar */}
            {selectedCustomer && (
              <div className="pos-loyalty-bar">
                <span className="text-primary fw-medium font-heading">
                  👤 Linked: {selectedCustomer.name}
                </span>
                <span className="badge bg-primary text-white">
                  Loyalty: {selectedCustomer.loyalty_points} Points
                </span>
              </div>
            )}

            {/* Coupon Bar */}
            {appliedCoupon && (
              <div className="pos-coupon-bar">
                <span className="text-success fw-medium font-heading d-flex align-items-center gap-1">
                  <Sparkles size={14} />
                  <span>Coupon Applied: {appliedCoupon.code}</span>
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-link text-danger border-0 p-0 font-heading fw-bold"
                  onClick={removeCoupon}
                  style={{ fontSize: "0.75rem" }}
                >
                  Remove
                </button>
              </div>
            )}

            {/* Totals Panel */}
            <div className="p-2 bg-white border-top">
              <div className="totals-summary-card">
                <div className="totals-row">
                  <span style={{ fontSize: "0.78rem" }}>
                    {isGstEnabled ? "Subtotal (Incl GST)" : "Subtotal"}
                  </span>
                  <span className="text-dark fw-bold" style={{ fontSize: "0.78rem" }}>
                    ₹{totals.subtotal.toFixed(2)}
                  </span>
                </div>

                {/* Side-by-Side Coupon & Discount Row */}
                <div className="row g-2 align-items-center my-0.5">
                  <div className="col-7">
                    <form onSubmit={applyCouponCode} className="input-group input-group-sm">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Coupon Code"
                        style={{ fontSize: "0.72rem", padding: "4px 8px" }}
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                      />
                      <button
                        type="submit"
                        className="btn btn-outline-secondary font-heading px-2"
                        disabled={!couponCode}
                        style={{ fontSize: "0.72rem" }}
                      >
                        Apply
                      </button>
                    </form>
                  </div>
                  <div className="col-5">
                    <div className="d-flex align-items-center gap-1 bg-light border rounded px-2" style={{ height: "31px" }}>
                      <span className="text-muted" style={{ fontSize: "0.68rem", whiteSpace: "nowrap" }}>
                        Disc:
                      </span>
                      <input
                        type="number"
                        className="form-control text-end fw-semibold border-0 bg-transparent p-0"
                        style={{ fontSize: "0.72rem", height: "100%", boxShadow: "none" }}
                        placeholder="₹0.00"
                        value={discount === 0 ? "" : discount}
                        onChange={(e) =>
                          setDiscount(Math.max(0, parseFloat(e.target.value) || 0))
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Single Row CGST & SGST */}
                {isGstEnabled && (
                  <div className="d-flex justify-content-between my-0.5" style={{ fontSize: "0.74rem", color: "#64748B" }}>
                    <span>CGST (2.5%): <strong>₹{totals.cgst.toFixed(2)}</strong></span>
                    <span>SGST (2.5%): <strong>₹{totals.sgst.toFixed(2)}</strong></span>
                  </div>
                )}

                <div className="net-payable-badge">
                  <span className="label" style={{ fontSize: "0.82rem" }}>Net Invoice</span>
                  <span className="amount" style={{ fontSize: "1.1rem" }}>
                    ₹{totals.netPayable.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Checkout CTA */}
            <div className="p-2 bg-light border-top">
              <button
                type="button"
                onClick={openSplitPaymentModal}
                disabled={cart.length === 0}
                className="btn glowing-gradient-btn w-100 py-2.5 font-heading d-flex align-items-center justify-content-center gap-2"
                style={{ fontSize: "0.9rem" }}
              >
                <Coins size={16} />
                <span>
                  COLLECT PAYMENTS [F8] (₹{totals.netPayable.toFixed(2)})
                </span>
              </button>

              <div className="pos-shortcut-legend mt-2 pt-1 border-top" style={{ fontSize: "0.68rem" }}>
                <span>F2 Scan</span>
                <span>F4 Hold</span>
                <span>F8 Split</span>
                <span>F10 Pay</span>
                <span>Esc Clear</span>
              </div>
            </div>
          </div>
        </div>

        {/* ════ MODALS & DRAWERS ════ */}

        {/* 1. Hold / Resume Drafts Drawer */}
        {showDraftsDrawer && (
          <div className="pos-drafts-drawer">
            <div className="d-flex align-items-center justify-content-between border-bottom pb-3 mb-4">
              <h5 className="m-0 font-heading fw-bold d-flex align-items-center gap-2 text-dark">
                <FileText size={20} className="text-primary" />
                <span>Hold / Resume Drafts</span>
              </h5>
              <button
                className="btn-close"
                onClick={() => setShowDraftsDrawer(false)}
              ></button>
            </div>

            {cart.length > 0 && (
              <form
                onSubmit={handleHoldInvoice}
                className="mb-4 p-3 bg-light rounded-3 border"
              >
                <label
                  className="form-label text-dark font-heading fw-semibold mb-1"
                  style={{ fontSize: "0.8rem" }}
                >
                  Hold Current Cart
                </label>
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Draft identifier/label..."
                    value={draftLabel}
                    onChange={(e) => setDraftLabel(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary font-heading"
                  >
                    Hold Invoice
                  </button>
                </div>
              </form>
            )}

            <h6
              className="font-heading text-secondary mb-3"
              style={{ fontSize: "0.8rem", fontWeight: 600 }}
            >
              SUSPENDED DRAFTS ({drafts.length})
            </h6>
            <div
              className="overflow-auto d-flex flex-column gap-2"
              style={{ maxHeight: "calc(100vh - 300px)" }}
            >
              {drafts.length === 0 ? (
                <div
                  className="text-center py-5 text-muted"
                  style={{ fontSize: "0.85rem" }}
                >
                  No held invoices in local cache.
                </div>
              ) : (
                drafts.map((d) => (
                  <div
                    key={d.id}
                    className="p-3 border rounded-3 bg-white shadow-sm d-flex justify-content-between align-items-center"
                  >
                    <div>
                      <h6
                        className="m-0 text-dark font-heading fw-bold"
                        style={{ fontSize: "0.85rem" }}
                      >
                        {d.label}
                      </h6>
                      <span
                        className="text-muted d-block mt-1"
                        style={{ fontSize: "0.7rem" }}
                      >
                        {d.timestamp} |{" "}
                        {d.cart.reduce((acc, c) => acc + c.quantity, 0)} Items
                      </span>
                    </div>
                    <div className="d-flex gap-2">
                      <button
                        onClick={() => resumeDraft(d)}
                        className="btn btn-sm btn-outline-primary font-heading"
                        style={{ fontSize: "0.75rem" }}
                      >
                        Resume
                      </button>
                      <button
                        onClick={() => deleteDraft(d.id)}
                        className="btn btn-sm btn-link text-danger border-0 p-1"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 2. Split Payment Modal */}
        {showPaymentModal && (
          <div className="pos-payment-overlay">
            <div className="pos-payment-modal">
              <div className="d-flex justify-content-between align-items-center border-bottom pb-3 mb-3">
                <h5 className="m-0 font-heading fw-bold text-dark d-flex align-items-center gap-2">
                  <Coins size={22} className="text-primary" />
                  <span>Split Payments Interface</span>
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowPaymentModal(false)}
                ></button>
              </div>

              <div className="payment-method-selector-grid">
                {["Split", "Cash", "Card", "UPI", "Credit"].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(m);
                      setErrorMsg("");
                      const payable = totals.netPayable;
                      if (m === "Cash") {
                        setCashAmount(payable.toString());
                        setCardAmount("");
                        setUpiAmount("");
                      } else if (m === "Card") {
                        setCashAmount("");
                        setCardAmount(payable.toString());
                        setUpiAmount("");
                      } else if (m === "UPI") {
                        setCashAmount("");
                        setCardAmount("");
                        setUpiAmount(payable.toString());
                      } else if (m === "Credit") {
                        setCashAmount("");
                        setCardAmount("");
                        setUpiAmount("");
                      } else {
                        setCashAmount(payable.toString());
                        setCardAmount("");
                        setUpiAmount("");
                      }
                    }}
                    className={`btn btn-sm py-2 px-1 border font-heading fw-bold ${paymentMethod === m ? "btn-primary text-white border-primary" : "bg-white text-dark"}`}
                    style={{ fontSize: "0.72rem", borderRadius: "8px" }}
                  >
                    {m === "Cash"
                      ? "💵 Cash"
                      : m === "Card"
                        ? "💳 Card"
                        : m === "UPI"
                          ? "📱 UPI"
                          : m === "Credit"
                            ? "🏦 Credit"
                            : "🔄 Split"}
                  </button>
                ))}
              </div>

              {paymentMethod === "Credit" && (
                <div
                  className="alert alert-warning p-2 rounded-3 mb-3"
                  style={{ fontSize: "0.8rem" }}
                >
                  {selectedCustomer ? (
                    <span>
                      🛍️ Credit sale will be charged to{" "}
                      <strong>{selectedCustomer.name}</strong>'s account.
                      Balance:{" "}
                      <strong>
                        ₹
                        {parseFloat(
                          selectedCustomer.credit_balance || 0,
                        ).toFixed(2)}
                      </strong>
                      .
                    </span>
                  ) : (
                    <span className="text-danger fw-semibold">
                      ⚠️ You must link a customer profile to complete a Credit
                      transaction.
                    </span>
                  )}
                </div>
              )}

              <div className="p-3 bg-light rounded-3 mb-3">
                <div className="row g-3">
                  <div className="col-12">
                    <label
                      className="form-label font-heading text-dark fw-bold mb-1"
                      style={{ fontSize: "0.8rem" }}
                    >
                      Cash Amount (₹)
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-white">
                        <Coins size={14} />
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="form-control text-end fw-bold"
                        value={cashAmount}
                        onChange={(e) =>
                          handleSplitAmountChange("Cash", e.target.value)
                        }
                        disabled={
                          paymentMethod !== "Split" && paymentMethod !== "Cash"
                        }
                      />
                    </div>
                  </div>
                  <div className="col-6">
                    <label
                      className="form-label font-heading text-dark fw-semibold mb-1"
                      style={{ fontSize: "0.8rem" }}
                    >
                      Card Amount (₹)
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-white">
                        <CreditCard size={14} />
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="form-control text-end"
                        value={cardAmount}
                        onChange={(e) =>
                          handleSplitAmountChange("Card", e.target.value)
                        }
                        disabled={
                          paymentMethod !== "Split" && paymentMethod !== "Card"
                        }
                      />
                    </div>
                  </div>
                  <div className="col-6">
                    <label
                      className="form-label font-heading text-dark fw-semibold mb-1"
                      style={{ fontSize: "0.8rem" }}
                    >
                      UPI Amount (₹)
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-white">
                        <Landmark size={14} />
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="form-control text-end"
                        value={upiAmount}
                        onChange={(e) =>
                          handleSplitAmountChange("UPI", e.target.value)
                        }
                        disabled={
                          paymentMethod !== "Split" && paymentMethod !== "UPI"
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 border-top border-bottom mb-3">
                <div
                  className="d-flex justify-content-between mb-2"
                  style={{ fontSize: "0.85rem" }}
                >
                  <span className="text-muted">Total Net Invoice Payable:</span>
                  <span className="fw-bold text-dark font-heading">
                    ₹{totals.netPayable.toFixed(2)}
                  </span>
                </div>
                {paymentMethod === "Split" ? (
                  <div
                    className="d-flex justify-content-between"
                    style={{ fontSize: "0.85rem" }}
                  >
                    <span className="text-muted">
                      Remaining Balance to Allocate:
                    </span>
                    <span
                      className={`fw-bold font-heading ${Math.abs(remainingToSplit) < 0.05 ? "text-success" : "text-danger"}`}
                    >
                      ₹{remainingToSplit.toFixed(2)}
                    </span>
                  </div>
                ) : (
                  paymentMethod === "Cash" && (
                    <div className="row g-2 align-items-center mt-2">
                      <div className="col-6">
                        <span
                          className="text-muted"
                          style={{ fontSize: "0.8rem" }}
                        >
                          Cash Tendered By Customer
                        </span>
                      </div>
                      <div className="col-6">
                        <input
                          type="text"
                          inputMode="decimal"
                          className="form-control form-control-sm text-end fw-bold text-success border-success"
                          placeholder={`₹${Math.ceil(totals.netPayable)}`}
                          value={cashTendered}
                          onChange={(e) => setCashTendered(e.target.value)}
                        />
                      </div>
                      {cashTendered && (
                        <div
                          className="d-flex justify-content-between mt-2"
                          style={{ fontSize: "0.75rem" }}
                        >
                          <span className="text-muted">
                            Refund Cash Change:
                          </span>
                          <span className="fw-bold text-success font-heading">
                            ₹{changeDue.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>

              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary flex-grow-1 font-heading"
                  onClick={() => setShowPaymentModal(false)}
                >
                  Go Back
                </button>
                <button
                  type="button"
                  className="btn glowing-gradient-btn flex-grow-1 font-heading"
                  onClick={handleCheckoutSubmit}
                  disabled={
                    loading ||
                    (paymentMethod === "Split" &&
                      Math.abs(remainingToSplit) > 0.05)
                  }
                >
                  {loading ? "Filing Sale..." : "[F10] Finalize checkout"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. Loyalty Customer Enrollment Modal */}
        {showCustomerRegister && (
          <div className="pos-payment-overlay">
            <form
              onSubmit={handleNewCustomerSubmit}
              className="pos-customer-modal"
            >
              <div className="d-flex justify-content-between align-items-center border-bottom pb-3 mb-4">
                <h5 className="m-0 font-heading fw-bold text-dark d-flex align-items-center gap-2">
                  <User size={20} className="text-primary" />
                  <span>Register Loyalty Customer</span>
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowCustomerRegister(false)}
                ></button>
              </div>

              <div className="mb-3">
                <label
                  className="form-label text-dark font-heading fw-semibold mb-1"
                  style={{ fontSize: "0.8rem" }}
                >
                  Full Name
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Anjali Varma"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3">
                <label
                  className="form-label text-dark font-heading fw-semibold mb-1"
                  style={{ fontSize: "0.8rem" }}
                >
                  Phone Number
                </label>
                <input
                  type="tel"
                  className="form-control"
                  placeholder="e.g. 9876543210"
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  required
                />
              </div>
              <div className="mb-4">
                <label
                  className="form-label text-dark font-heading fw-semibold mb-1"
                  style={{ fontSize: "0.8rem" }}
                >
                  Email (Optional)
                </label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="e.g. anjali@gmail.com"
                  value={newCustomerEmail}
                  onChange={(e) => setNewCustomerEmail(e.target.value)}
                />
              </div>

              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary flex-grow-1"
                  onClick={() => setShowCustomerRegister(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex-grow-1 font-heading fw-semibold"
                  style={{ backgroundColor: "#2563EB", borderColor: "#2563EB" }}
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 4. Thermal Receipt Preview Modal */}
        {successReceipt && (
          <div
            className="pos-payment-overlay align-items-start overflow-auto py-4 d-print-none"
            style={{ zIndex: 2000 }}
          >
            <div
              style={{ maxWidth: "380px", width: "100%", padding: "0 10px" }}
            >
              <ThermalReceipt
                order={receiptOrder}
                showControls={true}
                onClose={() => {
                  setSuccessReceipt(null);
                  focusBarcodeScanner();
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Hidden thermal print container */}
      {successReceipt && (
        <div className="d-none d-print-block">
          <ThermalReceipt order={receiptOrder} />
        </div>
      )}
    </div>
  );
};

export default POS;
