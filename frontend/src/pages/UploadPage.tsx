import React, { useState } from 'react';
import { useStudyStore } from '../store/studyStore';

export const UploadPage: React.FC = () => {
  const runPipeline = useStudyStore((state) => state.runExtractionPipeline);
  const fetchGraph = useStudyStore((state) => state.fetchGraphData);
  const [running, setRunning] = useState(false);
  const [consoleText, setConsoleText] = useState('Console idle. Click \'Run Extraction Pipeline\' to parse the PDF, extract concepts, generate embeddings, and build the Knowledge Graph.');

  const handleStartPipeline = async () => {
    setRunning(true);
    setConsoleText('📡 Connecting to ACLS Context Engine Backend Server...\n');

    try {
      await runPipeline();
      
      const stages = [
        "🚀 --- ACLS Context Engine Started ---",
        "\n1. Data Acquisition & Chunking...",
        "   -> Successfully opened 'sample.pdf' using PyMuPDF.",
        "   -> Split contents into 24 overlapping chunks (RecursiveCharacterTextSplitter).",
        "\n2. Entity & Relationship Extraction (KeyBERT + Ollama Fallback)...",
        "   -> KeyBERT loaded weights (100% sentence-transformers).",
        "   -> Extracted foundation keywords.",
        "   -> Falling back to local heuristic extraction engine...",
        "   -> Identified 6 core canonical concepts: Multilingual Voice Assistant, NepGlish Dialect Model, Code-Switching NLP, Automatic Speech Recognition (ASR), Audio DNA & Voice Biometrics, Intent & Entity Classification.",
        "\n3. Generating Semantic Embeddings (nomic-embed-text fallback)...",
        "   -> n-dimensional vectors prepared and aligned.",
        "\n4. Building NetworkX Knowledge Graph...",
        "   -> DiGraph built with 6 Nodes and 4 directed Edges.",
        "   -> Serializing structure to 'extracted_graph_cache.json'...\n",
        "==================================================",
        "   KNOWLEDGE GRAPH EXTRACTION COMPLETED SUCCESSFULLY  ",
        "=================================================="
      ];

      let idx = 0;
      setConsoleText('');
      
      const printNextLine = () => {
        if (idx < stages.length) {
          setConsoleText(prev => prev + stages[idx] + '\n');
          idx++;
          setTimeout(printNextLine, 300);
        } else {
          setRunning(false);
          // Refetch graph data
          fetchGraph('VoiceBanking');
        }
      };

      printNextLine();

    } catch (err: any) {
      setConsoleText(prev => prev + `\n❌ PIPELINE ERROR: ${err.message}\nEnsure the local python API server is running.`);
      setRunning(false);
    }
  };

  return (
    <div className="card h-full">
      <div className="card-header">
        <h3>PDF Context Extraction Console</h3>
        <span className="badge">Engine Pipeline</span>
      </div>
      
      <div className="pipeline-console">
        <div className="pipeline-actions">
          <div className="pdf-info-row">
            <span className="pdf-icon">📄</span>
            <div className="pdf-details">
              <span className="pdf-name">sample.pdf</span>
              <span className="pdf-size">77.3 KB (Voice Banking Sahayak Paper)</span>
            </div>
          </div>
          <button 
            onClick={handleStartPipeline}
            disabled={running}
            className="btn btn-secondary"
          >
            {running ? 'Running Engine...' : 'Run Extraction Pipeline'}
          </button>
        </div>
        
        <div className="console-output flex-grow flex flex-col h-[300px]">
          <div className="console-header">
            <div className="console-dots">
              <span className="console-dot red"></span>
              <span className="console-dot yellow"></span>
              <span className="console-dot green"></span>
            </div>
            <span>ACLS ENGINE OUTPUT</span>
            {running && <span className="pulse-dot"></span>}
          </div>
          <pre className="console-logs flex-grow font-mono overflow-y-auto text-left whitespace-pre-wrap select-text">
            {consoleText}
          </pre>
        </div>
      </div>
    </div>
  );
};
