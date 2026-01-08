import { v5 as uuidv5, v4 as uuidv4 } from "uuid";

const V5_NAMESPACE = "1b671a64-40d5-491e-99b0-da01ff1f3341";
export const generateUUID = (inputs?: string[]): string => {
  if (inputs && inputs.length > 0) {
    return uuidv5(inputs.join(":"), V5_NAMESPACE);
  }
  return uuidv4();
};
