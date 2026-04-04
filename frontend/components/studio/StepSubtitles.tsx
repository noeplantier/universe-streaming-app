import React, { memo } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList } from 'react-native';

interface Subtitle {
  start: number;
  end: number;
  text: string;
}

interface Props {
  subtitles: Subtitle[];
  setSubtitles: (s: Subtitle[]) => void;
}

const formatTime = (s: number) => {
  const d = new Date(s * 1000).toISOString().substr(11, 12);
  return d.replace('.', ',');
};

export const generateSRT = (subs: Subtitle[]) =>
  subs.map((s, i) =>
    `${i + 1}\n${formatTime(s.start)} --> ${formatTime(s.end)}\n${s.text}\n`
  ).join('\n');

const StepSubtitles = ({ subtitles, setSubtitles }: Props) => {

  const add = () => {
    setSubtitles([...subtitles, { start: 0, end: 2, text: '' }]);
  };

  const update = (i: number, key: keyof Subtitle, value: any) => {
    const copy = [...subtitles];
    copy[i][key] = value;
    setSubtitles(copy);
  };

  return (
    <View>
      <TouchableOpacity onPress={add}>
        <Text>➕ Ajouter</Text>
      </TouchableOpacity>

      <FlatList
        data={subtitles}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item, index }) => (
          <View>
            <TextInput
              value={item.text}
              onChangeText={(v) => update(index, 'text', v)}
              placeholder="Texte"
            />
          </View>
        )}
      />
    </View>
  );
};

export default memo(StepSubtitles);