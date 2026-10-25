export type VendorWarehouseLocation = {
  state: string;
  city: string;
  address: string;
  zip: string;
  phone: string;
  stockNote: string;
  source: string;
};

/**
 * Customer/vendor-facing location data transcribed from
 * USCabinetDepotLocations.xlsx (supplied 2026 workbook).
 * This is location reference data; it is not a live inventory feed.
 */
export const US_CABINET_DEPOT_WAREHOUSES: VendorWarehouseLocation[] = [
  { state: "Georgia", city: "Norcross", address: "1950 North Norcross-Tucker Rd", zip: "30071", phone: "770-767-3800", stockNote: "500,000 sq. ft.; full assembly and modification services.", source: "USCabinetDepotLocations.xlsx" },
  { state: "Massachusetts", city: "Norton", address: "176 S. Washington Street", zip: "02766", phone: "844-660-9889", stockNote: "150,000 sq. ft.; assembly and modification services.", source: "USCabinetDepotLocations.xlsx" },
  { state: "Illinois", city: "Romeoville", address: "1077 W Taylor Rd", zip: "60446", phone: "770-767-3800", stockNote: "180,000 sq. ft.; assembly and modification services.", source: "USCabinetDepotLocations.xlsx" },
  { state: "Virginia", city: "Ashland", address: "11079 Success St, Suite 100", zip: "23005", phone: "844-660-9889", stockNote: "200,000 sq. ft.; assembly and modification services.", source: "USCabinetDepotLocations.xlsx" },
  { state: "Florida", city: "Coconut Creek", address: "6301 Lyons Rd", zip: "33073", phone: "770-767-3800", stockNote: "110,000 sq. ft.; light assembly services.", source: "USCabinetDepotLocations.xlsx" },
  { state: "California", city: "Fontana", address: "14874 Jurupa Ave", zip: "92337", phone: "844-660-9889", stockNote: "Stocks all Shakers and most Oxfords.", source: "USCabinetDepotLocations.xlsx" },
  { state: "Texas", city: "Houston", address: "10484 Greens Crossing Blvd", zip: "77038", phone: "844-660-9889", stockNote: "Stocks all Shakers, most Oxfords, and limited Frameless styles.", source: "USCabinetDepotLocations.xlsx" },
  { state: "Utah", city: "Lehi", address: "5125 W Hudson Wy, Suite 90", zip: "84043", phone: "844-660-9889", stockNote: "180,000 sq. ft.; warehouse pickup and shipping.", source: "USCabinetDepotLocations.xlsx" },
];

export const US_CABINET_DEPOT_AVAILABILITY_SOURCES = [
  "CA_Warehouse_Availability_V9.2026.pdf",
  "FL_Warehouse_Availability_V9.2026.pdf",
  "GA_Warehouse_Availability_V9.2026.pdf",
  "IL_Warehouse_Availability.pdf",
  "MA_Warehouse_Availability_V9.2026.pdf",
  "TX_Warehouse_Availability_V9.2026.pdf",
  "UT_Warehouse_Availability_V9.2026.pdf",
  "VA_Warehouse_Availability_V9.2026.pdf",
] as const;
