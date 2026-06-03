import React from 'react';
import { useStudyStore } from '../store/studyStore';
import { ChatWindow } from '../components/Chat/ChatWindow';
import { FlashcardDeck } from '../components/Flashcards/FlashcardDeck';

export const StudyPage: React.FC = () => {
  const selectedNodeData = useStudyStore((state) => state.selectedNodeData);

  return (
    <div className="space-y-6">
      <div className="dashboard-header">
        <div className="header-title">
          <h2>Generative Learning Console</h2>
          <p>Practice using flashcards and interact with a Socratic tutoring agent</p>
        </div>
      </div>

      {!selectedNodeData ? (
        <div className="card items-center justify-center p-12 text-center h-[300px]">
          <span className="text-3xl mb-3">📖</span>
          <h3 className="font-bold text-sm mb-1">No Concept Selected</h3>
          <p className="text-xs text-theme-muted max-w-[280px]">
            Please head over to the <strong>Knowledge Map</strong> tab and select a concept node to activate the Socratic tutor and review flashcards.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-theme-muted">Socratic Inquiry Chat</h3>
            <ChatWindow concept={selectedNodeData.display_name} />
          </div>
          
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-theme-muted">Flashcard deck review</h3>
            <FlashcardDeck 
              concept={selectedNodeData.display_name} 
              description={selectedNodeData.description} 
            />
          </div>
        </div>
      )}
    </div>
  );
};
