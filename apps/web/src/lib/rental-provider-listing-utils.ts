export { rentalListingSchema, rentalListingRow, rentalListingPatchRow } from "@/lib/rental-listing";
export const isRentalProviderUnverifiedError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String((error as { message?: string } | null)?.message || "");
  return message.includes("RENTAL_PROVIDER_UNVERIFIED");
};
