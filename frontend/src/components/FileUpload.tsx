import React, { useState, useContext } from 'react';
import { GraphContext } from '../context/GraphContext';
import { extractText } from '../hooks/useApi';

const FileUpload: React.FC = () => {
  const { setGraph } = useContext(GraphContext);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
    setError('');
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let graphData = null;

      if (file) {
        const form = new FormData();
        form.append('file', file);
        graphData = await extractText(form);
      } else if (text.trim()) {
        graphData = await extractText({ text });
      } else {
        setError('Please provide text or a file!');
        setLoading(false);
        return;
      }

      setGraph(graphData);
    } catch (err: any) {
      setError(err.message || 'Extraction failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Upload Document</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Text Input */}
        <div>
          <label className="block text-xs text-gray-500 mb-2">Paste Text:</label>
          <textarea
            value={text}
            onChange={handleTextChange}
            placeholder="Paste your document text here..."
            disabled={loading}
            className="w-full h-32 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm placeholder-gray-600 focus:outline-none focus:border-emerald-500 resize-none"
          />
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-xs text-gray-500 mb-2">Or Upload File:</label>
          <input
            type="file"
            accept=".pdf,.txt,.md"
            onChange={handleFileChange}
            disabled={loading}
            className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 file:cursor-pointer"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || (!file && !text.trim())}
          className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-lg font-medium transition-all"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Extracting...
            </span>
          ) : (
            'Extract Graph'
          )}
        </button>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-950 border border-red-800 rounded text-red-400 text-sm">
            {error}
          </div>
        )}
      </form>
    </div>
  );
};

export default FileUpload;
