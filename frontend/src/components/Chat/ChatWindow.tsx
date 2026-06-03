import React, { useState } from 'react';
import client from '../../api/client';

export const ChatWindow: React.FC<{ concept: string }> = ({ concept }) => {
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'tutor'; text: string }>>([
    { sender: 'tutor', text: `Greetings! Let's explore '${concept}' together. What do you think this concept describes?` }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input;
    setInput('');
    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setLoading(true);

    try {
      const res = await client.post('/api/chat', {
        concept,
        message: userText
      });
      setMessages(prev => [...prev, { sender: 'tutor', text: res.data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { sender: 'tutor', text: 'Error connecting to the tutoring engine.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-theme-border rounded-lg bg-white p-4 flex flex-col h-[320px] shadow-sm">
      <div className="flex-grow overflow-y-auto mb-2 space-y-2 pr-1">
        {messages.map((m, idx) => (
          <div key={idx} className={`p-2 rounded text-xs leading-relaxed max-w-[85%] ${
            m.sender === 'user'
              ? 'bg-mastery-medium-bg border border-mastery-medium-border text-mastery-medium-text ml-auto'
              : 'bg-theme-bg border border-theme-border text-theme-text'
          }`}>
            <p>{m.text}</p>
          </div>
        ))}
        {loading && <div className="text-xs text-theme-muted animate-pulse">Socratic Tutor is thinking...</div>}
      </div>
      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={`Ask about ${concept}...`}
          className="border border-theme-border rounded p-1.5 text-xs flex-grow focus:outline-none focus:border-mastery-unstarted-border bg-theme-bg"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-mastery-unstarted-border text-white text-xs px-3 py-1.5 rounded hover:opacity-90 active:scale-95 transition-transform"
        >
          Send
        </button>
      </form>
    </div>
  );
};
