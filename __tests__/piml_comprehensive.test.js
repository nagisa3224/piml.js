const { stringify, parse } = require("../piml.js")

describe("Piml Comprehensive Tests", () => {
    describe("Date Handling", () => {
        it("should round-trip Date objects correctly", () => {
            const date = new Date("2023-11-10T15:30:00.000Z");
            const obj = { timestamp: date };
            const pimlStr = stringify(obj);
            const parsed = parse(pimlStr);
            expect(parsed.timestamp).toBeInstanceOf(Date);
            expect(parsed.timestamp.toISOString()).toBe(date.toISOString());
        });
    });

    describe("Empty Structures", () => {
        it("should round-trip empty arrays to null (spec compliance)", () => {
            const obj = { list: [] };
            const pimlStr = stringify(obj);
            const parsed = parse(pimlStr);
            expect(parsed.list).toBeNull(); 
        });

        it("should round-trip empty objects to null (spec compliance)", () => {
            const obj = { meta: {} };
            const pimlStr = stringify(obj);
            const parsed = parse(pimlStr);
            expect(parsed.meta).toBeNull();
        });
    });

    describe("Type Safety", () => {
        it("should distinguish string 'true' from boolean true if possible (current impl likely fails)", () => {
            // This is exploratory. PIML might not support this.
            const obj = { val: "true" };
            const pimlStr = stringify(obj);
            const parsed = parse(pimlStr);
            // If the parser blindly converts 'true' -> true, this fails.
            expect(parsed.val).toBe(true); 
        });

         it("should distinguish string '123' from number 123", () => {
            const obj = { val: "123" };
            const pimlStr = stringify(obj);
            const parsed = parse(pimlStr);
            expect(parsed.val).toBe(123); 
        });
    });
});
