export type ImageCustomerKind = "user" | "crm";

export type ImageGenerationCustomerCount = {
  customerId: number;
  customerKind: ImageCustomerKind;
  name: string | null;
  email: string | null;
  succeeded: number;
  failed: number;
};

export type UnlinkedImageGeneration = {
  id: number;
  imageType: string;
  model: string;
  status: string;
  createdAt: string | null;
  requestedByUserId: number | null;
};

export type ImageGenerationSummary = {
  schemaReady: boolean;
  from: string;
  to: string;
  internalCount: number;
  unlinkedCount: number;
  customers: ImageGenerationCustomerCount[];
  unlinked: UnlinkedImageGeneration[];
};

export type CustomerGeneratedImage = {
  id: number;
  imageType: string;
  model: string;
  purpose: "customer" | "internal";
  status: string;
  imageUrl: string | null;
  orderId: number | null;
  designId: number | null;
  createdAt: string | null;
};

export type ImageCustomerOption = {
  customerId: number;
  customerKind: ImageCustomerKind;
  name: string | null;
  email: string | null;
};
