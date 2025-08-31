// Mocks must be defined before imports due to Jest hoisting
let mockLogger: any;
let mockBucketService: any;
jest.mock('../backend/bucket-service', () => {
    mockBucketService = {
        getAdvancedBucketsEnabled: jest.fn(),
        getBucket: jest.fn()
    };
    // Attach to global for test access
    (global as any).mockBucketService = mockBucketService;
    return { bucketService: mockBucketService };
});
jest.mock('../main', () => {
    mockLogger = { debug: jest.fn(), warn: jest.fn() };
    (global as any).mockLogger = mockLogger;
    return { logger: mockLogger };
});

import { bucketFilter } from './bucket';

// Use global mocks in tests
const logger = (global as any).mockLogger;
const bucketService = (global as any).mockBucketService;

describe('bucketFilter.predicate', () => {
    const filterSettings = { value: 'bucket1', comparisonType: 'is' };
    const eventData = { eventSourceId: 'rate-limiter', eventId: 'approved', eventMeta: { bucketId: 'bucket1' } };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns true if bucketId or filter value is missing', async () => {
        const noBucketId = { eventSourceId: 'rate-limiter', eventId: 'approved', eventMeta: {} };
        const noValue = { value: undefined, comparisonType: 'is' };
        expect(await bucketFilter.predicate(filterSettings, noBucketId)).toBe(true);
        expect(await bucketFilter.predicate(noValue, eventData)).toBe(true);
        expect(logger.warn).toHaveBeenCalled();
    });

    it('returns true if advanced buckets are disabled', async () => {
        bucketService.getAdvancedBucketsEnabled.mockReturnValue(false);
        expect(await bucketFilter.predicate(filterSettings, eventData)).toBe(true);
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Advanced buckets are disabled'));
    });

    it('returns true if bucket is not found', async () => {
        bucketService.getAdvancedBucketsEnabled.mockReturnValue(true);
        bucketService.getBucket.mockReturnValue(undefined);
        expect(await bucketFilter.predicate(filterSettings, eventData)).toBe(true);
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Bucket in filter is no longer valid'));
    });

    it('returns correct logic for comparisonType "is"', async () => {
        bucketService.getAdvancedBucketsEnabled.mockReturnValue(true);
        bucketService.getBucket.mockReturnValue({});
        // bucketId === value, comparisonType === 'is' => true
        expect(await bucketFilter.predicate(filterSettings, eventData)).toBe(true);
        // bucketId !== value, comparisonType === 'is' => false
        const otherEventData = { eventSourceId: 'rate-limiter', eventId: 'approved', eventMeta: { bucketId: 'other' } };
        expect(await bucketFilter.predicate(filterSettings, otherEventData)).toBe(false);
    });

    it('returns correct logic for comparisonType "is not"', async () => {
        bucketService.getAdvancedBucketsEnabled.mockReturnValue(true);
        bucketService.getBucket.mockReturnValue({});
        // bucketId === value, comparisonType === 'is not' => false
        expect(await bucketFilter.predicate({ value: 'bucket1', comparisonType: 'is not' }, eventData)).toBe(false);
        // bucketId !== value, comparisonType === 'is not' => true
        const otherEventData = { eventSourceId: 'rate-limiter', eventId: 'approved', eventMeta: { bucketId: 'other' } };
        expect(await bucketFilter.predicate({ value: 'bucket1', comparisonType: 'is not' }, otherEventData)).toBe(true);
    });
});
