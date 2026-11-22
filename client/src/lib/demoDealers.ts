// ─── Demo distributor: sample dealers and the purchase gate ──────────────────
// Distributors sell only through dealers. In the demo designer, any attempt to
// buy (cart, checkout or order routes) opens a gate that recommends the
// nearest approved dealer and "sends" the plan there. Everything here is
// FICTIONAL sample data: invented business names, 555-01xx phone numbers and
// example.com email addresses. Nothing is sent anywhere.

export type DemoDealer = {
  id: string;
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  phone: string;
  email: string;
  hours: string;
};

export const DEMO_DEALERS: DemoDealer[] = [
  { id: "brindlewood", name: "Brindlewood Cabinet Studio", street: "1840 W Larkin Ave", city: "Chicago", state: "IL", zip: "60622", lat: 41.9022, lng: -87.6758, phone: "(312) 555-0101", email: "plans.brindlewood@example.com", hours: "Mon–Fri 8am–5pm, Sat 9am–1pm" },
  { id: "saltmarsh", name: "Saltmarsh Kitchen Works", street: "77 Quarry Landing", city: "Boston", state: "MA", zip: "02127", lat: 42.3334, lng: -71.0495, phone: "(617) 555-0102", email: "hello.saltmarsh@example.com", hours: "Mon–Fri 9am–6pm" },
  { id: "quillfield", name: "Quillfield Kitchen & Bath", street: "3105 Peachmont Pkwy", city: "Atlanta", state: "GA", zip: "30318", lat: 33.7865, lng: -84.4454, phone: "(404) 555-0103", email: "design.quillfield@example.com", hours: "Mon–Sat 9am–5pm" },
  { id: "tallowmere", name: "Tallowmere Cabinetry", street: "4620 Cedar Bend Dr", city: "Dallas", state: "TX", zip: "75219", lat: 32.8121, lng: -96.8143, phone: "(214) 555-0104", email: "quotes.tallowmere@example.com", hours: "Mon–Fri 7:30am–4:30pm" },
  { id: "larkspur", name: "Larkspur & Pine Kitchens", street: "960 Foothill Row", city: "Denver", state: "CO", zip: "80204", lat: 39.7341, lng: -105.0206, phone: "(303) 555-0105", email: "team.larkspur@example.com", hours: "Tue–Sat 9am–5pm" },
  { id: "corvane", name: "Corvane Home Cabinetry", street: "2255 E Sagebrush Rd", city: "Phoenix", state: "AZ", zip: "85016", lat: 33.5123, lng: -112.0302, phone: "(602) 555-0106", email: "info.corvane@example.com", hours: "Mon–Fri 8am–4pm, Sat 9am–12pm" },
  { id: "ferncliff", name: "Ferncliff Kitchen Design", street: "514 Tidewater Ave N", city: "Seattle", state: "WA", zip: "98109", lat: 47.6375, lng: -122.3456, phone: "(206) 555-0107", email: "studio.ferncliff@example.com", hours: "Mon–Fri 9am–5pm" },
  { id: "oakhollow", name: "Oakhollow Cabinet Gallery", street: "88 Riverstone Blvd", city: "Columbus", state: "OH", zip: "43215", lat: 39.9653, lng: -83.0049, phone: "(614) 555-0108", email: "gallery.oakhollow@example.com", hours: "Mon–Sat 10am–6pm" },
];

/** Pre-filled ZIP when the browser won't share a location (downtown Chicago). */
export const DEMO_DEFAULT_ZIP = "60601";

export type LatLng = { lat: number; lng: number };

/** A few exact ZIPs (the dealers' plus some large cities). */
const ZIP_POINTS: Record<string, LatLng> = {
  ...Object.fromEntries(DEMO_DEALERS.map((d) => [d.zip, { lat: d.lat, lng: d.lng }])),
  "60601": { lat: 41.8858, lng: -87.6229 },
  "10001": { lat: 40.7506, lng: -73.9972 },
  "90012": { lat: 34.0614, lng: -118.2385 },
  "94103": { lat: 37.7725, lng: -122.4147 },
  "33130": { lat: 25.7672, lng: -80.2041 },
  "77002": { lat: 29.7568, lng: -95.3624 },
  "55401": { lat: 44.9833, lng: -93.2683 },
  "63101": { lat: 38.6315, lng: -90.1922 },
  "37203": { lat: 36.1503, lng: -86.7915 },
  "97204": { lat: 45.5186, lng: -122.6767 },
};

/** Rough centre of each ZIP region (first digit), used when a ZIP isn't in the table. */
const ZIP_REGION_POINTS: Record<string, LatLng> = {
  "0": { lat: 42.4, lng: -71.8 }, // New England
  "1": { lat: 41.2, lng: -75.5 }, // NY, PA
  "2": { lat: 37.5, lng: -78.5 }, // DC, VA, Carolinas
  "3": { lat: 32.5, lng: -84.5 }, // GA, FL, AL, TN
  "4": { lat: 40.5, lng: -84.5 }, // OH, IN, MI, KY
  "5": { lat: 44.5, lng: -93.5 }, // MN, WI, IA, Dakotas
  "6": { lat: 39.5, lng: -92.0 }, // IL, MO, KS, NE
  "7": { lat: 32.5, lng: -96.5 }, // TX, OK, AR, LA
  "8": { lat: 38.5, lng: -108.0 }, // CO, AZ, UT, NV, NM
  "9": { lat: 39.0, lng: -121.0 }, // CA, OR, WA
};

export function normalizeZip(value: string): string | null {
  const zip = value.trim().slice(0, 5);
  return /^\d{5}$/.test(zip) ? zip : null;
}

export function zipToPoint(value: string): LatLng | null {
  const zip = normalizeZip(value);
  if (!zip) return null;
  return ZIP_POINTS[zip] ?? ZIP_REGION_POINTS[zip[0]] ?? null;
}

export function distanceMiles(a: LatLng, b: LatLng): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

export type DealerMatch = { dealer: DemoDealer; miles: number };

export function dealersByDistance(from: LatLng): DealerMatch[] {
  return DEMO_DEALERS.map((dealer) => ({ dealer, miles: distanceMiles(from, dealer) })).sort((a, b) => a.miles - b.miles);
}

export function nearestDealer(from: LatLng): DealerMatch {
  return dealersByDistance(from)[0];
}

export function formatMiles(miles: number): string {
  return miles < 10 ? `${miles.toFixed(1)} mi away` : `${Math.round(miles)} mi away`;
}

/**
 * Routes that would buy cabinets. While inside /distributor-preview the
 * designer shell catches navigation to these and opens the dealer gate.
 */
export function isDemoPurchasePath(to: string): boolean {
  const path = to.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return (
    /^\/(cart|checkout|order\/new|bulk-order)(\/|$)/.test(path) ||
    /^\/store\/[^/]+\/(cart|checkout)(\/|$)/.test(path)
  );
}

export const DEALER_GATE_COPY = {
  headline: "Sorry, but you can only buy cabinets from our approved dealers.",
  framing: "Design here, then get your price from an approved dealer near you.",
  locating: "Finding an approved dealer near you…",
  zipLabel: "Your ZIP code",
  zipButton: "Update",
  zipHelp: "We use your location only to pick the nearest dealer. Nothing is stored.",
  recommended: "Your nearest approved dealer",
  sending: "Sending your plan…",
  sent: (dealer: string) => `Plan sent to ${dealer}.`,
  final: (distributor: string, dealer: string) => `${distributor} will contact you shortly to connect you with ${dealer} and get your price.`,
  demoNote: "Demo only: nothing was sent.",
  other: "Choose a different dealer",
  close: "Back to my design",
  shellButton: "Get my price",
} as const;

export const DEALERS_PAGE_COPY = {
  title: "Approved dealers",
  sample: "Sample dealers: these are fictional businesses for this demo. Names, addresses, phone numbers and emails are made up.",
  intro: "Our cabinets are sold through approved dealers. Pick a dealer and we'll send them your plan.",
  send: "Send my plan to this dealer",
  sent: "Plan sent, demo only",
} as const;
