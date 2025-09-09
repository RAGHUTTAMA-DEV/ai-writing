import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Save } from 'lucide-react';

interface EditorProps {
  initialContent: string;
  onSave: (content: string) => Promise<void>;
  onChange: (content: string) => void;
}

export const Editor: React.FC<EditorProps> = ({ initialContent, onSave, onChange }) => {
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(content);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    onChange(newContent);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} className="flex items-center">
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
      <textarea
        value={content}
        onChange={handleChange}
        className="w-full h-96 p-4 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Start writing your story here..."
      />
    </div>
  );
};