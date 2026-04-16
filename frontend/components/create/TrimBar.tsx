import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from './tokens'; // Ajustez le chemin de vos tokens si nécessaire

export interface TrimBarProps {
  start: number;
  end: number;
  duration: number; // Durée totale de la vidéo
  onStartChange: (val: number) => void;
  onEndChange: (val: number) => void;
}

const TrimBar = memo(({ start, end, duration, onStartChange, onEndChange }: TrimBarProps) => {
  const currentDuration = Math.max(0, end - start);
  const isError = currentDuration <= 0;

  // Calcul des pourcentages pour la barre visuelle
  const leftPercent = (start / duration) * 100 || 0;
  const rightPercent = ((duration - end) / duration) * 100 || 0;
  // La partie centrale (10% d'accent cyan)
  const selectedPercent = 100 - leftPercent - rightPercent;

  const step = 1; // Pas d'incrémentation en secondes

  const handleStartDec = () => onStartChange(Math.max(0, start - step));
  const handleStartInc = () => onStartChange(Math.min(end - 1, start + step));
  
  const handleEndDec = () => onEndChange(Math.max(start + 1, end - step));
  const handleEndInc = () => onEndChange(Math.min(duration, end + step));

  return (
    <View style={s.wrap}>
      {/* ── HEADER ── */}
      <View style={s.header}>
        <Text style={s.label}>Édition de la durée</Text>
        <View style={[s.durBadge, isError && s.durBadgeErr]}>
          <Ionicons name="time-outline" size={14} color={isError ? '#FF3B5C' : '#FFF'} />
          <Text style={[s.durTxt, { color: isError ? '#FF3B5C' : '#FFF' }]}>
            {currentDuration}s
          </Text>
        </View>
      </View>

        {/* ── TRACK VISUELLE ── */}
        <View style={s.track}>
          {/* Exclu (Gauche) */}
          <View style={[s.excluded, { width: `${leftPercent}%` }]} />
          {/* Sélectionné (Accent 10% Blanc) */}
          <View style={[s.selected, { width: `${selectedPercent}%` }]} />
          {/* Exclu (Droite) */}
          <View style={[s.excluded, { width: `${rightPercent}%` }]} />
        </View>

      {/* ── CONTROLES ── */}
      <View style={s.controls}>
        {/* Début */}
        <View style={s.ctrl}>
          <Text style={s.ctrlLabel}>Début</Text>
          <View style={s.ctrlRow}>
            <TouchableOpacity style={s.ctrlBtn} onPress={handleStartDec}>
              <Ionicons name="remove" size={16} color="#FFF" />
            </TouchableOpacity>
            <Text style={s.ctrlVal}>{start}s</Text>
            <TouchableOpacity style={s.ctrlBtn} onPress={handleStartInc}>
              <Ionicons name="add" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>


        {/* Fin */}
        <View style={s.ctrl}>
          <Text style={s.ctrlLabel}>Fin</Text>
          <View style={s.ctrlRow}>
            <TouchableOpacity style={s.ctrlBtn} onPress={handleEndDec}>
              <Ionicons name="remove" size={16} color="#FFF" />
            </TouchableOpacity>
            <Text style={s.ctrlVal}>{end}s</Text>
            <TouchableOpacity style={s.ctrlBtn} onPress={handleEndInc}>
              <Ionicons name="add" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {isError && <Text style={s.errTxt}>La durée doit être supérieure à 0s.</Text>}
    </View>
  );
});

TrimBar.displayName = 'TrimBar';

export default TrimBar;

const s = StyleSheet.create({
  // 60% Dominant : Fond de la Wrap en C.navyMid
  wrap: { 
    backgroundColor: '#0b1e2e', // Légère teinte cyan
    borderRadius: 18, 
    padding: 16, 
    marginBottom: 16,
    // Ombre douce pour séparer du fond global
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  label: { 
    color: '#FFFFFF', 
    fontSize: 14, 
    fontWeight: '700' 
  },
  // 30% Secondaire : Fonds des badges et boutons
  durBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 12, 
    backgroundColor: 'rgba(255, 255, 255, 0.1)', // Légère teinte cyan
  },
  durBadgeErr: { 
    backgroundColor: 'rgba(255,59,92,0.12)', 
  },
  durTxt: { 
    fontSize: 12, 
    fontWeight: 'bold' 
  },
  track: { 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: 'rgba(255,255,255,0.05)', // Fond track
    flexDirection: 'row', 
    overflow: 'hidden', 
    marginBottom: 20 
  },
  excluded: { 
    height: '100%', 
    backgroundColor: 'rgba(255,255,255,0.1)' // Partie non sélectionnée
  },
  // 10% Accent : Le Cyan
  selected: { 
    height: '100%',
    backgroundColor: '#FFF',
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  controls: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between' 
  },
  ctrl: { 
    flex: 1, 
    alignItems: 'center', 
    gap: 8 
  },
  ctrlLabel: { 
    color: 'rgba(255,255,255,0.6)', 
    fontSize: 11, 
    fontWeight: '600', 
    textTransform: 'uppercase', 
    letterSpacing: 0.5 
  },
  ctrlRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12 
  },
  ctrlBtn: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    backgroundColor: 'rgba(255,255,255,0.1)', // 30% neutre interactif
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  ctrlVal: { 
    color: '#FFFFFF', 
    fontSize: 15, 
    fontWeight: '700', 
    minWidth: 32, 
    textAlign: 'center' 
  },

  errTxt: { 
    color: '#FF3B5C', 
    fontSize: 12, 
    marginTop: 12, 
    textAlign: 'center', 
    fontWeight: '500' 
  },
});