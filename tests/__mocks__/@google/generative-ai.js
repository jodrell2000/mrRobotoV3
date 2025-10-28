// Mock for @google/generative-ai module (correct package)

const mockModelsGenerateContent = jest.fn();
const mockSendMessage = jest.fn();
const mockStartChat = jest.fn();
const mockGetGenerativeModel = jest.fn();

// Mock chat object
const mockChat = {
    sendMessage: mockSendMessage
};

// Mock model object
const mockModel = {
    startChat: mockStartChat
};

class MockGoogleGenerativeAI {
    constructor ( apiKey ) {
        this.apiKey = apiKey;
        this.models = {
            generateContent: mockModelsGenerateContent
        };
    }

    getGenerativeModel ( config ) {
        mockGetGenerativeModel( config );
        return mockModel;
    }
}

// Configure default behavior
mockStartChat.mockReturnValue( mockChat );

module.exports = {
    GoogleGenerativeAI: MockGoogleGenerativeAI,
    // Export the mock functions for testing
    __mockModelsGenerateContent: mockModelsGenerateContent,
    __mockSendMessage: mockSendMessage,
    __mockStartChat: mockStartChat,
    __mockGetGenerativeModel: mockGetGenerativeModel
};