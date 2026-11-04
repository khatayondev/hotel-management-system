export type PaymentMethod = "CASH" | "MOBILE_MONEY" | "CARD" | "BANK_TRANSFER";

export interface PosPaymentSplitInput {
  method: PaymentMethod;
  amountPesewas: number;
  tenderedPesewas?: number; // For cash: total given by customer
  reference?: string; // MoMo transaction reference or card auth slip code
  provider?: string; // e.g. "MTN", "TELECEL", "AT", "VISA", "MASTERCARD"
  notes?: string;
}

export interface PosItemAddonInput {
  id: string;
  name: string;
  pricePesewas: number;
  durationMin: number;
}

export interface PosItemInput {
  serviceId: string;
  serviceName: string;
  pricePesewas: number;
  durationMin: number;
  staffId?: string;
  addOns?: PosItemAddonInput[];
}

export interface PosCheckoutInput {
  customerId?: string;
  // If quick creating customer
  customer?: {
    name: string;
    phone: string;
    email?: string;
    notes?: string;
  };
  staffId?: string;
  isWalkIn?: boolean; // "Now" walk-in vs scheduled
  scheduledStartUtc?: string; // ISO string if scheduled
  items: PosItemInput[];
  discountPercent?: number; // 0-100
  discountPesewas?: number;
  discountReason?: string;
  promoCode?: string;
  tipPesewas?: number;
  payments: PosPaymentSplitInput[];
  notes?: string;
}

export interface ReceiptSnapshotItem {
  serviceId: string;
  serviceName: string;
  pricePesewas: number;
  durationMin: number;
  addOns: PosItemAddonInput[];
  totalItemPesewas: number;
}

export interface ReceiptSnapshotPayment {
  method: PaymentMethod;
  amountPesewas: number;
  tenderedPesewas?: number;
  changePesewas?: number;
  reference?: string;
  provider?: string;
  notes?: string;
}

export interface PosReceiptDetail {
  id: string;
  receiptNumber: string;
  bookingId?: string | null;
  bookingReference?: string | null;
  customerId?: string | null;
  customerName: string;
  customerPhone: string;
  cashierId: string;
  cashierName: string;
  subtotalPesewas: number;
  discountPesewas: number;
  discountPercent?: number | null;
  discountReason?: string | null;
  promoCode?: string | null;
  tipPesewas: number;
  totalPesewas: number;
  amountPaidPesewas: number;
  changePesewas: number;
  balanceDuePesewas: number;
  status: "PAID" | "PARTIALLY_PAID" | "VOIDED";
  voidedAt?: string | null;
  voidReason?: string | null;
  voidedByName?: string | null;
  items: ReceiptSnapshotItem[];
  payments: ReceiptSnapshotPayment[];
  notes?: string | null;
  createdAt: string;
}

export interface EndOfDaySummary {
  date: string;
  totalSalesCount: number;
  totalRevenuePesewas: number;
  grossSubtotalPesewas: number;
  totalDiscountsPesewas: number;
  totalTipsPesewas: number;
  totalBalanceDuePesewas: number;
  methods: {
    cash: {
      totalCollectedPesewas: number;
      totalChangeGivenPesewas: number;
      netCashInDrawerPesewas: number;
      transactionCount: number;
    };
    mobileMoney: {
      totalCollectedPesewas: number;
      transactionCount: number;
      byProvider: Record<string, number>;
    };
    card: {
      totalCollectedPesewas: number;
      transactionCount: number;
      byProvider: Record<string, number>;
    };
  };
  voids: {
    count: number;
    totalVoidedPesewas: number;
    items: Array<{
      receiptNumber: string;
      totalPesewas: number;
      voidReason: string;
      voidedByName: string;
      voidedAt: string;
    }>;
  };
  staffTips: Array<{
    staffId: string;
    staffName: string;
    tipPesewas: number;
  }>;
}
