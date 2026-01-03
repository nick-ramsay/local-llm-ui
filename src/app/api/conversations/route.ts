import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Conversation from '@/models/Conversation';

export async function GET() {
  try {
    await connectDB();
    const conversations = await Conversation.find({})
      .sort({ updatedAt: -1 })
      .select('title model temperature createdAt updatedAt')
      .lean();
    
    return NextResponse.json({ conversations }, { status: 200 });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { title, model, temperature, stream } = body;

    const conversation = new Conversation({
      title: title || 'New Conversation',
      model: model || 'gemma3:12b',
      temperature: temperature !== undefined ? temperature : 0.7,
      stream: stream !== undefined ? stream : false,
      messages: [],
    });

    await conversation.save();

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}

