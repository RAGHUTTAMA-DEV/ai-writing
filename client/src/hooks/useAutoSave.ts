import { useEffect, useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';

interface AutoSaveOptions {
  delay?: number; // Delay in milliseconds before auto-saving
  enabled?: boolean;
}

export const useAutoSave = (options: AutoSaveOptions = {}) => {
  const { delay = 5000, enabled = true } = options;
  const { activeProject, updateProject } = useProjectStore();
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  // Auto-save functionality
  useEffect(() => {
    if (!enabled || !hasUnsavedChanges || !activeProject) return;

    const autoSaveTimer = setTimeout(async () => {
      try {
        setIsAutoSaving(true);
        await updateProject(activeProject.id, { content: activeProject.content });
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
      } catch (error) {
        console.error('Auto-save failed:', error);
      } finally {
        setIsAutoSaving(false);
      }
    }, delay);

    return () => clearTimeout(autoSaveTimer);
  }, [hasUnsavedChanges, activeProject, enabled, delay, updateProject]);

  const save = async (content?: string) => {
    if (!activeProject) return false;

    try {
      const saveContent = content || activeProject.content || '';
      await updateProject(activeProject.id, { content: saveContent });
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      return true;
    } catch (error) {
      console.error('Save failed:', error);
      throw error;
    }
  };

  const markAsChanged = () => {
    if (!isAutoSaving) {
      setHasUnsavedChanges(true);
    }
  };

  return {
    lastSaved,
    hasUnsavedChanges,
    isAutoSaving,
    save,
    markAsChanged,
    setHasUnsavedChanges
  };
};
