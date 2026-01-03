import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Conversation from '@/models/Conversation';
import axios from 'axios';

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434/api';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { conversationId, message, model, temperature, stream } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Get or create conversation
    let conversation;
    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 }
        );
      }
    } else {
      // Create new conversation
      conversation = new Conversation({
        title: message.substring(0, 50) || 'New Conversation',
        model: model || 'gemma3:12b',
        temperature: temperature !== undefined ? temperature : 0.7,
        stream: stream !== undefined ? stream : false,
        messages: [],
      });
    }

    // Update model, temperature, and stream if provided
    if (model) conversation.model = model;
    if (temperature !== undefined) conversation.temperature = temperature;
    if (stream !== undefined) conversation.stream = stream;

    // Add user message
    conversation.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date(),
    });

    // Update conversation title if it's the first message
    if (conversation.messages.length === 1) {
      conversation.title = message.substring(0, 50) || 'New Conversation';
    }

    // Save conversation immediately with user message
    await conversation.save();
    const savedConversationId = conversation._id.toString();

    // Prepare messages for Ollama (convert to the format Ollama expects)
    const ollamaMessages = conversation.messages.map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }));

    const shouldStream = conversation.stream === true;

    // Handle streaming response
    if (shouldStream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Call Ollama API with streaming
            const ollamaResponse = await fetch(`${OLLAMA_API_URL}/chat`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: conversation.model,
                messages: ollamaMessages,
                stream: true,
                options: {
                  temperature: conversation.temperature,
                },
              }),
            });

            if (!ollamaResponse.ok) {
              throw new Error(`Ollama API error: ${ollamaResponse.statusText}`);
            }

            const reader = ollamaResponse.body?.getReader();
            const decoder = new TextDecoder();
            let fullMessage = '';

            if (!reader) {
              throw new Error('No response body from Ollama');
            }

            // Add empty assistant message to conversation for real-time updates
            conversation.messages.push({
              role: 'assistant',
              content: '',
              timestamp: new Date(),
            });
            await conversation.save();
            const assistantMessageIndex = conversation.messages.length - 1;
            
            // Send conversation ID to client so it can poll for updates
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ conversationId: savedConversationId })}\n\n`)
            );

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n').filter(line => line.trim() !== '');

              for (const line of lines) {
                try {
                  const data = JSON.parse(line);
                  if (data.message?.content) {
                    const content = data.message.content;
                    fullMessage += content;
                    
                    // Update conversation in database in real-time (update only the last message content)
                    await Conversation.findByIdAndUpdate(
                      savedConversationId,
                      {
                        $set: {
                          [`messages.${assistantMessageIndex}.content`]: fullMessage,
                        },
                      },
                      { new: true }
                    );
                    
                    // Send chunk to client
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ content, done: data.done })}\n\n`)
                    );
                  }
                  if (data.done) {
                    // Final update - conversation is already saved with latest content
                    const finalConversation = await Conversation.findById(savedConversationId).lean();
                    
                    // Send final message
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ done: true, conversation: finalConversation })}\n\n`)
                    );
                    controller.close();
                    return;
                  }
                } catch (e) {
                  // Skip invalid JSON lines
                  continue;
                }
              }
            }
          } catch (error: any) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`)
            );
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Non-streaming response (existing logic)
    const ollamaResponse = await axios.post(
      `${OLLAMA_API_URL}/chat`,
      {
        model: conversation.model,
        messages: ollamaMessages,
        stream: false,
        options: {
          temperature: conversation.temperature,
        },
      },
      {
        timeout: 300000, // 5 minute timeout
      }
    );

    const assistantMessage = ollamaResponse.data.message?.content || 'No response from model';

    // Reload conversation to get the latest version (since it was already saved)
    const updatedConversation = await Conversation.findById(savedConversationId);
    if (!updatedConversation) {
      throw new Error('Conversation not found after save');
    }

    // Add assistant response
    updatedConversation.messages.push({
      role: 'assistant',
      content: assistantMessage,
      timestamp: new Date(),
    });

    await updatedConversation.save();

    return NextResponse.json(
      {
        conversation: updatedConversation.toObject(),
        response: assistantMessage,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error in chat API:', error);
    
    if (error.code === 'ECONNREFUSED') {
      return NextResponse.json(
        { error: 'Cannot connect to Ollama. Make sure Ollama is running on your MacBook.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to process chat message' },
      { status: 500 }
    );
  }
}

