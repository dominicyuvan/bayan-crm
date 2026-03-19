import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatOMR(value: number | null | undefined) {
  const num = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-OM", {
    style: "currency",
    currency: "OMR",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(num);
}

export function whatsappLink(phone: string) {
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}`;
}

export async function fireConfetti() {
  const confetti = (await import("canvas-confetti")).default;

  // First burst
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#1C1C1E", "#52525B", "#2563EB", "#16A34A", "#D97706"],
  });

  // Second burst after 150ms
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ["#1C1C1E", "#16A34A", "#2563EB"],
    });
  }, 150);

  // Third burst
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ["#1C1C1E", "#16A34A", "#2563EB"],
    });
  }, 300);
}
