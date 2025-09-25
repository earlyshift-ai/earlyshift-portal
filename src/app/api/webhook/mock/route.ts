import { NextRequest, NextResponse } from 'next/server'

// Mock webhook endpoint for testing chat functionality
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    
    console.log('Mock webhook received payload:', JSON.stringify(payload, null, 2))
    
    // Extract the last user message
    const messages = payload.messages || []
    const lastMessage = messages[messages.length - 1]
    const userMessage = lastMessage?.content || 'No message'
    
    // Generate a mock response based on the user message
    let mockResponse = "I'm a mock Cooke Chile Assistant. I received your message: \"" + userMessage + "\""
    
    // Add some context-aware responses
    if (userMessage.toLowerCase().includes('salmon')) {
      mockResponse += "\n\nI see you're asking about salmon! As Cooke Chile's assistant, I can help with salmon farming operations, health monitoring, and production insights."
    } else if (userMessage.toLowerCase().includes('aquaculture')) {
      mockResponse += "\n\nAquaculture is our specialty! I can assist with sustainable farming practices, environmental compliance, and operational efficiency."
    } else if (userMessage.toLowerCase().includes('feed')) {
      mockResponse += "\n\nFeed optimization is crucial for healthy salmon. I can help with nutrition planning, feed conversion ratios, and cost management."
    } else {
      mockResponse += "\n\nI'm here to help with all aspects of aquaculture operations. Ask me about salmon farming, feed management, health monitoring, or business operations!"
    }
    
    mockResponse += "\n\n*Note: This is a mock response. Connect to your n8n workflow for real AI assistance.*"
    
    // Simulate some processing delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    return NextResponse.json({
      response: mockResponse,
      message: mockResponse, // Alternative field name
      success: true,
      timestamp: new Date().toISOString(),
      mock: true
    })
    
  } catch (error) {
    console.error('Mock webhook error:', error)
    
    return NextResponse.json({
      response: "Sorry, I encountered an error processing your request. Please try again.",
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      mock: true
    }, { status: 500 })
  }
}
