export type StaffRole = "staff" | "admin";
export type RoundStatus = "planned" | "open" | "closed" | "cancelled";

export type StaffProfile = {
  id: string;
  displayName: string;
  department: string | null;
  role: StaffRole;
};

export type MenuCategory = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

export type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceCents: number;
  isAvailable: boolean;
  sortOrder: number;
};

export type OrderingRound = {
  id: string;
  title: string;
  vendorName: string;
  orderDate: string;
  cutoffAt: string;
  status: RoundStatus;
  acceptingOrders: boolean;
};

export type OrderLine = {
  id: string;
  menuItemId: string | null;
  itemName: string;
  unitPriceCents: number;
  quantity: number;
  note: string | null;
};

export type StaffOrder = {
  id: string;
  userId: string;
  staffName: string;
  department: string | null;
  status: "submitted" | "cancelled";
  note: string | null;
  totalCents: number;
  updatedAt: string;
  lines: OrderLine[];
};

export type DashboardData = {
  profile: StaffProfile;
  categories: MenuCategory[];
  menuItems: MenuItem[];
  activeRound: OrderingRound | null;
  recentRounds: OrderingRound[];
  orders: StaffOrder[];
};

export type ActionResult = {
  ok: boolean;
  message: string;
};

export type SaveOrderInput = {
  roundId: string;
  note: string;
  items: Array<{ itemId: string; quantity: number; note: string }>;
};
