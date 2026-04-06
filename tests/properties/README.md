# Property-Based Tests for Advanced Prediction Market Intelligence

This directory contains property-based tests that validate universal correctness properties across randomized inputs using the `fast-check` library.

## Test Files

### performance-privacy.test.ts

Validates performance bounds and privacy guarantees for the intelligence system.

**Property 2: Probability Update Frequency**
- Markets closing within 24h must update every 30 seconds
- Markets closing after 24h must update every 60 seconds
- Update frequency must transition correctly at the 24h boundary
- Validates: Requirements 1.2, 1.5

**Property 35: Differential Privacy Guarantee**
- Epsilon value must be exactly 1.0 for user-level statistics
- Laplace noise must provide differential privacy
- Private statistics must preserve user privacy
- Multiple queries must compose privacy budgets correctly
- Validates: Requirement 15.4

**Property 36: Performance Bounds**
- 100 markets probability updates must complete within 10 seconds
- Bet manipulation analysis must complete within 5 seconds
- Reputation updates must complete within 2 seconds
- Batch processing must maintain performance bounds
- Concurrent operations must not degrade performance
- Validates: Requirements 17.1, 17.2, 17.3

## Running Tests

```bash
# Run all property tests
npm test

# Run with watch mode
npm run test:watch

# Run with UI
npm run test:ui

# Run only performance-privacy tests
npm test performance-privacy
```

## Test Configuration

- **Iterations**: Minimum 100 runs per property (50 for complex properties, 10 for performance tests)
- **Timeout**: 30 seconds per test suite
- **Environment**: Node.js with vitest globals

## Property Test Structure

Each property test follows this pattern:

```typescript
test('property description', () => {
  fc.assert(
    fc.asyncProperty(
      fc.record({ /* input generators */ }),
      async (inputs) => {
        // Test logic
        expect(result).toSatisfyProperty()
      }
    ),
    { numRuns: 100 }
  )
})
```

## Key Concepts

**Property-Based Testing**: Instead of testing specific examples, we test universal properties that should hold for all valid inputs. The testing library generates hundreds of random inputs to find edge cases.

**Differential Privacy**: A mathematical framework for privacy-preserving data analysis. With epsilon=1.0, the system adds calibrated noise to statistics to prevent individual user data from being inferred.

**Performance Bounds**: Hard limits on execution time that ensure the system remains responsive under load. These are validated with realistic workloads.

## Debugging Failed Tests

If a property test fails:

1. Check the counterexample in the test output
2. The library will show the specific input that caused the failure
3. Use that input to create a focused unit test
4. Fix the underlying issue
5. Re-run the property test to verify

## References

- [fast-check documentation](https://github.com/dubzzz/fast-check)
- [Property-Based Testing Guide](https://hypothesis.works/articles/what-is-property-based-testing/)
- [Differential Privacy Primer](https://programming-dp.com/)
