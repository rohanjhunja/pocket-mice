export interface ActivityColor {
  name: string;
  text: string;
  bg: string;
  border: string;
  borderActive: string;
  bgActive: string;
  hover: string;
  rawHex: string;
  rawBg: string;
}

export const ACTIVITY_COLORS: ActivityColor[] = [
  {
    name: "indigo",
    text: "text-indigo-600",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    borderActive: "border-indigo-600",
    bgActive: "bg-indigo-600",
    hover: "hover:bg-indigo-100 hover:text-indigo-700",
    rawHex: "#4f46e5",
    rawBg: "#f5f3ff",
  },
  {
    name: "emerald",
    text: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    borderActive: "border-emerald-600",
    bgActive: "bg-emerald-600",
    hover: "hover:bg-emerald-100 hover:text-emerald-700",
    rawHex: "#059669",
    rawBg: "#ecfdf5",
  },
  {
    name: "amber",
    text: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    borderActive: "border-amber-600",
    bgActive: "bg-amber-600",
    hover: "hover:bg-amber-100 hover:text-amber-700",
    rawHex: "#d97706",
    rawBg: "#fffbeb",
  },
  {
    name: "rose",
    text: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-rose-200",
    borderActive: "border-rose-600",
    bgActive: "bg-rose-600",
    hover: "hover:bg-rose-100 hover:text-rose-700",
    rawHex: "#e11d48",
    rawBg: "#fff1f2",
  },
  {
    name: "violet",
    text: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-200",
    borderActive: "border-violet-600",
    bgActive: "bg-violet-600",
    hover: "hover:bg-violet-100 hover:text-violet-700",
    rawHex: "#7c3aed",
    rawBg: "#f5f3ff",
  },
  {
    name: "cyan",
    text: "text-cyan-600",
    bg: "bg-cyan-50",
    border: "border-cyan-200",
    borderActive: "border-cyan-600",
    bgActive: "bg-cyan-600",
    hover: "hover:bg-cyan-100 hover:text-cyan-700",
    rawHex: "#0891b2",
    rawBg: "#ecfeff",
  },
  {
    name: "orange",
    text: "text-orange-600",
    bg: "bg-orange-50",
    border: "border-orange-200",
    borderActive: "border-orange-600",
    bgActive: "bg-orange-600",
    hover: "hover:bg-orange-100 hover:text-orange-700",
    rawHex: "#ea580c",
    rawBg: "#fff7ed",
  },
];

export function getActivityColor(index: number): ActivityColor {
  const safeIndex = Math.max(0, index);
  return ACTIVITY_COLORS[safeIndex % ACTIVITY_COLORS.length];
}
