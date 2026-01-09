import type { IDummyService } from "./dummy.service";

export class RemoteDummyService implements IDummyService {
  doSomething(): string {
    throw new Error("Method not implemented.");
  }
}
