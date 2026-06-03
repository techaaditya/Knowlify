import React from 'react';

interface MasteryItem {
  topic: string;
  mastery: number;
}

export const MasteryRadar: React.FC<{ data: MasteryItem[] }> = ({ data }) => {
  return (
    <div className="border border-theme-border rounded-lg bg-white p-4 shadow-sm flex flex-col h-[280px]">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-theme-muted mb-3">Topic Mastery Distribution</h4>
      
      {data.length === 0 ? (
        <div className="flex-grow flex items-center justify-center text-xs text-theme-muted">
          No metrics available.
        </div>
      ) : (
        <div className="flex-grow space-y-3 overflow-y-auto pr-1">
          {data.map((item, idx) => {
            const widthPct = `${Math.min(100, Math.max(0, item.mastery))}%`;
            let colorClass = "bg-mastery-unstarted-border";
            if (item.mastery >= 80) colorClass = "bg-mastery-strong-border";
            else if (item.mastery >= 50) colorClass = "bg-mastery-medium-border";
            else if (item.mastery > 0) colorClass = "bg-mastery-weak-border";

            return (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="truncate max-w-[150px]">{item.topic}</span>
                  <span>{item.mastery}%</span>
                </div>
                <div className="w-full bg-[#F2EFE9] h-2.5 rounded-full overflow-hidden border border-theme-border/30">
                  <div className={`h-full rounded-full ${colorClass}`} style={{ width: widthPct }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
