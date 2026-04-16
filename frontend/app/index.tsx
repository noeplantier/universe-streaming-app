import { Redirect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import { COLORS } from '../constants/theme';

export default function Index() {
  

  // Always redirect to tabs - bypass auth for streaming experience
  return <Redirect href="/(tabs)" />;
}
