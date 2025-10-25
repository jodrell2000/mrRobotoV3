// Mock for @google/genai module (new SDK)

const mockModelsGenerateContent = jest.fn();

class MockGoogleGenAI {
    constructor ( options ) {
        this.apiKey = options?.apiKey;
        this.models = {
            generateContent: mockModelsGenerateContent
        };
    }
}

module.exports = {
    GoogleGenAI: MockGoogleGenAI,
    // Export the mock function for testing
    __mockModelsGenerateContent: mockModelsGenerateContent
};