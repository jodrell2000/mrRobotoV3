// Mock for @google/genai module (new GenAI SDK with chat API)

const mockModelsGenerateContent = jest.fn();
const mockSendMessage = jest.fn();
const mockChatsCreate = jest.fn();
const mockGetGenerativeModel = jest.fn();

// Mock chat instance
const mockChat = {
    sendMessage: mockSendMessage
};

// Mock for the new client.models.generateContent API
const mockModels = {
    generateContent: mockModelsGenerateContent
};

// Mock for the new client.chats.create API
const mockChats = {
    create: mockChatsCreate
};

class MockGoogleGenAI {
    constructor ( options ) {
        this.apiKey = options?.apiKey;
        this.models = mockModels;
        this.chats = mockChats;
    }
}

// Configure default behavior
mockModelsGenerateContent.mockResolvedValue({ text: 'Mock AI response' });
mockSendMessage.mockResolvedValue({ text: 'Mock AI chat response' });
mockChatsCreate.mockReturnValue( mockChat );

module.exports = {
    GoogleGenAI: MockGoogleGenAI,
    // Export the mock functions for testing
    __mockModelsGenerateContent: mockModelsGenerateContent,
    __mockSendMessage: mockSendMessage,
    __mockChatsCreate: mockChatsCreate,
    __mockGetGenerativeModel: mockGetGenerativeModel
};