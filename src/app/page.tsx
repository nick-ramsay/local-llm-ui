'use client';

import React, { useState, useEffect, useRef } from 'react';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import SendIcon from '@mui/icons-material/Send';
import { Container, Row, Col, Card, Form, Button, ListGroup, Badge, Spinner, Alert } from 'react-bootstrap';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiClient, Conversation, Message, Model } from './utils/api';
import './globals.css';
import { inherits } from 'util';
import { BorderAll } from '@mui/icons-material';

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('gemma3:12b');
  const [temperature, setTemperature] = useState<number>(0.7);
  const [stream, setStream] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingModels, setLoadingModels] = useState<boolean>(true);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      await loadConversations();
      await loadModels();
      
      // Load last active conversation from localStorage
      const lastActiveConversationId = localStorage.getItem('lastActiveConversationId');
      if (lastActiveConversationId) {
        try {
          const conversation = await apiClient.getConversation(lastActiveConversationId);
          if (conversation) {
            setCurrentConversation(conversation);
            setSelectedModel(conversation.model);
            setTemperature(conversation.temperature);
            setStream(conversation.stream || false);
          }
        } catch (err) {
          // If conversation doesn't exist anymore, clear it from localStorage
          localStorage.removeItem('lastActiveConversationId');
        }
      }
    };
    
    initializeApp();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [currentConversation?.messages, streamingMessage]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      const data = await apiClient.getConversations();
      setConversations(data);
    } catch (err: any) {
      setError('Failed to load conversations: ' + (err.message || 'Unknown error'));
    }
  };

  const loadModels = async () => {
    try {
      setLoadingModels(true);
      const data = await apiClient.getModels();
      setModels(data);
      if (data.length > 0 && !selectedModel) {
        setSelectedModel(data[0].name);
      }
    } catch (err: any) {
      setError('Failed to load models. Make sure Ollama is running: ' + (err.message || 'Unknown error'));
    } finally {
      setLoadingModels(false);
    }
  };

  const handleConversationSelect = async (conversationId: string) => {
    try {
      const conversation = await apiClient.getConversation(conversationId);
      setCurrentConversation(conversation);
      setSelectedModel(conversation.model);
      setTemperature(conversation.temperature);
      setStream(conversation.stream || false);
      // Save to localStorage
      localStorage.setItem('lastActiveConversationId', conversationId);
    } catch (err: any) {
      setError('Failed to load conversation: ' + (err.message || 'Unknown error'));
    }
  };

  const handleNewConversation = () => {
    setCurrentConversation(null);
    setMessage('');
    setSelectedModel(models.length > 0 ? models[0].name : 'gemma3:12b');
    setTemperature(0.7);
    setStream(false);
    setStreamingMessage('');
    // Clear last active conversation when starting new one
    localStorage.removeItem('lastActiveConversationId');
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setStreamingMessage('');
    // Error will be set in the catch block
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || loading) return;

    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError(null);
    setStreamingMessage('');

    const userMessage = message.trim();
    const originalMessage = message; // Keep original for potential restoration
    setMessage('');

    // Declare pollingInterval outside if block so it's accessible in finally
    let pollingInterval: NodeJS.Timeout | null = null;

    // Add user message to UI immediately
    const tempUserMessage = {
      role: 'user' as const,
      content: userMessage,
      timestamp: new Date().toISOString(),
    };

    if (stream) {
      // Handle streaming response
      let tempConversation: Conversation | null = null;
      try {
        // Create temporary assistant message for streaming
        const tempAssistantMessage = {
          role: 'assistant' as const,
          content: '',
          timestamp: new Date().toISOString(),
        };

        // Update conversation with user message and empty assistant message
        tempConversation = currentConversation
          ? {
            ...currentConversation,
            messages: [...currentConversation.messages, tempUserMessage, tempAssistantMessage],
          }
          : {
            _id: '',
            title: userMessage.substring(0, 50) || 'New Conversation',
            model: selectedModel,
            temperature: temperature,
            stream: stream,
            messages: [tempUserMessage, tempAssistantMessage],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

        setCurrentConversation(tempConversation);

        // Set up polling to sync with database during streaming
        let dbConversationId: string | null = null;

        // Function to add conversation to sidebar immediately
        const addConversationToSidebar = async (conversationId: string) => {
          try {
            const dbConversation = await apiClient.getConversation(conversationId);
            if (dbConversation) {
              // Add to conversations list if not already present
              setConversations(prev => {
                const exists = prev.some(conv => conv._id === conversationId);
                if (exists) {
                  // Update existing conversation
                  return prev.map(conv =>
                    conv._id === conversationId ? dbConversation : conv
                  ).sort((a, b) =>
                    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
                  );
                } else {
                  // Add new conversation at the top
                  return [dbConversation, ...prev];
                }
              });
            }
          } catch (err) {
            console.error('Error adding conversation to sidebar:', err);
          }
        };

        const startPolling = (conversationId: string) => {
          if (pollingInterval) {
            clearInterval(pollingInterval);
          }
          dbConversationId = conversationId;
          pollingInterval = setInterval(async () => {
            try {
              const dbConversation = await apiClient.getConversation(conversationId);
              if (dbConversation) {
                setCurrentConversation(dbConversation);
                scrollToBottom();
              }
            } catch (err) {
              // Silently fail polling errors
              console.error('Polling error:', err);
            }
          }, 500); // Poll every 500ms during streaming
        };

        // Start polling if we already have a conversation ID
        if (tempConversation._id) {
          startPolling(tempConversation._id);
          // Also add/update in sidebar immediately for existing conversations
          addConversationToSidebar(tempConversation._id);
        }

        // Call streaming API
        console.log('Sending streaming request:', { stream, conversationId: currentConversation?._id, message: userMessage });
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversationId: currentConversation?._id,
            message: userMessage,
            model: selectedModel,
            temperature: temperature,
            stream: stream,
          }),
          signal: abortController.signal,
        });
        
        console.log('Streaming response status:', response.status, response.ok);

        if (!response.ok) {
          // For streaming responses, try to get error message from response
          let errorMessage = 'Failed to send message';
          try {
            // Try to read as text first for streaming responses
            const errorText = await response.text();
            try {
              const errorData = JSON.parse(errorText);
              errorMessage = errorData.error || errorMessage;
            } catch (e) {
              errorMessage = errorText || response.statusText || errorMessage;
            }
          } catch (e) {
            errorMessage = response.statusText || errorMessage;
          }
          throw new Error(errorMessage);
        }
        
        // Check if response is actually a stream
        if (!response.body) {
          throw new Error('No response body received');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = '';

        while (true) {
          // Check if request was aborted
          if (abortController.signal.aborted) {
            reader.cancel();
            break;
          }

          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim() !== '');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                // Start polling and add to sidebar when we receive the conversation ID
                if (data.conversationId && !dbConversationId) {
                  startPolling(data.conversationId);
                  // Add conversation to sidebar immediately
                  addConversationToSidebar(data.conversationId);
                  // Save to localStorage
                  localStorage.setItem('lastActiveConversationId', data.conversationId);
                }

                if (data.content) {
                  accumulatedContent += data.content;
                  // Update the streaming message in real-time
                  setStreamingMessage(accumulatedContent);

                  // Update conversation with accumulated content (polling will also update from DB)
                  const updatedMessages = [...(tempConversation.messages || [])];
                  if (updatedMessages.length > 0) {
                    updatedMessages[updatedMessages.length - 1] = {
                      ...updatedMessages[updatedMessages.length - 1],
                      content: accumulatedContent,
                    };
                  }
                  setCurrentConversation({
                    ...tempConversation,
                    messages: updatedMessages,
                  });
                  scrollToBottom();
                }
                if (data.done && data.conversation) {
                  // Stop polling
                  if (pollingInterval) {
                    clearInterval(pollingInterval);
                    pollingInterval = null;
                  }
                  // Streaming complete, update with final conversation from database
                  setCurrentConversation(data.conversation);
                  // Save to localStorage
                  localStorage.setItem('lastActiveConversationId', data.conversation._id);
                  // Update sidebar with final conversation
                  setConversations(prev => {
                    const exists = prev.some(conv => conv._id === data.conversation._id);
                    if (exists) {
                      return prev.map(conv =>
                        conv._id === data.conversation._id ? data.conversation : conv
                      ).sort((a, b) =>
                        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
                      );
                    } else {
                      return [data.conversation, ...prev];
                    }
                  });
                  setStreamingMessage('');
                  break;
                }
                if (data.error) {
                  // Stop polling on error
                  if (pollingInterval) {
                    clearInterval(pollingInterval);
                    pollingInterval = null;
                  }
                  setError(data.error);
                  setLoading(false);
                  setStreamingMessage('');
                  // Remove temporary messages on error
                  if (tempConversation) {
                    const originalMessages = currentConversation?.messages || [];
                    setCurrentConversation(currentConversation ? {
                      ...currentConversation,
                      messages: originalMessages,
                    } : null);
                  }
                  break;
                }
              } catch (e) {
                // Skip invalid JSON
                continue;
              }
            }
          }
        }
      } catch (err: any) {
        // Stop polling on error
        if (pollingInterval) {
          clearInterval(pollingInterval);
          pollingInterval = null;
        }

        // Don't show error if request was aborted
        if (err.name === 'AbortError' || abortController.signal.aborted) {
          // Remove the temporary messages on cancellation
          if (tempConversation) {
            // Restore to original conversation state (before adding user message)
            setCurrentConversation(currentConversation || null);
          }
          setError('Request cancelled');
          // Restore the message in the textarea
          setMessage(userMessage);
        } else {
          setError(err.message || 'Failed to send message');
          // Remove the temporary messages on error
          if (tempConversation) {
            const originalMessages = currentConversation?.messages || [];
            setCurrentConversation(currentConversation ? {
              ...currentConversation,
              messages: originalMessages,
            } : null);
          }
        }
      } finally {
        // Ensure polling is stopped
        if (pollingInterval) {
          clearInterval(pollingInterval);
          pollingInterval = null;
        }
        setLoading(false);
        setStreamingMessage('');
        abortControllerRef.current = null;
      }
    } else {
      // Non-streaming response
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversationId: currentConversation?._id,
            message: userMessage,
            model: selectedModel,
            temperature: temperature,
            stream: false,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to send message');
        }

        const result = await response.json();
        setCurrentConversation(result.conversation);
        // Save to localStorage
        localStorage.setItem('lastActiveConversationId', result.conversation._id);

        // Add/update conversation in sidebar immediately
        setConversations(prev => {
          const exists = prev.some(conv => conv._id === result.conversation._id);
          if (exists) {
            return prev.map(conv =>
              conv._id === result.conversation._id ? result.conversation : conv
            ).sort((a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            );
          } else {
            return [result.conversation, ...prev];
          }
        });
      } catch (err: any) {
        // Don't show error if request was aborted
        if (err.name === 'AbortError' || abortController.signal.aborted) {
          setError('Request cancelled');
          // Restore the message in the textarea
          setMessage(userMessage);
        } else {
          setError(err.message || 'Failed to send message');
          // Restore the message in the textarea on error
          setMessage(userMessage);
        }
      } finally {
        setLoading(false);
        abortControllerRef.current = null;
      }
    }
  };

  const handleDeleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this conversation?')) {
      try {
        await apiClient.deleteConversation(conversationId);
        // Clear from localStorage if it was the last active conversation
        const lastActiveId = localStorage.getItem('lastActiveConversationId');
        if (lastActiveId === conversationId) {
          localStorage.removeItem('lastActiveConversationId');
        }
        if (currentConversation?._id === conversationId) {
          handleNewConversation();
        }
        await loadConversations();
      } catch (err: any) {
        setError('Failed to delete conversation: ' + (err.message || 'Unknown error'));
      }
    }
  };

  const handleUpdateSettings = async () => {
    if (!currentConversation) return;

    try {
      const updated = await apiClient.updateConversation(currentConversation._id, {
        model: selectedModel,
        temperature: temperature,
        stream: stream,
      });
      setCurrentConversation(updated);
      
      // Update the conversation in the sidebar list
      setConversations(prev => {
        const exists = prev.some(conv => conv._id === updated._id);
        if (exists) {
          return prev.map(conv => 
            conv._id === updated._id ? updated : conv
          ).sort((a, b) => 
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        } else {
          return [updated, ...prev];
        }
      });
    } catch (err: any) {
      setError('Failed to update settings: ' + (err.message || 'Unknown error'));
    }
  };

  return (
    <Container fluid className="vh-100 d-flex flex-column p-0 m-0" style={{ maxWidth: '100%' }}>
      <Row className="flex-grow-1 m-0 g-0" style={{ minHeight: 0 }}>
        {/* Sidebar - Conversations */}
        <Col md={3} className="border-end p-3 bg-light" style={{ overflowY: 'auto', maxHeight: '100vh' }}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h4>Conversations</h4>
            <Button style={{ backgroundColor: 'transparent', border: 'none' }} size="sm" onClick={handleNewConversation}>
              <AddCircleOutlineIcon style={{ "color": "black" }} />
            </Button>
          </div>
          <ListGroup>
            {conversations.map((conv) => (
              <ListGroup.Item
                key={conv._id}
                className={`conversation-item ${currentConversation?._id === conv._id ? 'active' : ''}`}
                onClick={() => handleConversationSelect(conv._id)}
              >
                <div className="d-flex justify-content-between align-items-start">
                  <div className="flex-grow-1">
                    <div className="fw-bold">{conv.title}</div>
                    <small className="text-muted">
                      {new Date(conv.updatedAt).toLocaleDateString()}
                    </small>
                    <div>
                      <Badge bg="secondary" className="me-1">{conv.model}</Badge>
                      <Badge bg="info">T: {conv.temperature}</Badge>
                    </div>
                  </div>
                  <Button
                    variant="link"
                    size="sm"
                    className="text-danger p-0 ms-2"
                    onClick={(e) => handleDeleteConversation(conv._id, e)}
                  >
                    ×
                  </Button>
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </Col>

        {/* Main Chat Area */}
        <Col md={9} className="d-flex flex-column p-0" style={{ minHeight: 0, height: '100vh', overflow: 'hidden' }}>
          <Card className="d-flex flex-column m-0 h-100" style={{ minHeight: 0, height: '100%', borderRadius: 0, display: 'flex', flexDirection: 'column' }}>
            <Card.Header className="flex-shrink-0" style={{ flexShrink: 0 }}>
              <Row className="align-items-center">
                <Col>
                  <h5 className="mb-0">
                    {currentConversation ? currentConversation.title : 'New Conversation'}
                  </h5>
                </Col>
                <Col xs="auto">
                  <div className="d-flex gap-2 align-items-center">
                    <Form.Select
                      size="sm"
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      style={{ width: '150px' }}
                      disabled={loadingModels}
                    >
                      {loadingModels ? (
                        <option>Loading...</option>
                      ) : models.length === 0 ? (
                        <option>No models</option>
                      ) : (
                        models.map((model) => (
                          <option key={model.name} value={model.name}>
                            {model.name}
                          </option>
                        ))
                      )}
                    </Form.Select>
                    <Form.Range
                      min="0"
                      max="2"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      style={{ width: '100px' }}
                    />
                    <Form.Label className="mb-0" style={{ width: '60px' }}>
                      T: {temperature.toFixed(1)}
                    </Form.Label>
                    <Form.Check
                      type="switch"
                      id="stream-toggle"
                      label="Stream"
                      checked={stream}
                      onChange={(e) => setStream(e.target.checked)}
                      style={{ whiteSpace: 'nowrap' }}
                    />
                    {currentConversation && (
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={handleUpdateSettings}
                      >
                        Update
                      </Button>
                    )}
                  </div>
                </Col>
              </Row>
            </Card.Header>

            <Card.Body className="message-container" style={{ overflowY: 'auto', flex: '1 1 0', minHeight: 0, maxHeight: '100%' }}>
              {error && (
                <Alert variant="danger" dismissible onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}

              {currentConversation?.messages.length === 0 && !loading && (
                <div className="text-center text-muted mt-5">
                  <p>Start a new conversation by typing a message below.</p>
                </div>
              )}

              {currentConversation?.messages.map((msg: Message, index: number) => (
                <div
                  key={index}
                  className={`message-bubble ${msg.role === 'user' ? 'message-user' : 'message-assistant'
                    }`}
                >
                  <div className="fw-bold mb-2">
                    {msg.role === 'user' ? 'You' : 'Assistant'}
                  </div>
                  {msg.role === 'assistant' ? (
                    <div className="markdown-content">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          // Style code blocks
                          code: ({ node, inline, className, children, ...props }: any) => {
                            const match = /language-(\w+)/.exec(className || '');
                            return !inline && match ? (
                              <pre className="bg-dark text-light p-3 rounded mb-2" style={{ overflowX: 'auto' }}>
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              </pre>
                            ) : (
                              <code className="bg-light px-1 rounded" {...props}>
                                {children}
                              </code>
                            );
                          },
                          // Style paragraphs
                          p: ({ node, ...props }: any) => <p className="mb-2" {...props} />,
                          // Style headings
                          h1: ({ node, ...props }: any) => <h1 className="h4 mb-2 mt-3" {...props} />,
                          h2: ({ node, ...props }: any) => <h2 className="h5 mb-2 mt-3" {...props} />,
                          h3: ({ node, ...props }: any) => <h3 className="h6 mb-2 mt-3" {...props} />,
                          // Style lists
                          ul: ({ node, ...props }: any) => <ul className="mb-2 ps-3" {...props} />,
                          ol: ({ node, ...props }: any) => <ol className="mb-2 ps-3" {...props} />,
                          li: ({ node, ...props }: any) => <li className="mb-1" {...props} />,
                          // Style blockquotes
                          blockquote: ({ node, ...props }: any) => (
                            <blockquote className="border-start border-3 border-secondary ps-3 py-2 mb-2 bg-light" {...props} />
                          ),
                          // Style links
                          a: ({ node, ...props }: any) => <a className="text-primary" target="_blank" rel="noopener noreferrer" {...props} />,
                          // Style tables
                          table: ({ node, ...props }: any) => (
                            <div className="table-responsive mb-2">
                              <table className="table table-bordered table-sm" {...props} />
                            </div>
                          ),
                          thead: ({ node, ...props }: any) => <thead className="table-light" {...props} />,
                          // Style horizontal rules
                          hr: ({ node, ...props }: any) => <hr className="my-3" {...props} />,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="text-center">
                  <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </Spinner>
                </div>
              )}

              <div ref={messagesEndRef} />
            </Card.Body>

            <Card.Footer className="m-0" style={{ borderTop: '1px solid #dee2e6', flexShrink: 0, marginTop: 'auto' }}>
              <Form onSubmit={handleSubmit}>
                <Row className="align-items-end">
                  <Col>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Enter your message here..."
                      disabled={loading}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit(e);
                        }
                      }}
                    />
                  </Col>
                  <Col xs="auto">
                    <div className="d-flex gap-2">
                      {loading && (
                        <Button
                          type="button"
                          variant="danger"
                          onClick={handleCancel}
                        >
                          <HighlightOffIcon />
                        </Button>
                      )}
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={loading || !message.trim()}
                      >
                        {loading ? (
                          <>
                            <Spinner
                              as="span"
                              animation="border"
                              size="sm"
                              role="status"
                              aria-hidden="true"
                              className="me-2"
                            />
                            Sending...
                          </>
                        ) : (
                          <SendIcon />
                        )}
                      </Button>
                    </div>
                  </Col>
                </Row>
              </Form>
            </Card.Footer>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

