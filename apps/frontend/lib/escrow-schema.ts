import { z } from 'zod';
import { StrKey } from 'stellar-sdk';

export const ESCROW_DRAFT_STORAGE_KEY = 'vaultix:escrow-creation-draft';
export const PLATFORM_FEE_BPS = 50; // 0.50%
export const ESTIMATED_NETWORK_FEE_XLM = '0.00001';

export const basicInfoSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description is too long'),
  category: z.enum(['service', 'goods', 'milestone', 'other'], {
    message: 'Please select a category',
  }),
});

export const partiesSchema = z.object({
  counterpartyAddress: z.string().refine(
    (val) => {
      try {
        return StrKey.isValidEd25519PublicKey(val);
      } catch {
        return false;
      }
    },
    {
      message: 'Invalid Stellar address',
    },
  ),
});

export const termsSchema = z.object({
  amount: z.string().refine(
    (val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    },
    {
      message: 'Amount must be a positive number',
    },
  ),
  asset: z.string().min(1, 'Asset is required'),
  deadline: z.date().refine((date) => date instanceof Date && !isNaN(date.getTime()) && date > new Date(), {
    message: 'Deadline must be in the future',
  }),
});

export const milestoneItemSchema = z.object({
  description: z.string().min(3, 'Description must be at least 3 characters'),
  amount: z.string().refine(
    (val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    },
    { message: 'Amount must be a positive number' },
  ),
});

export const milestonesSchema = z.object({
  milestones: z.array(milestoneItemSchema),
});

export const conditionItemSchema = z.object({
  type: z.enum(['manual', 'time', 'oracle']),
  description: z.string().optional(),
  releaseDate: z.string().optional(),
});

export const conditionsSchema = z.object({
  conditions: z.array(conditionItemSchema),
});

// Combined schema for the full form state
export const createEscrowSchema = basicInfoSchema
  .merge(partiesSchema)
  .merge(termsSchema)
  .merge(milestonesSchema)
  .merge(conditionsSchema);

export type CreateEscrowFormData = z.infer<typeof createEscrowSchema>;
export type BasicInfoFormData = z.infer<typeof basicInfoSchema>;
export type PartiesFormData = z.infer<typeof partiesSchema>;
export type TermsFormData = z.infer<typeof termsSchema>;
export type MilestoneItem = z.infer<typeof milestoneItemSchema>;
export type ConditionItem = z.infer<typeof conditionItemSchema>;

export interface EscrowFeeSummary {
  principalAmount: string;
  platformFeeAmount: string;
  platformFeePercent: string;
  networkFeeXlm: string;
  totalAssetAmount: string;
  asset: string;
}

export function calculateEscrowFees(amountStr?: string, asset = 'XLM'): EscrowFeeSummary {
  const parsed = parseFloat(amountStr ?? '0');
  const principal = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  const platformFee = (principal * PLATFORM_FEE_BPS) / 10000;
  const networkFee = parseFloat(ESTIMATED_NETWORK_FEE_XLM);
  const totalAsset =
    asset.toUpperCase() === 'XLM' ? principal + platformFee + networkFee : principal + platformFee;

  const formatAmount = (val: number) => {
    if (val === 0) return '0.00';
    return Number(val.toFixed(7)).toString();
  };

  return {
    principalAmount: principal > 0 ? formatAmount(principal) : '0.00',
    platformFeeAmount: platformFee > 0 ? formatAmount(platformFee) : '0.00',
    platformFeePercent: `${(PLATFORM_FEE_BPS / 100).toFixed(2)}%`,
    networkFeeXlm: ESTIMATED_NETWORK_FEE_XLM,
    totalAssetAmount: totalAsset > 0 ? formatAmount(totalAsset) : '0.00',
    asset: asset || 'XLM',
  };
}

export interface PersistedEscrowDraft {
  step: number;
  updatedAt: string;
  values: Partial<Omit<CreateEscrowFormData, 'deadline'>> & {
    deadline?: string;
  };
}

export function saveEscrowDraft(
  values: Partial<CreateEscrowFormData>,
  step: number,
  storage: Pick<Storage, 'setItem'> | null = typeof window !== 'undefined' ? window.localStorage : null,
): void {
  if (!storage) return;
  try {
    const deadlineIso =
      values.deadline instanceof Date && !isNaN(values.deadline.getTime())
        ? values.deadline.toISOString()
        : typeof values.deadline === 'string'
          ? values.deadline
          : undefined;

    const payload: PersistedEscrowDraft = {
      step,
      updatedAt: new Date().toISOString(),
      values: {
        ...values,
        deadline: deadlineIso,
      },
    };
    storage.setItem(ESCROW_DRAFT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

export function loadEscrowDraft(
  storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined' ? window.localStorage : null,
): { step: number; values: Partial<CreateEscrowFormData> } | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(ESCROW_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedEscrowDraft;
    if (!parsed || typeof parsed !== 'object' || !parsed.values) return null;

    const restoredValues: Partial<CreateEscrowFormData> = {
      ...parsed.values,
      deadline: parsed.values.deadline ? new Date(parsed.values.deadline) : undefined,
    };
    if (restoredValues.deadline && isNaN(restoredValues.deadline.getTime())) {
      delete restoredValues.deadline;
    }

    return {
      step: typeof parsed.step === 'number' && parsed.step >= 0 ? parsed.step : 0,
      values: restoredValues,
    };
  } catch {
    return null;
  }
}

export function clearEscrowDraft(
  storage: Pick<Storage, 'removeItem'> | null = typeof window !== 'undefined' ? window.localStorage : null,
): void {
  if (!storage) return;
  try {
    storage.removeItem(ESCROW_DRAFT_STORAGE_KEY);
  } catch {
    // Ignore storage removal errors
  }
}
