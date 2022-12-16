import { TypedEvent } from "../types/contracts/common";

export const filterEventArgs = (event: TypedEvent) => {
  return Object.entries(event.args).reduce((acc, [key, value]) => {
    if (!isNaN(Number(key))) return acc;
    acc[key] = value;
    return acc;
  }, {} as any);
};
