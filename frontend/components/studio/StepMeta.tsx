import React, { memo } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';

interface Props {
  title: string;
  setTitle: (v: string) => void;
  synopsis: string;
  setSynopsis: (v: string) => void;
  director: string;
  setDirector: (v: string) => void;
  year: string;
  setYear: (v: string) => void;
  genre: string;
  setGenre: (v: string) => void;
  runtime: string;
  setRuntime: (v: string) => void;
  language: string;
  setLanguage: (v: string) => void;
}

const StepMeta = ({
  title, setTitle,
  synopsis, setSynopsis,
  director, setDirector,
  year, setYear,
  genre, setGenre,
  runtime, setRuntime,
  language, setLanguage,
}: Props) => {

  const isValid = title.trim().length > 0;

  return (
    <ScrollView style={styles.wrap}>
      <Text style={styles.label}>Titre *</Text>
      <TextInput value={title} onChangeText={setTitle} style={styles.input} />

      <Text style={styles.label}>Synopsis</Text>
      <TextInput value={synopsis} onChangeText={setSynopsis} style={styles.textarea} multiline />

      <Text style={styles.label}>Réalisateur</Text>
      <TextInput value={director} onChangeText={setDirector} style={styles.input} />

      <Text style={styles.label}>Année</Text>
      <TextInput value={year} onChangeText={setYear} style={styles.input} keyboardType="numeric" />

      <Text style={styles.label}>Genre</Text>
      <TextInput value={genre} onChangeText={setGenre} style={styles.input} />

      <Text style={styles.label}>Durée</Text>
      <TextInput value={runtime} onChangeText={setRuntime} style={styles.input} />

      <Text style={styles.label}>Langue</Text>
      <TextInput value={language} onChangeText={setLanguage} style={styles.input} />

      {!isValid && <Text style={styles.error}>Titre requis</Text>}
    </ScrollView>
  );
};

export default memo(StepMeta);

const styles = StyleSheet.create({
  wrap: { padding: 16 },
  label: { color: '#aaa', marginTop: 12 },
  input: { backgroundColor: '#111', color: '#fff', padding: 10, borderRadius: 8 },
  textarea: { backgroundColor: '#111', color: '#fff', padding: 10, borderRadius: 8, minHeight: 100 },
  error: { color: 'red', marginTop: 10 },
});