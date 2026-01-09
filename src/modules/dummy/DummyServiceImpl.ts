import type { IDummyService } from "./dummy.service";

export class DummyServiceImpl implements IDummyService {
  doSomething(): string {
    throw new Error("Method not implemented.");
  }
}
