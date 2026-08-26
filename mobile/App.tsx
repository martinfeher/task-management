import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  getApiUrl,
  getFirstListId,
  getListTasks,
  getTask,
  patchTask,
  putDetails,
  uploadTaskImage,
  type MobileTask,
} from "./api";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listTitle, setListTitle] = useState("");
  const [tasks, setTasks] = useState<MobileTask[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetails, setSelectedDetails] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const listId = await getFirstListId();
      const data = await getListTasks(listId);
      setListTitle(data.title);
      setTasks([...data.pinned, ...data.tasks]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openTask(taskId: string) {
    setSelectedId(taskId);
    try {
      const task = await getTask(taskId);
      setSelectedDetails(task.details || "(empty)");
    } catch (err) {
      setSelectedDetails(
        err instanceof Error ? err.message : "Failed to load details",
      );
    }
  }

  async function toggleComplete(task: MobileTask) {
    await patchTask(task.id, { completed: !task.completed });
    await load();
  }

  async function setWeeklyRepeat(task: MobileTask) {
    await patchTask(task.id, {
      recurrenceRule: { frequency: "weekly", interval: 1 },
    });
    await load();
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.error}>Error: {error}</Text>
        <Text style={styles.meta}>API: {getApiUrl()}</Text>
        <Pressable style={styles.button} onPress={() => void load()}>
          <Text style={styles.buttonText}>Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.heading}>{listTitle}</Text>
      <Text style={styles.meta}>API: {getApiUrl()}</Text>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Pressable style={styles.rowMain} onPress={() => void openTask(item.id)}>
              <Text style={item.completed ? styles.done : styles.title}>
                {item.name}
              </Text>
            </Pressable>
            <Pressable
              style={styles.chip}
              onPress={() => void toggleComplete(item)}
            >
              <Text style={styles.chipText}>{item.completed ? "Undo" : "Done"}</Text>
            </Pressable>
            <Pressable
              style={styles.chip}
              onPress={() => void setWeeklyRepeat(item)}
            >
              <Text style={styles.chipText}>Weekly</Text>
            </Pressable>
          </View>
        )}
      />

      {selectedId ? (
        <View style={styles.detail}>
          <Text style={styles.detailTitle}>Details</Text>
          <Text style={styles.detailBody}>{selectedDetails}</Text>
          <Pressable
            style={styles.button}
            onPress={() =>
              void putDetails(
                selectedId,
                '<div class="detail-line">Updated from mobile</div>',
              ).then(() => openTask(selectedId))
            }
          >
            <Text style={styles.buttonText}>Save sample details</Text>
          </Pressable>
          <Pressable
            style={styles.buttonSecondary}
            onPress={() =>
              void uploadTaskImage(selectedId)
                .then(({ url }) =>
                  putDetails(
                    selectedId,
                    `<div class="detail-line">Image: ${url}</div>`,
                  ),
                )
                .then(() => openTask(selectedId))
            }
          >
            <Text style={styles.buttonSecondaryText}>Upload image</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  heading: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
  meta: { fontSize: 12, color: "#666", marginBottom: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  rowMain: { flex: 1 },
  title: { fontSize: 16 },
  done: { fontSize: 16, textDecorationLine: "line-through", color: "#888" },
  chip: {
    backgroundColor: "#eef2ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  chipText: { fontSize: 12, color: "#4873c7" },
  detail: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
  },
  detailTitle: { fontWeight: "600", marginBottom: 8 },
  detailBody: { fontSize: 14, color: "#333" },
  button: {
    marginTop: 12,
    backgroundColor: "#4873c7",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "600" },
  buttonSecondary: {
    marginTop: 8,
    backgroundColor: "#e2e8f0",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonSecondaryText: { color: "#334155", fontWeight: "600" },
  error: { color: "#b91c1c", marginBottom: 12 },
});
