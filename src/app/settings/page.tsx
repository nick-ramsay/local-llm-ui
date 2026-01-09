'use client';

import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button } from 'react-bootstrap';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import Link from 'next/link';
import '../globals.css';

interface Settings {
  systemPrompt: string;
  systemPromptEnabled: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  systemPrompt: '',
  systemPromptEnabled: false,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load settings from localStorage
    const storedSettings = localStorage.getItem('llmSettings');
    if (storedSettings) {
      try {
        const parsed = JSON.parse(storedSettings);
        setSettings({
          systemPrompt: parsed.systemPrompt || '',
          systemPromptEnabled: parsed.systemPromptEnabled === true,
        });
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem('llmSettings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Container fluid className="vh-100 d-flex flex-column p-0 m-0" style={{ maxWidth: '100%' }}>
      <Row className="flex-grow-1 m-0 g-0" style={{ minHeight: 0 }}>
        <Col className="d-flex flex-column p-0" style={{ minHeight: 0, height: '100vh', overflow: 'hidden' }}>
          <Card className="d-flex flex-column m-0 h-100" style={{ minHeight: 0, height: '100%', borderRadius: 0, display: 'flex', flexDirection: 'column' }}>
            <Card.Header className="flex-shrink-0" style={{ flexShrink: 0 }}>
              <div className="d-flex align-items-center gap-3">
                <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
                  <Button
                    variant="link"
                    className="p-0"
                    style={{ color: 'black' }}
                  >
                    <ArrowBackIcon />
                  </Button>
                </Link>
                <h5 className="mb-0">Settings</h5>
              </div>
            </Card.Header>

            <Card.Body
              className="p-4"
              style={{ overflowY: 'auto', flex: '1 1 0', minHeight: 0, maxHeight: '100%' }}
            >
              <div style={{ maxWidth: '800px' }}>
                <h5>API Parameters</h5>
              <p>You can find the full documentation on the Ollama API options at <a href="https://docs.ollama.com/api" target="_blank" rel="noopener noreferrer">https://docs.ollama.com/api</a></p>
                <h6 className="mb-3">System Instructions</h6>
                <p className="text-muted mb-3" style={{ fontSize: '0.9rem' }}>
                  System instructions are sent with every request to define the AI&apos;s behavior, personality, or context.
                  Leave empty to not include a system message.
                </p>

                <Form.Group className="mb-4">
                  <Form.Check
                    type="switch"
                    id="system-prompt-toggle"
                    label="Enable System Instructions"
                    checked={settings.systemPromptEnabled}
                    onChange={(e) => setSettings({ ...settings, systemPromptEnabled: e.target.checked })}
                    className="mb-3"
                  />
                  <Form.Control
                    as="textarea"
                    rows={10}
                    value={settings.systemPrompt}
                    onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                    placeholder="Enter system instructions here... (e.g., 'You are a helpful coding assistant. Always provide clear explanations with code examples.')"
                    disabled={!settings.systemPromptEnabled}
                    style={{ 
                      fontFamily: 'monospace', 
                      fontSize: '0.9rem',
                      opacity: settings.systemPromptEnabled ? 1 : 0.5
                    }}
                  />
                  <Form.Text className="text-muted">
                    {settings.systemPrompt.length} characters
                  </Form.Text>
                </Form.Group>

                <div className="d-flex align-items-center gap-3">
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    className="d-flex align-items-center gap-2"
                  >
                    <SaveIcon style={{ fontSize: '1.2rem' }} />
                    Save Settings
                  </Button>
                  {saved && (
                    <span className="text-success" style={{ fontSize: '0.9rem' }}>
                      ✓ Settings saved
                    </span>
                  )}
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

