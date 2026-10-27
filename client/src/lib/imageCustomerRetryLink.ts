import { observable } from "@trpc/server/observable";
import { shouldAttachCustomer, withAttachedCustomer } from "@shared/imageCustomerLink";
import { requestImageCustomerLink } from "@/lib/imageCustomerPrompt";

type Operation = {
  type: string;
  input: unknown;
};

type Observer = {
  next: (value: unknown) => void;
  error: (error: unknown) => void;
  complete: () => void;
};

type Subscription = { unsubscribe: () => void };

/**
 * Sits in front of the HTTP link. When a mutation is refused with
 * "Attach a customer before generating images", open the picker and retry
 * that same mutation once with customerId and customerKind.
 */
export function imageCustomerRetryLink() {
  return () => {
    return ({ op, next }: { op: Operation; next: (op: Operation) => { subscribe: (observer: Observer) => Subscription } }) => {
      return observable((observer: Observer) => {
        let retried = false;
        let current: Subscription | null = null;
        const run = (operation: Operation) => {
          current = next(operation).subscribe({
            next(value) {
              observer.next(value);
            },
            error(error: unknown) {
              const message = error instanceof Error ? error.message : "";
              if (!shouldAttachCustomer(operation.type, message, retried)) {
                observer.error(error);
                return;
              }
              retried = true;
              void requestImageCustomerLink().then((choice) => {
                if (!choice) {
                  observer.error(error);
                  return;
                }
                run({ ...operation, input: withAttachedCustomer(operation.input, choice) });
              });
            },
            complete() {
              observer.complete();
            },
          });
        };
        run(op);
        return () => current?.unsubscribe();
      });
    };
  };
}
