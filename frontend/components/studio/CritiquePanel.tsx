import React, { memo } from 'react';
import { View, TextInput, Text, TouchableOpacity } from 'react-native';

interface Props {
  filmTitle: string;
  setFilmTitle: (v: string) => void;
  critiqueText: string;
  setCritiqueText: (v: string) => void;
  publishing: boolean;
  onPublish: () => void;
}

const CritiquePanel = ({
  filmTitle,
  setFilmTitle,
  critiqueText,
  setCritiqueText,
  publishing,
  onPublish,
}: Props) => {

  const valid = filmTitle && critiqueText;

  return (
    <View>
      <TextInput
        value={filmTitle}
        onChangeText={setFilmTitle}
        placeholder="Film"
      />

      <TextInput
        value={critiqueText}
        onChangeText={setCritiqueText}
        placeholder="Critique"
        multiline
      />

      <TouchableOpacity disabled={!valid || publishing} onPress={onPublish}>
        <Text>{publishing ? 'Publication...' : 'Publier'}</Text>
      </TouchableOpacity>
    </View>
  );
};

export default memo(CritiquePanel);