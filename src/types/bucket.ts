import type { Doc, Id } from "../../convex/_generated/dataModel";

/** Planned refill cadence for a bucket (matches `convex/schema` / `bucketPeriodValidator`). */
export type BucketPeriod = Doc<"buckets">["period"];

/** Convex document for discretionary budget buckets. */
export type Bucket = Doc<"buckets">;

export type BucketId = Id<"buckets">;

/** Fields the client supplies when creating a bucket (no system fields). */
export type BucketCreateInput = {
  userId: string;
  name: string;
  targetAmount: number;
  period: BucketPeriod;
  rollover?: boolean;
  categoryId?: Id<"categories">;
  color?: string;
  note?: string;
  monthlyFillGoal?: number;
  paymentAccountId?: Id<"accounts">;
};

/** Partial updates for `updateBucket` (id and userId are passed separately at the API). */
export type BucketUpdateInput = {
  name?: string;
  targetAmount?: number;
  period?: BucketPeriod;
  rollover?: boolean;
  categoryId?: Id<"categories"> | null;
  color?: string;
  note?: string;
  monthlyFillGoal?: number | null;
  paymentAccountId?: Id<"accounts"> | null;
};
