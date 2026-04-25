import React, { useState } from 'react';

// Define the shape of the data we get from the server
interface AIResult {
  message: string;
  ai_response: {
    status: string;
    action: string;
  };
}

const App: React.FC = () => {
  const [status, setStatus] = useState<string>("System Standby");
  const [result, setResult] = useState<AIResult | null>(null);

  const testSystem = async (): Promise<void> => {
    setStatus("Analyzing...");
    try {
      // Use 127.0.0.1 instead of localhost to avoid some browser DNS issues
      const res = await fetch('http://127.0.0.1:5000/test-ai');
      
      if (!res.ok) throw new Error("Server response was not ok");
      
      const data: AIResult = await res.json();
      setResult(data);
      setStatus("Analysis Complete");
    } catch (err) {
      console.error(err);
      setStatus("Connection Error");
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 font-sans">
      <header className="mb-12 border-b border-slate-700 pb-4">
        <h1 className="text-3xl font-bold text-blue-400">FraudShield</h1>
        <p className="text-slate-400 text-sm">Real-Time Financial Defense System</p>
      </header>

      <main className="max-w-2xl mx-auto">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-2xl">
          <h2 className="text-xl mb-4 font-semibold">Transaction Guard Test</h2>
          <div className="flex items-center justify-between bg-slate-900 p-4 rounded-lg mb-6 gap-4">
            <span>Status: <span className="text-blue-400 font-mono font-bold">{status}</span></span>
            <button 
              onClick={testSystem}
              className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-lg font-bold transition-all whitespace-nowrap"
            >
              Simulate High-Value Transaction
            </button>
          </div>

          {result && (
            <div className="mt-4">
              <h3 className="text-sm uppercase text-slate-500 font-bold mb-2">AI Engine Response:</h3>
              <pre className="bg-black p-4 rounded-lg text-green-400 text-xs overflow-x-auto border border-green-900/30">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;