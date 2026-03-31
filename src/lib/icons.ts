import {
  // Housing
  Home, Building2, Key, Hammer, Sofa, Wrench,
  // Food & Drink
  Utensils, Coffee, Pizza, Wine, Beer, IceCream,
  // Transport
  Car, Bus, Plane, Bike, Truck,
  // Shopping
  ShoppingCart, ShoppingBag, Shirt, Package, Tag,
  // Health & Fitness
  Pill, Heart, Dumbbell, Activity, Baby,
  // Entertainment
  Gamepad2, Music, Tv, Headphones, Camera,
  // Education
  BookOpen, GraduationCap, BookMarked,
  // Personal
  Scissors, Sparkles, Watch,
  // Misc / Finance
  PiggyBank, Receipt, Gift, Globe, Leaf, PawPrint, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type { LucideIcon };

export const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  // Housing
  Home, Building2, Key, Hammer, Sofa, Wrench,
  // Food & Drink
  Utensils, Coffee, Pizza, Wine, Beer, IceCream,
  // Transport
  Car, Bus, Plane, Bike, Truck,
  // Shopping
  ShoppingCart, ShoppingBag, Shirt, Package, Tag,
  // Health & Fitness
  Pill, Heart, Dumbbell, Activity, Baby,
  // Entertainment
  Gamepad2, Music, Tv, Headphones, Camera,
  // Education
  BookOpen, GraduationCap, BookMarked,
  // Personal
  Scissors, Sparkles, Watch,
  // Misc / Finance
  PiggyBank, Receipt, Gift, Globe, Leaf, PawPrint, Zap,
};

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICON_MAP);

export const CATEGORY_ICON_GROUPS: { label: string; icons: string[] }[] = [
  { label: "Housing",         icons: ["Home", "Building2", "Key", "Hammer", "Sofa", "Wrench"] },
  { label: "Food & Drink",    icons: ["Utensils", "Coffee", "Pizza", "Wine", "Beer", "IceCream"] },
  { label: "Transport",       icons: ["Car", "Bus", "Plane", "Bike", "Truck"] },
  { label: "Shopping",        icons: ["ShoppingCart", "ShoppingBag", "Shirt", "Package", "Tag"] },
  { label: "Health",          icons: ["Pill", "Heart", "Dumbbell", "Activity", "Baby"] },
  { label: "Entertainment",   icons: ["Gamepad2", "Music", "Tv", "Headphones", "Camera"] },
  { label: "Education",       icons: ["BookOpen", "GraduationCap", "BookMarked"] },
  { label: "Personal",        icons: ["Scissors", "Sparkles", "Watch"] },
  { label: "Other",           icons: ["PiggyBank", "Receipt", "Gift", "Globe", "Leaf", "PawPrint", "Zap"] },
];

export const CATEGORY_COLORS = [
  "#0d9488", // teal
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#a855f7", // purple
  "#ec4899", // pink
  "#f43f5e", // rose
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#eab308", // yellow
  "#84cc16", // lime
  "#10b981", // emerald
  "#14b8a6", // cyan
  "#0ea5e9", // sky
  "#64748b", // slate
  "#d946ef", // fuchsia
];
