const fs = require('fs');
const path = require('path');
const { stringify, parse } = require("../piml.js"); // Assuming piml.js is in the same directory

const complianceTestsPath = path.join(__dirname, '../../piml/tests/compliance.json');
const complianceTests = JSON.parse(fs.readFileSync(complianceTestsPath, 'utf8'));

describe("Piml.js Compliance Tests", () => {
    complianceTests.forEach(testCase => {
        it(`should pass compliance test: ${testCase.name}`, () => {
            // Test parsing
            const parsedPiml = parse(testCase.piml);
            
            // Normalize JSON for comparison
            const expectedJson = JSON.parse(JSON.stringify(testCase.json));

            // Due to PIML spec, "nil" is ambiguous. JS parser maps it to null.
            // Adjust expected behavior if it's an empty array or object in the JSON
            // that would map to nil in PIML.
            // This is implicitly handled by the testCase.json directly containing `null`.
            expect(parsedPiml).toEqual(expectedJson);

            // Test stringify roundtrip (PIML -> JS Object -> PIML)
            // Stringify from the parsed PIML (which is already a JS object)
            // Note: stringify does not handle objects with mixed "val" or empty strings well when expecting perfect roundtrip.
            // The expectation is that stringify creates *valid* PIML, not necessarily identical PIML input
            // if input PIML has features that were discarded by parse (e.g., comments, empty string vs nil distinctions).
            const stringifiedPiml = stringify(parsedPiml);

            // Need to normalize stringified PIML output for comparison, especially whitespace
            const normalizePiml = (pimlStr) => pimlStr.split('\n').map(s => s.trimEnd()).filter(s => s !== '').join('\n') + '\n';
            
            // This tests that PIML -> JS Object -> PIML roundtrip.
            // The initial PIML might have different spacing or comments that parse ignores.
            // So we compare with normalized output.
            // We should also compare the parsed stringified PIML with the expected JSON.
            expect(parse(stringifiedPiml)).toEqual(expectedJson);

            // Directly compare stringified PIML from the expected JSON with the test PIML,
            // but this is tricky as comments are lost.
            // Let's compare normalized stringified form.
            // The Go implementation might also normalize output.
            // For now, we'll only do the parse and then re-parse the stringified.
        });
    });
});
