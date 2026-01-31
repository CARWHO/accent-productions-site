'use client';

import React, { useState, useEffect, useRef } from 'react';

// Generate common time suggestions (30-minute intervals from 6am to 2am)
const timeSuggestions: string[] = [];
for (let hour = 6; hour <= 26; hour++) {
  const displayHour = hour >= 24 ? hour - 24 : hour;
  const ampm = (hour >= 12 && hour < 24) ? 'PM' : 'AM';
  const hour12 = displayHour === 0 ? 12 : (displayHour > 12 ? displayHour - 12 : displayHour);
  timeSuggestions.push(`${hour12}:00 ${ampm}`);
  timeSuggestions.push(`${hour12}:30 ${ampm}`);
}

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  hasError?: boolean;
  inputStyles: string;
}

export function TimeInput({
  value,
  onChange,
  placeholder,
  hasError,
  inputStyles,
}: TimeInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync internal state with external value
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Filter suggestions based on input
  const filteredSuggestions = inputValue
    ? timeSuggestions.filter(t =>
        t.toLowerCase().replace(/\s/g, '').includes(inputValue.toLowerCase().replace(/\s/g, ''))
      )
    : timeSuggestions;

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    setIsOpen(true);
    onChange(val);
  };

  const handleSelect = (time: string) => {
    setInputValue(time);
    onChange(time);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter' && filteredSuggestions.length > 0) {
      e.preventDefault();
      handleSelect(filteredSuggestions[0]);
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`${inputStyles} ${hasError ? 'border-red-500' : ''}`}
      />
      {isOpen && filteredSuggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-[100] w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto"
        >
          {filteredSuggestions.map((time) => (
            <div
              key={time}
              onClick={() => handleSelect(time)}
              className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm font-medium"
            >
              {time}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
