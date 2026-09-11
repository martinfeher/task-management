import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  getMobileLoadInFlight,
  readMobileListSnapshot,
  setMobileLoadInFlight,
  writeMobileListSnapshot,
} from "./mobile-session";

function hydrateFromSnapshot(
  snapshot: NonNullable<ReturnType<typeof readMobileListSnapshot>>,
  listIdRef: { current: string | null },
  setListTitle: (title: string) => void,
  setTasks: (tasks: MobileTask[]) => void,
) {
  listIdRef.current = snapshot.listId;
  setListTitle(snapshot.listTitle);
  setTasks(snapshot.tasks);
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listTitle, setListTitle] = useState("");
  const [tasks, setTasks] = useState<MobileTask[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetails, setSelectedDetails] = useState("");
  const listIdRef = useRef<string | null>(null);
  const initialLoadDoneRef = useRef(false);

  const load = useCallback(async (options?: { background?: boolean; force?: boolean }) => {
    const snapshot = readMobileListSnapshot();
    if (!options?.force && snapshot) {
      hydrateFromSnapshot(snapshot, listIdRef, setListTitle, setTasks);
      initialLoadDoneRef.current = true;
      setError(null);
      setLoading(false);
      return;
    }

    const inFlight = getMobileLoadInFlight();
    if (inFlight && !options?.force) {
      await inFlight;
      const hydratedSnapshot = readMobileListSnapshot();
      if (hydratedSnapshot) {
        hydrateFromSnapshot(
          hydratedSnapshot,
          listIdRef,
          setListTitle,
          setTasks,
        );
      }
      initialLoadDoneRef.current = true;
      setLoading(false);
      return;
    }

    const isInitialLoad = !initialLoadDoneRef.current;
    if (!options?.background && isInitialLoad) {
      setLoading(true);
    }
    setError(null);

    const promise = (async () => {
      try {
        const listId = listIdRef.current ?? (await getFirstListId());
        listIdRef.current = listId;
        const data = await getListTasks(listId);
        const nextTasks = [...data.pinned, ...data.tasks];
        setListTitle(data.title);
        setTasks(nextTasks);
        writeMobileListSnapshot({
          listId,
          listTitle: data.title,
          tasks: nextTasks,
          fetchedAt: Date.now(),
        });
        initialLoadDoneRef.current = true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!options?.background && isInitialLoad) {
          setLoading(false);
        }
      }
    })();

    setMobileLoadInFlight(promise);
    try {
      await promise;
    } finally {
      setMobileLoadInFlight(null);
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
    await load({ background: true, force: true });
  }

  async function setWeeklyRepeat(task: MobileTask) {
    await patchTask(task.id, {
      recurrenceRule: { frequency: "weekly", interval: 1 },
    });
    await load({ background: true, force: true });
  }

  if (error && !initialLoadDoneRef.current) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.error}>Error: {error}</Text>
        <Text style={styles.meta}>API: {getApiUrl()}</Text>
        <Pressable style={styles.button} onPress={() => void load({ force: true })}>
          <Text style={styles.buttonText}>Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      {loading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" />
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    zIndex: 2,
  },
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
