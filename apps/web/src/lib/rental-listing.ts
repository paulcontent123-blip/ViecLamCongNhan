import { z } from "zod";

export const rentalListingSchema = z.object({
  title: z.string().trim().min(5).max(160),
  description: z.string().trim().min(20).max(10000),
  monthlyRentVnd: z.number().int().min(0).max(1000000000),
  areaSqm: z.number().positive().max(10000).nullable().optional(),
  provinceCode: z.string().trim().min(1).max(32),
  location: z.string().trim().min(3).max(240),
  roomType: z.string().trim().max(80).optional(),
  capacity: z.number().int().positive().max(1000).nullable().optional(),
  nearbyIndustrialZone: z.string().trim().max(160).optional(),
  amenities: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
  photoUrls: z.array(z.string().url().startsWith("https://")).max(12).optional(),
});

export type RentalListingInput = z.infer<typeof rentalListingSchema>;

export function rentalListingRow(input: RentalListingInput) {
  return {
    title: input.title,
    description: input.description,
    monthly_rent_vnd: input.monthlyRentVnd,
    area_sqm: input.areaSqm ?? null,
    province_code: input.provinceCode,
    location: input.location,
    room_type: input.roomType || null,
    capacity: input.capacity ?? null,
    nearby_industrial_zone: input.nearbyIndustrialZone || null,
    amenities: input.amenities || [],
    photo_urls: input.photoUrls || [],
  };
}

export function rentalListingPatchRow(input: Partial<RentalListingInput>) {
  const fields = {
    title: "title",
    description: "description",
    monthlyRentVnd: "monthly_rent_vnd",
    areaSqm: "area_sqm",
    provinceCode: "province_code",
    location: "location",
    roomType: "room_type",
    capacity: "capacity",
    nearbyIndustrialZone: "nearby_industrial_zone",
    amenities: "amenities",
    photoUrls: "photo_urls",
  } as const;
  return Object.fromEntries(Object.entries(fields)
    .filter(([key]) => Object.prototype.hasOwnProperty.call(input, key))
    .map(([key, column]) => {
      const value = input[key as keyof RentalListingInput];
      if (key === "areaSqm" || key === "capacity") return [column, value ?? null];
      if (key === "roomType" || key === "nearbyIndustrialZone") return [column, value || null];
      if (key === "amenities" || key === "photoUrls") return [column, value || []];
      return [column, value];
    }));
}
