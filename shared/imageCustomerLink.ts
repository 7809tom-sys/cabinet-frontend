export const ATTACH_CUSTOMER_MESSAGE = "Attach a customer before generating images";

export type ImageCustomerKind = "user" | "crm";

export type ImageCustomerChoice = {
  customerId: number;
  customerKind: ImageCustomerKind;
};

/** Merge a picked customer into a tRPC mutation input. Retried once by the client link. */
export function withAttachedCustomer<T>(input: T, choice: ImageCustomerChoice): T {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return { ...input, customerId: choice.customerId, customerKind: choice.customerKind };
  }
  return input;
}

export function shouldAttachCustomer(type: string, message: string, alreadyRetried: boolean): boolean {
  return !alreadyRetried && type === "mutation" && message === ATTACH_CUSTOMER_MESSAGE;
}
