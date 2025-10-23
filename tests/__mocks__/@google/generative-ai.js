// Mock for @google/generative-ai module

class MockGenerativeModel {
    constructor ( apiKey, config ) {
        this.apiKey = apiKey;
        this.config = config;
        this.generateContent = jest.fn();
    }
}

const MockGoogleGenerativeAI = jest.fn();

module.exports = {
    GoogleGenerativeAI: MockGoogleGenerativeAI,
    GenerativeModel: MockGenerativeModel
};