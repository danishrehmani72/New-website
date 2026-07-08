import React from 'react';
import { useTranslation } from '../contexts/LanguageContext';
import { Languages } from 'lucide-react';

export const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <Languages className="w-5 h-5 text-gray-400" />
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as 'en' | 'ur')}
        className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer"
      >
        <option value="en">English</option>
        <option value="ur">Roman Urdu</option>
      </select>
    </div>
  );
};
