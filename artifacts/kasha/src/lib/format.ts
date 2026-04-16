import { format } from "date-fns";

export function formatPrice(paise: number): string {
  if (typeof paise !== "number" || isNaN(paise)) return "₹0.00";
  
  const rupees = paise / 100;
  
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(rupees);
}

export function formatDate(dateString: string): string {
  try {
    return format(new Date(dateString), "MMM d, yyyy");
  } catch (e) {
    return dateString;
  }
}
