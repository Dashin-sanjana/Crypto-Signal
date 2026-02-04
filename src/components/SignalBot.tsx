import React from 'react';
import { useSignalGenerator } from '../hooks/useSignalGenerator';

const SignalBot: React.FC = () => {
  useSignalGenerator();
  return null; // Logic only, no UI
};

export default SignalBot;
