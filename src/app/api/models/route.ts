import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434/api';

export async function GET() {
  try {
    const response = await axios.get(`${OLLAMA_API_URL}/tags`);
    const models = response.data.models?.map((model: any) => ({
      name: model.name,
      modified_at: model.modified_at,
    })) || [];

    return NextResponse.json({ models }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching models:', error);
    
    if (error.code === 'ECONNREFUSED') {
      return NextResponse.json(
        { error: 'Cannot connect to Ollama. Make sure Ollama is running on your MacBook.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    );
  }
}

