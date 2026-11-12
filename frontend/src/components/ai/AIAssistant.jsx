/**
 * RentIQ AI Assistant Floating Chat Component
 *
 * File: frontend/src/components/ai/AIAssistant.jsx
 *
 * Provides a modern floating AI chat button, responsive conversation window,
 * natural language question processing, typing indicator, suggested prompt chips,
 * and interactive vehicle recommendation cards.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    Sparkles,
    Bot,
    Send,
    X,
    Trash2,
    MessageSquare,
    RotateCcw,
    ChevronDown,
    Car,
    Clock,
    AlertCircle
} from 'lucide-react';
import { sendChatMessage, getSuggestedQuestions } from '../../api/aiService';
import VehicleRecommendationCard from './VehicleRecommendationCard';
import './AIAssistant.css';

const DEFAULT_SUGGESTED_QUESTIONS = [
    'Recommend a vehicle for me',
    'Find an SUV under ₹4,000/day',
    'Which vehicle is best for a family trip?',
    'Show me automatic vehicles',
    'Explain rental pricing',
    'How do I book a vehicle?'
];

const INITIAL_WELCOME_MESSAGE = {
    id: 'welcome-msg',
    role: 'assistant',
    content: `Hello! 👋 I am your **RentIQ AI Assistant**.\n\nI can help you:\n• Find and recommend the best vehicles from our verified fleet\n• Calculate authoritative rental pricing and explain discounts\n• Guide you through driving licence verification and booking\n\nHow can I help you today? You can choose one of the suggestions below or ask any question!`,
    recommendations: [],
    pricingEstimate: null,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
};

function AIAssistant() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([INITIAL_WELCOME_MESSAGE]);
    const [inputPrompt, setInputPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [suggestedQuestions, setSuggestedQuestions] = useState(DEFAULT_SUGGESTED_QUESTIONS);
    const [hasUnread, setHasUnread] = useState(false);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Auto-scroll to bottom of messages
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
            inputRef.current?.focus();
            setHasUnread(false);
        }
    }, [isOpen, messages, loading]);

    // Listen for custom open events from other pages (e.g. Vehicles page "Find Vehicles with AI")
    useEffect(() => {
        const handleOpenEvent = (e) => {
            setIsOpen(true);
            if (e?.detail?.prompt) {
                handleSend(e.detail.prompt);
            }
        };

        window.addEventListener('rentiq-open-ai-chat', handleOpenEvent);
        return () => window.removeEventListener('rentiq-open-ai-chat', handleOpenEvent);
    }, []);

    // Load initial suggested questions from backend if available
    useEffect(() => {
        let isMounted = true;
        getSuggestedQuestions()
            .then(suggestions => {
                if (isMounted && Array.isArray(suggestions) && suggestions.length > 0) {
                    setSuggestedQuestions(suggestions);
                }
            })
            .catch(() => {
                // Keep default suggestions
            });
        return () => { isMounted = false; };
    }, []);

    const toggleOpen = () => {
        setIsOpen(prev => !prev);
    };

    const handleClearChat = () => {
        setMessages([{
            ...INITIAL_WELCOME_MESSAGE,
            id: `welcome-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
        setSuggestedQuestions(DEFAULT_SUGGESTED_QUESTIONS);
    };

    const handleSend = async (messageText) => {
        const textToSend = (typeof messageText === 'string' ? messageText : inputPrompt).trim();
        if (!textToSend || loading) return;

        setInputPrompt('');

        const userMsg = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: textToSend,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        // Prepare conversation history to send
        const currentHistory = messages
            .filter(m => m.id !== 'welcome-msg')
            .map(m => ({ role: m.role, content: m.content }));

        setMessages(prev => [...prev, userMsg]);
        setLoading(true);

        try {
            const data = await sendChatMessage(textToSend, currentHistory);

            const botMsg = {
                id: `bot-${Date.now()}`,
                role: 'assistant',
                content: data.message || 'Here are the details from RentIQ:',
                recommendations: data.recommendations || [],
                pricingEstimate: data.pricingEstimate || null,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };

            setMessages(prev => [...prev, botMsg]);

            if (data.suggestedQuestions && data.suggestedQuestions.length > 0) {
                setSuggestedQuestions(data.suggestedQuestions);
            }

            if (!isOpen) {
                setHasUnread(true);
            }
        } catch (err) {
            console.error('AI chat error:', err);
            const errorMsg = {
                id: `bot-err-${Date.now()}`,
                role: 'assistant',
                content: 'I apologize, but I encountered an issue connecting to the assistant service. Please check your connection or try again in a moment.',
                recommendations: [],
                pricingEstimate: null,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Helper to format simple markdown (bold, bullet points, line breaks)
    const renderFormattedText = (text) => {
        if (!text) return null;

        // Split text into lines
        const lines = text.split('\n');
        return lines.map((line, idx) => {
            const trimmed = line.trim();

            // Bullet points
            if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                const bulletContent = trimmed.slice(2);
                return (
                    <div key={idx} className="ai-markdown-bullet">
                        <span className="bullet-dot">•</span>
                        <span>{formatInlineMarkdown(bulletContent)}</span>
                    </div>
                );
            }

            // Numbered list
            const numMatch = trimmed.match(/^([0-9]+\.)\s+(.*)$/);
            if (numMatch) {
                return (
                    <div key={idx} className="ai-markdown-bullet">
                        <span className="bullet-num">{numMatch[1]}</span>
                        <span>{formatInlineMarkdown(numMatch[2])}</span>
                    </div>
                );
            }

            // Empty line
            if (!trimmed) {
                return <div key={idx} className="ai-markdown-space" />;
            }

            // Normal paragraph
            return (
                <p key={idx} className="ai-markdown-p">
                    {formatInlineMarkdown(line)}
                </p>
            );
        });
    };

    // Formats bold **text** and italic *text*
    const formatInlineMarkdown = (str) => {
        const parts = str.split(/(\*\*.*?\*\*|\*.*?\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i}>{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('*') && part.endsWith('*')) {
                return <em key={i}>{part.slice(1, -1)}</em>;
            }
            return part;
        });
    };

    return (
        <aside className="rentiq-ai-container" aria-label="RentIQ AI Assistant">
            {/* Floating Trigger Button */}
            <button
                type="button"
                className={`rentiq-ai-floating-btn ${isOpen ? 'active' : ''}`}
                onClick={toggleOpen}
                aria-label={isOpen ? 'Close RentIQ AI Assistant' : 'Open RentIQ AI Assistant'}
                aria-expanded={isOpen}
            >
                <div className="ai-btn-icon-wrapper">
                    {isOpen ? (
                        <X size={24} className="ai-icon-close" />
                    ) : (
                        <>
                            <Sparkles size={24} className="ai-icon-sparkle" />
                            {hasUnread && <span className="ai-unread-badge" />}
                        </>
                    )}
                </div>
                {!isOpen && <span className="ai-btn-tooltip">RentIQ AI Assistant</span>}
            </button>

            {/* Chatbot Window */}
            {isOpen && (
                <div className="rentiq-ai-window" role="dialog" aria-modal="true" aria-label="RentIQ AI Assistant Window">
                    {/* Header */}
                    <div className="ai-window-header">
                        <div className="ai-header-brand">
                            <div className="ai-header-avatar">
                                <Sparkles size={18} className="ai-header-sparkle-icon" />
                            </div>
                            <div className="ai-header-title-wrap">
                                <h3 className="ai-header-title">RentIQ AI Assistant</h3>
                                <span className="ai-header-status">
                                    <span className="ai-status-indicator" />
                                    Live Fleet & Pricing Expert
                                </span>
                            </div>
                        </div>

                        <div className="ai-header-actions">
                            <button
                                type="button"
                                className="ai-header-btn"
                                onClick={handleClearChat}
                                title="Clear conversation"
                                aria-label="Clear conversation"
                            >
                                <Trash2 size={16} />
                            </button>
                            <button
                                type="button"
                                className="ai-header-btn"
                                onClick={toggleOpen}
                                title="Close Assistant"
                                aria-label="Close Assistant"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Chat Messages Stream */}
                    <div className="ai-window-messages">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`ai-message-row ${msg.role}`}>
                                {msg.role === 'assistant' && (
                                    <div className="ai-msg-avatar" aria-hidden="true">
                                        <Bot size={16} />
                                    </div>
                                )}

                                <div className="ai-msg-bubble">
                                    <div className="ai-msg-content">
                                        {renderFormattedText(msg.content)}
                                    </div>

                                    {/* Structured Vehicle Recommendation Cards */}
                                    {msg.recommendations && msg.recommendations.length > 0 && (
                                        <div className="ai-recommendations-list">
                                            {msg.recommendations.map((vehicle) => (
                                                <VehicleRecommendationCard
                                                    key={vehicle.vehicle_id}
                                                    vehicle={vehicle}
                                                    onActionClick={() => {
                                                        // Optional: keep window open or let user view
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    <span className="ai-msg-time">{msg.timestamp}</span>
                                </div>
                            </div>
                        ))}

                        {/* Typing Indicator */}
                        {loading && (
                            <div className="ai-message-row assistant">
                                <div className="ai-msg-avatar">
                                    <Bot size={16} />
                                </div>
                                <div className="ai-msg-bubble ai-typing-bubble">
                                    <div className="ai-typing-dots">
                                        <span className="dot dot-1" />
                                        <span className="dot dot-2" />
                                        <span className="dot dot-3" />
                                    </div>
                                    <span className="ai-typing-text">AI is checking fleet & pricing...</span>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Suggested Question Chips */}
                    {suggestedQuestions && suggestedQuestions.length > 0 && !loading && (
                        <div className="ai-suggested-questions-tray">
                            <span className="ai-tray-label">Suggested:</span>
                            <div className="ai-chips-scroll">
                                {suggestedQuestions.map((q, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        className="ai-suggestion-chip"
                                        onClick={() => handleSend(q)}
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Input Footer */}
                    <div className="ai-window-footer">
                        <form
                            className="ai-input-form"
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleSend();
                            }}
                        >
                            <input
                                ref={inputRef}
                                type="text"
                                className="ai-input-field"
                                placeholder="Ask about vehicles, pricing, family trips..."
                                value={inputPrompt}
                                onChange={(e) => setInputPrompt(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={loading}
                                maxLength={1000}
                                aria-label="Customer question for AI assistant"
                            />
                            <button
                                type="submit"
                                className="ai-send-btn"
                                disabled={loading || !inputPrompt.trim()}
                                aria-label="Send message"
                                title="Send"
                            >
                                <Send size={16} />
                            </button>
                        </form>
                        <div className="ai-footer-note">
                            Recommendations are grounded in RentIQ's live database & pricing engine.
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
}

export default AIAssistant;
