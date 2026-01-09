import type { IDummyService } from "./dummy.service";
import { RemoteDummyService } from "./RemoteDummyService";

export const getDummyService = (): IDummyService => {
  return new RemoteDummyService();
};
