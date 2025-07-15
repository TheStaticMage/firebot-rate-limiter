/* eslint-disable @typescript-eslint/unbound-method */
import { BucketService, initializeBucketService, bucketService } from './bucket-service';
import { firebot, logger } from '../main';
import { Bucket } from '../shared/types';

jest.mock('../main', () => ({
    firebot: {
        modules: {
            fs: {
                existsSync: jest.fn(),
                readFileSync: jest.fn(),
                writeFileSync: jest.fn()
            },
            frontendCommunicator: {
                on: jest.fn(),
                send: jest.fn()
            }
        }
    },
    logger: {
        debug: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn()
    }
}));

jest.mock('./util', () => ({
    getDataFilePath: jest.fn(() => '/tmp/test-buckets.json')
}));

describe('BucketService', () => {
    let service: BucketService;
    const bucketId = 'bucket1';
    const bucket: Bucket = {
        name: 'Test Bucket',
        type: 'simple',
        maxTokens: 10,
        refillRate: 1,
        startTokens: 5,
        fillFromStart: false,
        persistBucket: true,
        lifetimeMaxTokens: false,
        lifetimeMaxTokensValue: 0
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (firebot.modules.fs.existsSync as jest.Mock).mockReturnValue(false);
        (firebot.modules.fs.readFileSync as jest.Mock).mockReturnValue('{}');
        service = new BucketService();
    });

    it('should initialize and register frontend communicator handlers', () => {
        expect(firebot.modules.frontendCommunicator.on).toHaveBeenCalled();
        expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Registered rate-limiter:deleteBucket'));
    });

    it('should save and load buckets from file', () => {
        (firebot.modules.fs.existsSync as jest.Mock).mockReturnValue(true);
        (firebot.modules.fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ [bucketId]: bucket }));
        service = new BucketService();
        expect(service.getBuckets()[bucketId]).toEqual(bucket);
    });

    it('should save a bucket and persist to file', () => {
        service['saveBucket'](bucketId, { ...bucket });
        expect(service.getBuckets()[bucketId]).toEqual(expect.objectContaining(bucket));
        expect(firebot.modules.fs.writeFileSync).toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Updated bucket'));
    });

    it('should throw error when saving bucket with duplicate name', () => {
        service['saveBucket'](bucketId, { ...bucket });
        expect(() => {
            service['saveBucket']('bucket2', { ...bucket, name: bucket.name });
        }
        ).toThrow(/already exists/);
    });

    it('should throw error when saving bucket with negative maxTokens', () => {
        expect(() => {
            service['saveBucket']('bucket2', { ...bucket, maxTokens: -1 });
        }
        ).toThrow(/Maximum tokens must be non-negative/);
    });

    it('should throw error when saving bucket with negative refillRate', () => {
        expect(() => {
            service['saveBucket']('bucket2', { ...bucket, refillRate: -1 });
        }
        ).toThrow(/Bucket refill rate must be non-negative/);
    });

    it('should throw error when saving bucket with empty name', () => {
        expect(() => {
            service['saveBucket']('bucket2', { ...bucket, name: '   ' });
        }
        ).toThrow(/Missing or empty name/);
    });

    it('should delete a bucket', () => {
        service['saveBucket'](bucketId, { ...bucket });
        service['deleteBucket'](bucketId);
        expect(service.getBuckets()[bucketId]).toBeUndefined();
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Deleted bucket'));
    });

    it('should throw error when deleting non-existent bucket', () => {
        expect(() => {
            service['deleteBucket']('notfound');
        }).toThrow(/non-existent bucket/);
    });

    it('should get a bucket', () => {
        service['saveBucket'](bucketId, { ...bucket });
        expect(service.getBucket(bucketId)).toEqual(expect.objectContaining(bucket));
    });

    it('should instantiate a new bucket if params provided and not exist', () => {
        const params = { bucketSize: 20, bucketRate: 2 };
        const newBucket = service.getBucket('newBucket', params);
        expect(newBucket).toEqual(expect.objectContaining({
            name: 'newBucket',
            maxTokens: 20,
            refillRate: 2,
            startTokens: 20,
            type: 'simple'
        }));
    });

    it('should warn and return undefined for non-existent bucket without params', () => {
        const result = service.getBucket('notfound');
        expect(result).toBeUndefined();
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Attempted to get non-existent bucket'));
    });

    it('should get all buckets', () => {
        service['saveBucket'](bucketId, { ...bucket });
        expect(service.getBuckets()).toHaveProperty(bucketId);
    });

    it('should getBucketsAsArray returns only non-simple buckets sorted', () => {
        const advBucket: Bucket = { ...bucket, name: 'Zeta', type: 'advanced' };
        const advBucket2: Bucket = { ...bucket, name: 'Alpha', type: 'advanced' };
        service['saveBucket']('adv1', advBucket);
        service['saveBucket']('adv2', advBucket2);
        const arr = (service as any)['getBucketsAsArray']();
        expect(arr.length).toBe(2);
        expect(arr[0].name).toBe('Alpha');
        expect(arr[1].name).toBe('Zeta');
    });

    it('should set advancedBucketsEnabled and notify frontend', () => {
        service.setAdvancedBucketsEnabled(true);
        expect((service as any).advancedBucketsEnabled).toBe(true);
        expect(firebot.modules.frontendCommunicator.send).toHaveBeenCalledWith(
            'rate-limiter:show-hide-advanced-buckets', true
        );
    });

    it('should return advancedBucketsEnabled state', () => {
        service.setAdvancedBucketsEnabled(true);
        expect(service.getAdvancedBucketsEnabled()).toBe(true);
    });

    it('should handle file read error gracefully', () => {
        (firebot.modules.fs.existsSync as jest.Mock).mockReturnValue(true);
        (firebot.modules.fs.readFileSync as jest.Mock).mockImplementation(() => {
            throw new Error('fail');
        });
        service = new BucketService();
        expect((service as any).fileReadError).toMatch(/Failed to load buckets/);
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to load buckets'));
    });

    it('initializeBucketService should initialize only once', () => {
        initializeBucketService();
        const firstInstance = bucketService;
        initializeBucketService();
        expect(bucketService).toBe(firstInstance);
        expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('already initialized'));
    });
});
