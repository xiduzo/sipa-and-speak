import ISO6391 from "iso-639-1";
import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

const ALL_LANGUAGES = ISO6391.getAllNames().sort();

interface Props {
  visible: boolean;
  onSelect: (language: string) => void;
  onClose: () => void;
  disabledLanguages?: string[];
  title?: string;
}

export function LanguagePickerModal({
  visible,
  onSelect,
  onClose,
  disabledLanguages = [],
  title = "Select a language",
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_LANGUAGES;
    return ALL_LANGUAGES.filter((name) => name.toLowerCase().includes(q));
  }, [query]);

  function handleClose() {
    setQuery("");
    onClose();
  }

  function handleSelect(lang: string) {
    setQuery("");
    onSelect(lang);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-background">
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2 border-b border-border">
          <Text className="text-foreground text-lg font-bold">{title}</Text>
          <Pressable onPress={handleClose} hitSlop={12}>
            <Text className="text-primary font-medium">Done</Text>
          </Pressable>
        </View>

        <View className="px-4 py-3">
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search languages..."
            placeholderTextColor="#9ca3af"
            autoFocus
            className="border border-border rounded-lg px-3 py-2 text-foreground bg-background"
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const disabled = disabledLanguages.includes(item);
            return (
              <Pressable
                onPress={() => !disabled && handleSelect(item)}
                className={`px-4 py-3 border-b border-border ${disabled ? "opacity-30" : ""}`}
              >
                <Text className="text-foreground">{item}</Text>
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}
