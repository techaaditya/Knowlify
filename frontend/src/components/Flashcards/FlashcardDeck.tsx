import React, { useState } from 'react';

interface Flashcard {
  id: string;
  front: string;
  back: string;
}

export const FlashcardDeck: React.FC<{ concept: string; description: string }> = ({ concept, description }) => {
  const cards: Flashcard[] = [
    {
      id: '1',
      front: `Define the primary essence of: ${concept}`,
      back: description
    },
    {
      id: '2',
      front: `Why is ${concept} considered critical in the curriculum?`,
      back: `Understanding ${concept} satisfies core requirements and acts as a prerequisite for advanced topics.`
    }
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const card = cards[currentIndex];

  const handleNext = () => {
    setFlipped(false);
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % cards.length);
    }, 200);
  };

  return (
    <div className="border border-theme-border rounded-lg bg-white p-4 flex flex-col items-center justify-between h-[250px] shadow-sm">
      <div className="text-center w-full">
        <span className="text-[10px] uppercase tracking-wider text-theme-muted">Flashcard {currentIndex + 1} of {cards.length}</span>
      </div>
      
      <div 
        onClick={() => setFlipped(!flipped)}
        className="w-full flex-grow flex items-center justify-center border border-dashed border-theme-border rounded bg-theme-bg p-4 cursor-pointer hover:bg-[#F3EFE9] transition-colors text-center"
      >
        <p className="text-xs font-medium text-theme-text max-w-[200px]">
          {flipped ? card.back : card.front}
        </p>
      </div>

      <div className="flex gap-4 mt-3">
        <button 
          onClick={() => setFlipped(!flipped)}
          className="text-xs border border-theme-border rounded px-3 py-1.5 hover:bg-[#FAF9F6] active:scale-95 transition-transform"
        >
          Flip Card
        </button>
        <button 
          onClick={handleNext}
          className="text-xs bg-mastery-unstarted-border text-white rounded px-3 py-1.5 hover:opacity-90 active:scale-95 transition-transform"
        >
          Next Card
        </button>
      </div>
    </div>
  );
};
