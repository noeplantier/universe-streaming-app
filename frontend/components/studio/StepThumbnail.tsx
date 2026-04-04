import React, { memo } from 'react';
import { View, Image, TouchableOpacity, FlatList } from 'react-native';

interface Props {
  frames: string[];
  selectedFrame: string | null;
  setSelectedFrame: (v: string) => void;
  customThumb: string | null;
  onPickCustom: () => void;
}

const StepThumbnail = ({
  frames,
  selectedFrame,
  setSelectedFrame,
  customThumb,
  onPickCustom,
}: Props) => {

  return (
    <View>
      <FlatList
        horizontal
        data={frames}
        keyExtractor={(i) => i}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setSelectedFrame(item)}>
            <Image source={{ uri: item }} style={{ width: 100, height: 60 }} />
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity onPress={onPickCustom}>
        <Image
          source={{ uri: customThumb || selectedFrame || '' }}
          style={{ width: 200, height: 120 }}
        />
      </TouchableOpacity>
    </View>
  );
};

export default memo(StepThumbnail);