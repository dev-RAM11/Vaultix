import {
  basicInfoSchema,
  partiesSchema,
  termsSchema,
  milestonesSchema,
  calculateEscrowFees,
  saveEscrowDraft,
  loadEscrowDraft,
  clearEscrowDraft,
} from './escrow-schema';

describe('Escrow Validation Schemas & Draft Utilities', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('basicInfoSchema', () => {
    it('should validate valid basic info', () => {
      const validData = {
        title: 'Project Development',
        description: 'Building a new web application using React and Next.js',
        category: 'service',
      };
      const result = basicInfoSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject short title', () => {
      const invalidData = {
        title: 'Proj',
        description: 'Building a new web application using React and Next.js',
        category: 'service',
      };
      const result = basicInfoSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.title).toContain('Title must be at least 5 characters');
      }
    });

    it('should reject short description', () => {
      const invalidData = {
        title: 'Project Development',
        description: 'Too short',
        category: 'service',
      };
      const result = basicInfoSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.description).toContain('Description must be at least 10 characters');
      }
    });

    it('should reject invalid category', () => {
      const invalidData = {
        title: 'Project Development',
        description: 'Building a new web application using React and Next.js',
        category: 'invalid-category',
      };
      const result = basicInfoSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('partiesSchema', () => {
    it('should validate a correct Stellar address', () => {
      const realValidAddress = 'GDZ667HFMKM7HDKUYM2Q22TX4CSKOAG56ZXQ6MOR6LNOXX5CL6Y4MEEA';
      const result = partiesSchema.safeParse({ counterpartyAddress: realValidAddress });
      expect(result.success).toBe(true);
    });

    it('should reject an invalid Stellar address', () => {
      const result = partiesSchema.safeParse({ counterpartyAddress: 'invalid-address' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.counterpartyAddress).toContain('Invalid Stellar address');
      }
    });
  });

  describe('termsSchema', () => {
    it('should validate valid terms', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const validData = {
        amount: '100.5',
        asset: 'XLM',
        deadline: futureDate,
      };
      const result = termsSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject negative amount', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const result = termsSchema.safeParse({
        amount: '-10',
        asset: 'XLM',
        deadline: futureDate,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.amount).toContain('Amount must be a positive number');
      }
    });

    it('should reject past deadline', () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);

      const result = termsSchema.safeParse({
        amount: '100',
        asset: 'XLM',
        deadline: pastDate,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.deadline).toContain('Deadline must be in the future');
      }
    });
  });

  describe('milestonesSchema', () => {
    it('validates milestone items and rejects invalid milestone entries', () => {
      expect(
        milestonesSchema.safeParse({
          milestones: [{ description: 'Design phase', amount: '50' }],
        }).success,
      ).toBe(true);

      expect(
        milestonesSchema.safeParse({
          milestones: [{ description: 'ab', amount: '0' }],
        }).success,
      ).toBe(false);
    });
  });

  describe('calculateEscrowFees', () => {
    it('computes platform fee, network fee, and total cost accurately', () => {
      const summary = calculateEscrowFees('200', 'XLM');
      expect(summary.principalAmount).toBe('200');
      expect(summary.platformFeeAmount).toBe('1');
      expect(summary.platformFeePercent).toBe('0.50%');
      expect(summary.networkFeeXlm).toBe('0.00001');
      expect(summary.totalAssetAmount).toBe('201.00001');
    });
  });

  describe('draft storage helpers', () => {
    it('saves, restores, and clears draft state from localStorage', () => {
      const deadline = new Date('2027-05-01T12:00:00.000Z');
      saveEscrowDraft(
        {
          title: 'Saved Draft Title',
          amount: '250',
          asset: 'USDC',
          deadline,
        },
        3,
      );

      const loaded = loadEscrowDraft();
      expect(loaded).not.toBeNull();
      expect(loaded?.step).toBe(3);
      expect(loaded?.values.title).toBe('Saved Draft Title');
      expect(loaded?.values.amount).toBe('250');
      expect(loaded?.values.deadline?.toISOString()).toBe(deadline.toISOString());

      clearEscrowDraft();
      expect(loadEscrowDraft()).toBeNull();
    });
  });
});
